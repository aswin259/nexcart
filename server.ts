import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db, initDatabase } from './server/db.ts';
import {
  clearSessionCookie,
  csrfProtection,
  getRequestSession,
  hashPassword,
  setSessionCookie,
  signSessionToken,
  validatePasswordStrength,
  verifyPassword,
} from './server/auth.ts';

initDatabase();

const app = express();
const PORT = 3000;
const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use('/api', csrfProtection);

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    role: 'customer' | 'seller' | 'admin';
    created_at: string;
  };
}

function attachUser(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const session = getRequestSession(req);
  if (session) {
    const row = db
      .prepare('SELECT id, name, email, mobile, role, created_at FROM users WHERE id = ?')
      .get(session.uid) as AuthenticatedRequest['user'] | undefined;
    if (row) {
      req.user = row;
    } else if (session.role === 'admin' && session.uid === 0) {
      req.user = {
        id: 0,
        name: 'Store Administrator',
        email: session.email,
        mobile: null,
        role: 'admin',
        created_at: new Date().toISOString(),
      };
    }
  }
  next();
}

app.use(attachUser);

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.id <= 0) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin authorization required.' });
    return;
  }
  next();
}

function hydrateProducts(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id));
  const placeholders = ids.map(() => '?').join(',');
  const imgRows = db
    .prepare(`SELECT product_id, image_url FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`)
    .all(...ids) as { product_id: number; image_url: string }[];

  const imgMap: Record<number, string[]> = {};
  for (const ir of imgRows) {
    if (!imgMap[ir.product_id]) imgMap[ir.product_id] = [];
    imgMap[ir.product_id].push(ir.image_url);
  }

  return rows.map((r) => {
    let specs: Record<string, string> = {};
    let variants: Record<string, string[]> = {};
    try {
      specs = JSON.parse(String(r.specs_json || '{}'));
    } catch {
      specs = {};
    }
    try {
      variants = JSON.parse(String(r.variants_json || '{}'));
    } catch {
      variants = {};
    }
    return {
      id: r.id,
      seller_id: r.seller_id,
      seller_name: r.seller_name || 'NexCart Retail',
      category_id: r.category_id,
      category_slug: r.category_slug,
      category_name: r.category_name,
      slug: r.slug,
      name: r.name,
      brand: r.brand,
      description: r.description,
      specs,
      variants,
      original_price: Number(r.original_price),
      price: Number(r.price),
      discount_percent: Number(r.discount_percent),
      rating: Number(r.rating),
      review_count: Number(r.review_count),
      stock_qty: Number(r.stock_qty ?? 0),
      sku: r.sku || '',
      images: imgMap[Number(r.id)] || [],
      is_top_deal: Number(r.is_top_deal || 0),
      is_best_seller: Number(r.is_best_seller || 0),
      is_recommended: Number(r.is_recommended || 0),
      is_trending: Number(r.is_trending || 0),
      created_at: r.created_at,
    };
  });
}

function hydrateOrders(orderRows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (orderRows.length === 0) return [];
  const ids = orderRows.map((o) => Number(o.id));
  const placeholders = ids.map(() => '?').join(',');
  const items = db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`)
    .all(...ids) as Record<string, unknown>[];

  const itemsMap: Record<number, Record<string, unknown>[]> = {};
  for (const it of items) {
    const oid = Number(it.order_id);
    if (!itemsMap[oid]) itemsMap[oid] = [];
    itemsMap[oid].push(it);
  }

  return orderRows.map((o) => {
    let address = {};
    try {
      address = JSON.parse(String(o.address_json || '{}'));
    } catch {
      address = {};
    }
    return {
      ...o,
      address,
      items: itemsMap[Number(o.id)] || [],
    };
  });
}

function isSafeImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/uploads/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function computeDiscount(subtotal: number, couponCode?: string | null): { discount: number; coupon: Record<string, unknown> | null; error?: string } {
  if (!couponCode || !couponCode.trim()) return { discount: 0, coupon: null };
  const code = couponCode.trim().toUpperCase();
  const coupon = db
    .prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1')
    .get(code) as Record<string, unknown> | undefined;
  if (!coupon) {
    return { discount: 0, coupon: null, error: 'Invalid or inactive coupon code.' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (String(coupon.expires_at) < today) {
    return { discount: 0, coupon: null, error: 'This coupon has expired.' };
  }
  const minAmt = Number(coupon.min_order_amount || 0);
  if (subtotal < minAmt) {
    return { discount: 0, coupon: null, error: `Minimum order value of ₹${minAmt} required for ${code}.` };
  }
  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = Math.round((subtotal * Number(coupon.discount_value)) / 100);
    const maxD = Number(coupon.max_discount || 0);
    if (maxD > 0) discount = Math.min(discount, maxD);
  } else {
    discount = Number(coupon.discount_value);
  }
  discount = Math.min(discount, subtotal);
  return { discount, coupon };
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) +
    '-' +
    crypto.randomBytes(3).toString('hex')
  );
}

/* ===========================
   HEALTH
=========================== */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexcart' });
});

/* ===========================
   AUTH & PROFILE ROUTES
=========================== */
app.post('/api/auth/register', (req: AuthenticatedRequest, res) => {
  const { name, email, mobile, password } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : '';
  if (cleanMobile && !/^\d{10}$/.test(cleanMobile)) {
    res.status(400).json({ error: 'Mobile number must be 10 digits.' });
    return;
  }
  const pwErr = validatePasswordStrength(password);
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR (mobile IS NOT NULL AND mobile = ?)')
    .get(cleanEmail, cleanMobile || null);
  if (existing) {
    res.status(409).json({ error: 'An account with this email or mobile number already exists.' });
    return;
  }

  const hash = hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), cleanEmail, cleanMobile || null, hash, 'customer');
  const uid = Number(result.lastInsertRowid);
  const user = db.prepare('SELECT id, name, email, mobile, role, created_at FROM users WHERE id = ?').get(uid) as AuthenticatedRequest['user'];
  const token = signSessionToken({ uid, role: 'customer', email: cleanEmail });
  setSessionCookie(res, token);
  res.status(201).json({ user, addresses: [], seller: null });
});

app.post('/api/auth/login', (req: AuthenticatedRequest, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password || typeof identifier !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email/mobile and password are required.' });
    return;
  }
  const clean = identifier.trim().toLowerCase();
  const digits = identifier.replace(/\D/g, '');
  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR (mobile IS NOT NULL AND mobile = ?)')
    .get(clean, digits || clean) as Record<string, unknown> | undefined;

  if (!row || !verifyPassword(password, String(row.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials. Please check your email/mobile and password.' });
    return;
  }

  const uid = Number(row.id);
  const role = String(row.role) as 'customer' | 'seller' | 'admin';
  const token = signSessionToken({ uid, role, email: String(row.email) });
  setSessionCookie(res, token);
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(uid);
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(uid) || null;
  res.json({
    user: {
      id: uid,
      name: row.name,
      email: row.email,
      mobile: row.mobile,
      role,
      created_at: row.created_at,
    },
    addresses,
    seller,
  });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user || req.user.id <= 0) {
    res.json({ user: null, addresses: [], seller: null });
    return;
  }
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.user.id);
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.id) || null;
  res.json({ user: req.user, addresses, seller });
});

app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, email, mobile } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Name must be at least 2 characters.' });
    return;
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }
  const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : '';
  if (cleanMobile && !/^\d{10}$/.test(cleanMobile)) {
    res.status(400).json({ error: 'Mobile number must be 10 digits.' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const conflict = db
    .prepare('SELECT id FROM users WHERE id != ? AND (LOWER(email) = ? OR (mobile IS NOT NULL AND mobile = ?))')
    .get(req.user!.id, cleanEmail, cleanMobile || null);
  if (conflict) {
    res.status(409).json({ error: 'Email or mobile is already used by another account.' });
    return;
  }
  db.prepare('UPDATE users SET name = ?, email = ?, mobile = ? WHERE id = ?').run(
    name.trim(),
    cleanEmail,
    cleanMobile || null,
    req.user!.id
  );
  const updated = db.prepare('SELECT id, name, email, mobile, role, created_at FROM users WHERE id = ?').get(req.user!.id);
  res.json({ user: updated });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier || typeof identifier !== 'string') {
    res.status(400).json({ error: 'Enter your registered email or mobile number.' });
    return;
  }
  const clean = identifier.trim().toLowerCase();
  const digits = identifier.replace(/\D/g, '');
  const user = db
    .prepare('SELECT id, email FROM users WHERE LOWER(email) = ? OR (mobile IS NOT NULL AND mobile = ?)')
    .get(clean, digits || clean) as { id: number; email: string } | undefined;

  if (!user) {
    res.json({ ok: true, message: 'If an account matches this email or mobile, a 6-digit verification code has been issued.' });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)').run(
    user.id,
    tokenHash,
    expiresAt
  );

  const payload: Record<string, unknown> = {
    ok: true,
    message: 'A 6-digit reset verification code has been generated (valid for 15 minutes).',
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.devResetCode = code;
  }
  res.json(payload);
});

app.post('/api/auth/reset-password', (req, res) => {
  const { identifier, code, newPassword } = req.body || {};
  if (!identifier || !code || !newPassword) {
    res.status(400).json({ error: 'Identifier, verification code, and new password are required.' });
    return;
  }
  const pwErr = validatePasswordStrength(String(newPassword));
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }
  const clean = String(identifier).trim().toLowerCase();
  const digits = String(identifier).replace(/\D/g, '');
  const user = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR (mobile IS NOT NULL AND mobile = ?)')
    .get(clean, digits || clean) as { id: number } | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid verification code or account.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  const resetRow = db
    .prepare('SELECT * FROM password_resets WHERE user_id = ? AND token_hash = ? AND used = 0 ORDER BY id DESC LIMIT 1')
    .get(user.id, tokenHash) as { id: number; expires_at: number } | undefined;

  if (!resetRow || Date.now() > resetRow.expires_at) {
    res.status(400).json({ error: 'Verification code is invalid or has expired.' });
    return;
  }

  const newHash = hashPassword(String(newPassword));
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
});

app.post('/api/auth/addresses', requireAuth, (req: AuthenticatedRequest, res) => {
  const { full_name, phone, pincode, address_line, city, state, is_default } = req.body || {};
  if (!full_name || !phone || !pincode || !address_line || !city || !state) {
    res.status(400).json({ error: 'All address fields are required.' });
    return;
  }
  if (!/^\d{6}$/.test(String(pincode).trim())) {
    res.status(400).json({ error: 'PIN code must be 6 digits.' });
    return;
  }
  const def = is_default ? 1 : 0;
  if (def) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
  }
  const result = db
    .prepare(
      'INSERT INTO addresses (user_id, full_name, phone, pincode, address_line, city, state, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      req.user!.id,
      String(full_name).trim(),
      String(phone).trim(),
      String(pincode).trim(),
      String(address_line).trim(),
      String(city).trim(),
      String(state).trim(),
      def
    );
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.user!.id);
  res.status(201).json({ id: Number(result.lastInsertRowid), addresses });
});

app.put('/api/auth/addresses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const addrId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addrId, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Address not found.' });
    return;
  }
  const { full_name, phone, pincode, address_line, city, state, is_default } = req.body || {};
  if (is_default) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
  }
  db.prepare(
    `UPDATE addresses SET
      full_name = COALESCE(?, full_name),
      phone = COALESCE(?, phone),
      pincode = COALESCE(?, pincode),
      address_line = COALESCE(?, address_line),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      is_default = COALESCE(?, is_default)
     WHERE id = ? AND user_id = ?`
  ).run(
    full_name ?? null,
    phone ?? null,
    pincode ?? null,
    address_line ?? null,
    city ?? null,
    state ?? null,
    typeof is_default === 'boolean' ? (is_default ? 1 : 0) : null,
    addrId,
    req.user!.id
  );
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.user!.id);
  res.json({ addresses });
});

app.delete('/api/auth/addresses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const addrId = Number(req.params.id);
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addrId, req.user!.id);
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.user!.id);
  res.json({ addresses });
});

/* ===========================
   CATALOG & SEARCH ROUTES
=========================== */
app.get('/api/categories', (_req, res) => {
  const cats = db
    .prepare(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();
  res.json({ categories: cats });
});

app.get('/api/products/suggestions', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ suggestions: [] });
    return;
  }
  const like = `%${q}%`;
  const products = db
    .prepare(
      `SELECT p.id, p.name, p.brand, p.price, c.name AS category_name, c.slug AS category_slug,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ? OR c.name LIKE ?
       ORDER BY p.review_count DESC
       LIMIT 8`
    )
    .all(like, like, like, like);
  res.json({ suggestions: products });
});

app.get('/api/products', (req, res) => {
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];

  const category = req.query.category ? String(req.query.category).trim() : '';
  if (category && category !== 'all') {
    where.push('c.slug = ?');
    params.push(category);
  }

  const q = req.query.q ? String(req.query.q).trim() : '';
  if (q) {
    const like = `%${q}%`;
    where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ? OR c.name LIKE ?)');
    params.push(like, like, like, like);
  }

  const minPrice = Number(req.query.minPrice);
  if (!Number.isNaN(minPrice) && req.query.minPrice !== undefined && req.query.minPrice !== '') {
    where.push('p.price >= ?');
    params.push(minPrice);
  }

  const maxPrice = Number(req.query.maxPrice);
  if (!Number.isNaN(maxPrice) && req.query.maxPrice !== undefined && req.query.maxPrice !== '') {
    where.push('p.price <= ?');
    params.push(maxPrice);
  }

  const brandParam = req.query.brand ? String(req.query.brand).trim() : '';
  if (brandParam) {
    const brands = brandParam.split(',').map((b) => b.trim()).filter(Boolean);
    if (brands.length > 0) {
      where.push(`p.brand IN (${brands.map(() => '?').join(',')})`);
      params.push(...brands);
    }
  }

  const minRating = Number(req.query.minRating);
  if (!Number.isNaN(minRating) && minRating > 0) {
    where.push('p.rating >= ?');
    params.push(minRating);
  }

  const minDiscount = Number(req.query.minDiscount);
  if (!Number.isNaN(minDiscount) && minDiscount > 0) {
    where.push('p.discount_percent >= ?');
    params.push(minDiscount);
  }

  if (req.query.inStock === 'true') {
    where.push('COALESCE(inv.stock_qty, 0) > 0');
  }

  const flag = req.query.flag ? String(req.query.flag) : '';
  if (flag === 'top_deal') where.push('p.is_top_deal = 1');
  if (flag === 'best_seller') where.push('p.is_best_seller = 1');
  if (flag === 'recommended') where.push('p.is_recommended = 1');
  if (flag === 'trending') where.push('p.is_trending = 1');

  const sortMap: Record<string, string> = {
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    popularity: 'p.review_count DESC, p.rating DESC',
    rating: 'p.rating DESC, p.review_count DESC',
    newest: 'p.id DESC',
  };
  const sortSql = sortMap[String(req.query.sort || 'popularity')] || sortMap.popularity;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 60));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const sql = `
    SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
           COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN sellers s ON s.id = p.seller_id
    LEFT JOIN inventory inv ON inv.product_id = p.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${sortSql}
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limit, offset) as Record<string, unknown>[];

  const brandsRows = db
    .prepare(
      `SELECT DISTINCT p.brand FROM products p
       JOIN categories c ON c.id = p.category_id
       ${category && category !== 'all' ? 'WHERE c.slug = ?' : ''}
       ORDER BY p.brand ASC`
    )
    .all(...(category && category !== 'all' ? [category] : [])) as { brand: string }[];

  res.json({
    products: hydrateProducts(rows),
    brands: brandsRows.map((b) => b.brand),
  });
});

app.get('/api/products/:id', (req, res) => {
  const idOrSlug = req.params.id;
  const isNumeric = /^\d+$/.test(idOrSlug);
  const row = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE ${isNumeric ? 'p.id = ?' : 'p.slug = ?'}`
    )
    .get(isNumeric ? Number(idOrSlug) : idOrSlug) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const [product] = hydrateProducts([row]);
  const reviews = db
    .prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC')
    .all(Number(row.id));

  const similarRows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.category_id = ? AND p.id != ?
       ORDER BY p.rating DESC
       LIMIT 4`
    )
    .all(Number(row.category_id), Number(row.id)) as Record<string, unknown>[];

  const fbtRows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.id != ? AND COALESCE(inv.stock_qty, 0) > 0
       ORDER BY p.is_best_seller DESC, p.price ASC
       LIMIT 2`
    )
    .all(Number(row.id)) as Record<string, unknown>[];

  res.json({
    product,
    reviews,
    similar: hydrateProducts(similarRows),
    frequentlyBoughtTogether: hydrateProducts(fbtRows),
  });
});

app.get('/api/pincode/:pin', (req, res) => {
  const pin = String(req.params.pin || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) {
    res.status(400).json({ available: false, error: 'Please enter a valid 6-digit Indian PIN code.' });
    return;
  }
  const metroPrefixes = ['11', '40', '56', '60', '50', '70', '41', '38'];
  const prefix = pin.slice(0, 2);
  const days = metroPrefixes.includes(prefix) ? 2 : 4;
  const est = new Date(Date.now() + days * 86400000).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  res.json({
    available: true,
    pincode: pin,
    days,
    estimatedDate: est,
    codAvailable: true,
    message: `Delivery by ${est} · Free delivery available`,
  });
});

app.post('/api/products/:id/reviews', requireAuth, (req: AuthenticatedRequest, res) => {
  const productId = Number(req.params.id);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  const { rating, title, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    return;
  }
  if (!title || !comment || String(comment).trim().length < 5) {
    res.status(400).json({ error: 'Please include a review title and comment.' });
    return;
  }

  db.prepare(
    'INSERT INTO reviews (product_id, user_id, author_name, rating, title, comment, verified_purchase) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(productId, req.user!.id, req.user!.name, r, String(title).trim(), String(comment).trim());

  const stats = db
    .prepare('SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE product_id = ?')
    .get(productId) as { avg_r: number; cnt: number };
  db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?').run(
    Number(Number(stats.avg_r).toFixed(1)),
    stats.cnt,
    productId
  );

  const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').all(productId);
  res.status(201).json({ reviews, rating: Number(Number(stats.avg_r).toFixed(1)), review_count: stats.cnt });
});

/* ===========================
   CART & WISHLIST ROUTES
=========================== */
function getUserCartItems(userId: number) {
  const rows = db
    .prepare(
      `SELECT ci.id AS cart_id, ci.variant_label, ci.quantity,
              p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE ci.user_id = ?
       ORDER BY ci.id DESC`
    )
    .all(userId) as Record<string, unknown>[];

  const hydrated = hydrateProducts(rows);
  return rows.map((r, idx) => ({
    id: Number(r.cart_id),
    product_id: Number(r.id),
    variant_label: String(r.variant_label || 'Standard'),
    quantity: Number(r.quantity),
    product: hydrated[idx],
  }));
}

app.get('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ items: getUserCartItems(req.user!.id) });
});

app.post('/api/cart', requireAuth, (req: AuthenticatedRequest, res) => {
  const { product_id, variant_label = 'Standard', quantity = 1 } = req.body || {};
  const pid = Number(product_id);
  const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
  const inv = db.prepare('SELECT stock_qty FROM inventory WHERE product_id = ?').get(pid) as { stock_qty: number } | undefined;
  if (!inv) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  if (inv.stock_qty < 1) {
    res.status(400).json({ error: 'This product is currently out of stock.' });
    return;
  }

  const label = String(variant_label || 'Standard').slice(0, 80);
  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND variant_label = ?')
    .get(req.user!.id, pid, label) as { id: number; quantity: number } | undefined;

  if (existing) {
    const nextQty = Math.min(inv.stock_qty, existing.quantity + qty);
    db.prepare("UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(nextQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (user_id, product_id, variant_label, quantity) VALUES (?, ?, ?, ?)').run(
      req.user!.id,
      pid,
      label,
      Math.min(inv.stock_qty, qty)
    );
  }
  res.json({ items: getUserCartItems(req.user!.id) });
});

app.post('/api/cart/sync', requireAuth, (req: AuthenticatedRequest, res) => {
  const guestItems = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const item of guestItems) {
    const pid = Number(item.product_id);
    const qty = Math.max(1, Math.min(20, Number(item.quantity) || 1));
    const label = String(item.variant_label || 'Standard').slice(0, 80);
    const inv = db.prepare('SELECT stock_qty FROM inventory WHERE product_id = ?').get(pid) as { stock_qty: number } | undefined;
    if (!inv || inv.stock_qty < 1) continue;
    const existing = db
      .prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND variant_label = ?')
      .get(req.user!.id, pid, label) as { id: number; quantity: number } | undefined;
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(
        Math.min(inv.stock_qty, existing.quantity + qty),
        existing.id
      );
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, variant_label, quantity) VALUES (?, ?, ?, ?)').run(
        req.user!.id,
        pid,
        label,
        Math.min(inv.stock_qty, qty)
      );
    }
  }
  res.json({ items: getUserCartItems(req.user!.id) });
});

app.put('/api/cart/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const cartId = Number(req.params.id);
  const qty = Number(req.body?.quantity);
  const existing = db
    .prepare('SELECT ci.*, COALESCE(inv.stock_qty, 0) AS stock_qty FROM cart_items ci LEFT JOIN inventory inv ON inv.product_id = ci.product_id WHERE ci.id = ? AND ci.user_id = ?')
    .get(cartId, req.user!.id) as { id: number; stock_qty: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Cart item not found.' });
    return;
  }
  if (!Number.isInteger(qty) || qty < 1) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartId, req.user!.id);
  } else {
    db.prepare("UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
      Math.min(Math.max(1, existing.stock_qty), qty),
      cartId
    );
  }
  res.json({ items: getUserCartItems(req.user!.id) });
});

app.delete('/api/cart/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const cartId = Number(req.params.id);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartId, req.user!.id);
  res.json({ items: getUserCartItems(req.user!.id) });
});

app.get('/api/wishlist', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE wi.user_id = ?
       ORDER BY wi.id DESC`
    )
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({ items: hydrateProducts(rows) });
});

app.post('/api/wishlist/:productId', requireAuth, (req: AuthenticatedRequest, res) => {
  const pid = Number(req.params.productId);
  const existing = db
    .prepare('SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?')
    .get(req.user!.id, pid) as { id: number } | undefined;
  let wishlisted = false;
  if (existing) {
    db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)').run(req.user!.id, pid);
    wishlisted = true;
  }
  const rows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE wi.user_id = ?
       ORDER BY wi.id DESC`
    )
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({ wishlisted, items: hydrateProducts(rows) });
});

app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal } = req.body || {};
  const sub = Math.max(0, Number(subtotal) || 0);
  const result = computeDiscount(sub, code);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ valid: true, discount: result.discount, coupon: result.coupon });
});

/* ===========================
   CHECKOUT, RAZORPAY & ORDERS
=========================== */
app.get('/api/payments/config', (_req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  res.json({
    razorpayConfigured: Boolean(keyId && keySecret),
    keyId: keyId && keySecret ? keyId : null,
  });
});

function buildOrderCalculation(
  userId: number,
  body: Record<string, unknown>
): {
  error?: string;
  items: { product_id: number; seller_id: number; name: string; image: string; variant_label: string; price: number; quantity: number }[];
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  totalAmount: number;
  couponCode: string | null;
  deliveryOption: 'standard' | 'express';
  address: Record<string, string>;
  clearCartAfter: boolean;
} {
  const addr = body.address as Record<string, unknown> | undefined;
  const fullName = String(addr?.full_name || '').trim();
  const phoneDigits = String(addr?.phone || '').replace(/\D/g, '');
  const pincode = String(addr?.pincode || '').trim();
  const addressLine = String(addr?.address_line || '').trim();
  const city = String(addr?.city || '').trim();
  const state = String(addr?.state || '').trim();

  if (!fullName || !phoneDigits || !pincode || !addressLine || !city || !state) {
    return { error: 'Please select or enter a complete delivery address.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption: 'standard', address: {}, clearCartAfter: false };
  }
  if (!/^\d{10}$/.test(phoneDigits)) {
    return { error: 'Delivery phone number must be a valid 10-digit mobile number.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption: 'standard', address: {}, clearCartAfter: false };
  }
  if (!/^\d{6}$/.test(pincode)) {
    return { error: 'Delivery PIN code must be 6 digits.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption: 'standard', address: {}, clearCartAfter: false };
  }

  const deliveryOption = body.deliveryOption === 'express' ? 'express' : 'standard';

  const directItems = Array.isArray(body.items) ? (body.items as { product_id: number; variant_label?: string; quantity: number }[]) : null;
  const sourceItems =
    directItems && directItems.length > 0
      ? directItems.map((d) => ({
          product_id: Number(d.product_id),
          variant_label: String(d.variant_label || 'Standard').slice(0, 80),
          quantity: Math.max(1, Math.min(20, Math.floor(Number(d.quantity) || 1))),
        }))
      : (db.prepare('SELECT product_id, variant_label, quantity FROM cart_items WHERE user_id = ?').all(userId) as {
          product_id: number;
          variant_label: string;
          quantity: number;
        }[]);

  if (sourceItems.length === 0) {
    return { error: 'Your cart is empty.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption, address: {}, clearCartAfter: false };
  }

  const resolvedItems: { product_id: number; seller_id: number; name: string; image: string; variant_label: string; price: number; quantity: number }[] = [];
  const requestedQtyByProduct: Record<number, number> = {};
  let subtotal = 0;

  for (const si of sourceItems) {
    if (!Number.isInteger(si.product_id) || si.product_id <= 0 || si.quantity < 1) {
      return { error: 'Invalid product or quantity in cart.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption, address: {}, clearCartAfter: false };
    }
    const prod = db
      .prepare(
        `SELECT p.id, p.seller_id, p.name, p.price, COALESCE(inv.stock_qty, 0) AS stock_qty,
                (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image
         FROM products p
         LEFT JOIN inventory inv ON inv.product_id = p.id
         WHERE p.id = ?`
      )
      .get(si.product_id) as Record<string, unknown> | undefined;
    if (!prod) {
      return { error: 'One or more products are no longer available.', items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption, address: {}, clearCartAfter: false };
    }
    requestedQtyByProduct[si.product_id] = (requestedQtyByProduct[si.product_id] || 0) + si.quantity;
    if (Number(prod.stock_qty) < requestedQtyByProduct[si.product_id]) {
      return { error: `Insufficient stock for ${prod.name}.`, items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption, address: {}, clearCartAfter: false };
    }
    const unitPrice = Number(prod.price);
    subtotal += unitPrice * si.quantity;
    resolvedItems.push({
      product_id: Number(prod.id),
      seller_id: Number(prod.seller_id),
      name: String(prod.name),
      image: String(prod.image || ''),
      variant_label: si.variant_label,
      price: unitPrice,
      quantity: si.quantity,
    });
  }

  const couponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : null;
  const couponRes = computeDiscount(subtotal, couponCode);
  if (couponRes.error) {
    return { error: couponRes.error, items: [], subtotal: 0, discountAmount: 0, deliveryCharge: 0, totalAmount: 0, couponCode: null, deliveryOption, address: {}, clearCartAfter: false };
  }

  const baseDelivery = deliveryOption === 'express' ? 99 : subtotal >= 499 ? 0 : 49;
  const deliveryCharge = couponCode === 'FREESHIP' ? 0 : baseDelivery;
  const totalAmount = Math.max(1, subtotal - couponRes.discount + deliveryCharge);

  return {
    items: resolvedItems,
    subtotal,
    discountAmount: couponRes.discount,
    deliveryCharge,
    totalAmount,
    couponCode: couponRes.coupon ? String(couponRes.coupon.code) : null,
    deliveryOption,
    address: {
      full_name: fullName,
      phone: phoneDigits,
      pincode,
      address_line: addressLine,
      city,
      state,
    },
    clearCartAfter: !body.isBuyNow,
  };
}

app.post('/api/orders', requireAuth, (req: AuthenticatedRequest, res) => {
  const method = String(req.body?.paymentMethod || 'cod').toLowerCase();
  if (method !== 'cod') {
    res.status(400).json({ error: 'Online payments must be verified via Razorpay test mode.' });
    return;
  }

  const calc = buildOrderCalculation(req.user!.id, req.body || {});
  if (calc.error) {
    res.status(400).json({ error: calc.error });
    return;
  }

  const estDays = calc.deliveryOption === 'express' ? 2 : 5;
  const estimatedDelivery = new Date(Date.now() + estDays * 86400000).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const orderNumber = `NC-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;

  try {
    db.exec('BEGIN IMMEDIATE;');
    const orderRes = db
      .prepare(
        `INSERT INTO orders (
          order_number, user_id, address_json, delivery_option, subtotal, discount_amount,
          delivery_charge, total_amount, coupon_code, payment_method, payment_status, status, estimated_delivery
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cash on Delivery', 'cod_pending', 'Order Placed', ?)`
      )
      .run(
        orderNumber,
        req.user!.id,
        JSON.stringify(calc.address),
        calc.deliveryOption,
        calc.subtotal,
        calc.discountAmount,
        calc.deliveryCharge,
        calc.totalAmount,
        calc.couponCode,
        estimatedDelivery
      );
    const orderId = Number(orderRes.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, seller_id, product_name, product_image, variant_label, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const decStock = db.prepare(
      "UPDATE inventory SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE product_id = ? AND stock_qty >= ?"
    );

    for (const item of calc.items) {
      const upd = decStock.run(item.quantity, item.product_id, item.quantity);
      if (upd.changes === 0) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
      insertItem.run(orderId, item.product_id, item.seller_id, item.name, item.image, item.variant_label, item.price, item.quantity);
    }

    db.prepare(
      "INSERT INTO payments (order_id, provider, amount, currency, status) VALUES (?, 'cod', ?, 'INR', 'cod_pending')"
    ).run(orderId, calc.totalAmount);

    if (calc.clearCartAfter) {
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.id);
    }
    db.exec('COMMIT;');

    const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
    res.status(201).json({ order: hydrateOrders([created])[0] });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore if transaction already rolled back
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to place order.' });
  }
});

app.post('/api/payments/razorpay/order', requireAuth, async (req: AuthenticatedRequest, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (!keyId || !keySecret) {
    res.status(503).json({
      error:
        'Razorpay test mode keys (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server. Add your Razorpay Test Mode keys in Secrets/Environment or select Cash on Delivery.',
    });
    return;
  }

  const calc = buildOrderCalculation(req.user!.id, req.body || {});
  if (calc.error) {
    res.status(400).json({ error: calc.error });
    return;
  }

  const amountPaise = Math.round(calc.totalAmount * 100);
  const receipt = `sk_rcpt_${Date.now()}_${req.user!.id}`;

  try {
    const authToken = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
      }),
    });
    const rzpData = (await rzpResp.json()) as { id?: string; error?: { description?: string } };
    if (!rzpResp.ok || !rzpData.id) {
      res.status(502).json({ error: rzpData.error?.description || 'Failed to initialize Razorpay test order.' });
      return;
    }

    const estDays = calc.deliveryOption === 'express' ? 2 : 5;
    const estimatedDelivery = new Date(Date.now() + estDays * 86400000).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const orderNumber = `NC-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
    const paymentMethodLabel = String(req.body?.paymentMethodLabel || 'Razorpay');

    db.exec('BEGIN IMMEDIATE;');
    const orderRes = db
      .prepare(
        `INSERT INTO orders (
          order_number, user_id, address_json, delivery_option, subtotal, discount_amount,
          delivery_charge, total_amount, coupon_code, payment_method, payment_status, status, estimated_delivery
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'Order Placed', ?)`
      )
      .run(
        orderNumber,
        req.user!.id,
        JSON.stringify(calc.address),
        calc.deliveryOption,
        calc.subtotal,
        calc.discountAmount,
        calc.deliveryCharge,
        calc.totalAmount,
        calc.couponCode,
        paymentMethodLabel,
        estimatedDelivery
      );
    const orderId = Number(orderRes.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, seller_id, product_name, product_image, variant_label, unit_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of calc.items) {
      insertItem.run(orderId, item.product_id, item.seller_id, item.name, item.image, item.variant_label, item.price, item.quantity);
    }
    db.prepare(
      "INSERT INTO payments (order_id, provider, razorpay_order_id, amount, currency, status) VALUES (?, 'razorpay', ?, ?, 'INR', 'pending')"
    ).run(orderId, rzpData.id, calc.totalAmount);
    db.exec('COMMIT;');

    res.json({
      keyId,
      razorpayOrderId: rzpData.id,
      amount: amountPaise,
      currency: 'INR',
      orderId,
      orderNumber,
      clearCart: calc.clearCartAfter,
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore if no active tx
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Payment initialization error.' });
  }
});

app.post('/api/payments/razorpay/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (!keySecret) {
    res.status(503).json({ error: 'Razorpay secret not configured.' });
    return;
  }

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, clearCart } = req.body || {};
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing payment verification parameters.' });
    return;
  }

  const expectedSig = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const sigBuf = Buffer.from(String(razorpay_signature));
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(400).json({ error: 'Payment signature verification failed.' });
    return;
  }

  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(Number(orderId), req.user!.id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  try {
    db.exec('BEGIN IMMEDIATE;');
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(Number(orderId)) as {
      product_id: number;
      seller_id: number;
      unit_price: number;
      quantity: number;
      product_name: string;
    }[];

    if (order.payment_status !== 'captured') {
      const decStock = db.prepare(
        "UPDATE inventory SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE product_id = ? AND stock_qty >= ?"
      );
      const addEarning = db.prepare('UPDATE sellers SET total_earnings = total_earnings + ? WHERE id = ?');
      for (const it of items) {
        const upd = decStock.run(it.quantity, it.product_id, it.quantity);
        if (upd.changes === 0) {
          throw new Error(`Stock unavailable for ${it.product_name}`);
        }
        addEarning.run(it.unit_price * it.quantity, it.seller_id);
      }
      db.prepare("UPDATE orders SET payment_status = 'captured', status = 'Confirmed', updated_at = datetime('now') WHERE id = ?").run(
        Number(orderId)
      );
      db.prepare(
        "UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'captured' WHERE order_id = ? AND razorpay_order_id = ?"
      ).run(String(razorpay_payment_id), String(razorpay_signature), Number(orderId), String(razorpay_order_id));

      if (clearCart) {
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.id);
      }
    }
    db.exec('COMMIT;');
    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId)) as Record<string, unknown>;
    res.json({ order: hydrateOrders([updatedOrder])[0] });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore if transaction already rolled back
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to verify payment.' });
  }
});

app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({ orders: hydrateOrders(rows) });
});

app.get('/api/orders/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.user!.id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  res.json({ order: hydrateOrders([order])[0] });
});

app.post('/api/orders/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const orderId = Number(req.params.id);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user!.id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (!['Order Placed', 'Confirmed'].includes(String(order.status))) {
    res.status(400).json({ error: 'Only orders that have not yet shipped can be cancelled.' });
    return;
  }
  const reason = String(req.body?.reason || 'Cancelled by customer').slice(0, 240);
  try {
    db.exec('BEGIN IMMEDIATE;');
    db.prepare("UPDATE orders SET status = 'Cancelled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?").run(
      reason,
      orderId
    );
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as {
      product_id: number;
      quantity: number;
    }[];
    for (const it of items) {
      db.prepare("UPDATE inventory SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE product_id = ?").run(
        it.quantity,
        it.product_id
      );
    }
    db.exec('COMMIT;');
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
    res.json({ order: hydrateOrders([updated])[0] });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to cancel order.' });
  }
});

app.post('/api/orders/:id/return', requireAuth, (req: AuthenticatedRequest, res) => {
  const orderId = Number(req.params.id);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user!.id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (String(order.status) !== 'Delivered') {
    res.status(400).json({ error: 'Returns can only be requested for delivered orders.' });
    return;
  }
  const reason = String(req.body?.reason || 'Product return / refund requested').slice(0, 240);
  db.prepare("UPDATE orders SET status = 'Return Requested', return_reason = ?, updated_at = datetime('now') WHERE id = ?").run(
    reason,
    orderId
  );
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
  res.json({ order: hydrateOrders([updated])[0] });
});

/* ===========================
   SELLER DASHBOARD ROUTES
=========================== */
app.post('/api/seller/register', requireAuth, (req: AuthenticatedRequest, res) => {
  const { storeName, gstNumber, panNumber, supportEmail } = req.body || {};
  if (!storeName || String(storeName).trim().length < 3) {
    res.status(400).json({ error: 'Store name must be at least 3 characters.' });
    return;
  }
  const email = String(supportEmail || req.user!.email).trim().toLowerCase();
  const existing = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user!.id);
  if (existing) {
    res.json({ seller: existing });
    return;
  }
  const result = db
    .prepare(
      'INSERT INTO sellers (user_id, store_name, gst_number, pan_number, support_email, verified, total_earnings) VALUES (?, ?, ?, ?, ?, 1, 0)'
    )
    .run(req.user!.id, String(storeName).trim(), String(gstNumber || '').trim(), String(panNumber || '').trim(), email);
  if (req.user!.role === 'customer') {
    db.prepare("UPDATE users SET role = 'seller' WHERE id = ?").run(req.user!.id);
  }
  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ seller });
});

app.get('/api/seller/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user!.id) as Record<string, unknown> | undefined;
  if (!seller) {
    res.json({ registered: false, seller: null, products: [], orders: [], metrics: null });
    return;
  }
  const sellerId = Number(seller.id);
  const productRows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.seller_id = ?
       ORDER BY p.id DESC`
    )
    .all(sellerId) as Record<string, unknown>[];

  const orderItems = db
    .prepare(
      `SELECT oi.*, o.order_number, o.status AS order_status, o.created_at AS order_date
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.seller_id = ?
       ORDER BY oi.id DESC`
    )
    .all(sellerId) as Record<string, unknown>[];

  const totalSales = orderItems
    .filter((i) => i.order_status !== 'Cancelled')
    .reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0);
  const unitsSold = orderItems
    .filter((i) => i.order_status !== 'Cancelled')
    .reduce((sum, i) => sum + Number(i.quantity), 0);

  res.json({
    registered: true,
    seller,
    products: hydrateProducts(productRows),
    orders: orderItems,
    metrics: {
      totalProducts: productRows.length,
      totalSales,
      totalEarnings: Math.round(totalSales * 0.92), // net after 8% marketplace fee
      unitsSold,
    },
  });
});

app.post('/api/seller/products', requireAuth, (req: AuthenticatedRequest, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!seller) {
    res.status(403).json({ error: 'Please register as a seller first.' });
    return;
  }
  const { name, brand, category_id, description, original_price, price, stock_qty, image_url, specs } = req.body || {};
  if (!name || !brand || !category_id || !price) {
    res.status(400).json({ error: 'Product name, brand, category, and price are required.' });
    return;
  }
  const mrp = Math.max(Number(original_price) || Number(price), Number(price));
  const sale = Math.max(1, Number(price));
  const disc = Math.max(0, Math.round(((mrp - sale) / mrp) * 100));
  const img = isSafeImageUrl(String(image_url || '')) ? String(image_url).trim() : '/src/assets/images/prod_books_backpack_1795581233133.jpg';

  const result = db
    .prepare(
      `INSERT INTO products (
        seller_id, category_id, slug, name, brand, description, specs_json, variants_json,
        original_price, price, discount_percent, rating, review_count, is_recommended
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.5, 1, 1)`
    )
    .run(
      seller.id,
      Number(category_id),
      slugify(String(name)),
      String(name).trim(),
      String(brand).trim(),
      String(description || 'Quality product listed by verified NexCart seller.').trim(),
      JSON.stringify(specs || { Seller: 'Verified Marketplace Partner' }),
      JSON.stringify({ Options: ['Standard'] }),
      mrp,
      sale,
      disc
    );
  const pid = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, 0)').run(pid, img);
  db.prepare('INSERT INTO inventory (product_id, stock_qty, reserved_qty, sku) VALUES (?, ?, 0, ?)').run(
    pid,
    Math.max(0, Number(stock_qty) || 10),
    `SLR-${seller.id}-${pid}`
  );
  res.status(201).json({ ok: true, id: pid });
});

app.put('/api/seller/products/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!seller) {
    res.status(403).json({ error: 'Seller account required.' });
    return;
  }
  const pid = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(pid, seller.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found in your store.' });
    return;
  }
  const mrp = req.body.original_price !== undefined ? Number(req.body.original_price) : Number(existing.original_price);
  const price = req.body.price !== undefined ? Number(req.body.price) : Number(existing.price);
  const disc = Math.max(0, Math.round(((Math.max(mrp, price) - price) / Math.max(mrp, price)) * 100));
  db.prepare(
    'UPDATE products SET name = COALESCE(?, name), price = ?, original_price = ?, discount_percent = ?, description = COALESCE(?, description) WHERE id = ?'
  ).run(req.body.name ?? null, price, Math.max(mrp, price), disc, req.body.description ?? null, pid);

  if (req.body.stock_qty !== undefined) {
    db.prepare("UPDATE inventory SET stock_qty = ?, updated_at = datetime('now') WHERE product_id = ?").run(
      Math.max(0, Number(req.body.stock_qty) || 0),
      pid
    );
  }
  res.json({ ok: true });
});

app.delete('/api/seller/products/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user!.id) as { id: number } | undefined;
  if (!seller) {
    res.status(403).json({ error: 'Seller account required.' });
    return;
  }
  const pid = Number(req.params.id);
  const resDel = db.prepare('DELETE FROM products WHERE id = ? AND seller_id = ?').run(pid, seller.id);
  if (resDel.changes === 0) {
    res.status(404).json({ error: 'Product not found in your store.' });
    return;
  }
  res.json({ ok: true });
});

/* ===========================
   ADMIN DASHBOARD & AUTH
=========================== */
app.get('/api/admin/status', (req: AuthenticatedRequest, res) => {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
  const claimedAdmin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1").get() as
    | { id: number; email: string }
    | undefined;
  res.json({
    configured: Boolean(envPasscode),
    claimed: Boolean(claimedAdmin),
    authenticated: req.user?.role === 'admin',
    adminEmail: req.user?.role === 'admin' ? req.user.email : null,
  });
});

app.post('/api/admin/bootstrap', (req, res) => {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
  if (envPasscode) {
    res.status(403).json({ error: 'Admin passcode is configured via environment variables.' });
    return;
  }
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) {
    res.status(409).json({ error: 'Admin account has already been claimed.' });
    return;
  }
  const { name, email, password } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400).json({ error: 'Valid admin email is required.' });
    return;
  }
  const pwErr = validatePasswordStrength(String(password || ''));
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const hash = hashPassword(String(password));
  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail) as { id: number } | undefined;
  let adminId: number;
  if (existingUser) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ?, name = COALESCE(?, name) WHERE id = ?").run(
      hash,
      name ? String(name).trim() : null,
      existingUser.id
    );
    adminId = existingUser.id;
  } else {
    const r = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run(String(name || 'Store Admin').trim(), cleanEmail, hash);
    adminId = Number(r.lastInsertRowid);
  }
  const token = signSessionToken({ uid: adminId, role: 'admin', email: cleanEmail });
  setSessionCookie(res, token);
  res.status(201).json({ ok: true, email: cleanEmail });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Admin password / passcode is required.' });
    return;
  }
  const envPasscode = process.env.ADMIN_PASSCODE?.trim() || '';
  const envEmail = (process.env.ADMIN_EMAIL?.trim() || 'admin@nexcart.in').toLowerCase();

  if (envPasscode) {
    const passBuf = Buffer.from(password);
    const envBuf = Buffer.from(envPasscode);
    if (passBuf.length === envBuf.length && crypto.timingSafeEqual(passBuf, envBuf)) {
      const token = signSessionToken({ uid: 0, role: 'admin', email: String(email || envEmail).trim().toLowerCase() });
      setSessionCookie(res, token);
      res.json({ ok: true, email: String(email || envEmail).trim().toLowerCase() });
      return;
    }
    res.status(401).json({ error: 'Invalid admin passcode.' });
    return;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const adminRow = db
    .prepare("SELECT * FROM users WHERE role = 'admin' AND (? = '' OR LOWER(email) = ?) LIMIT 1")
    .get(cleanEmail, cleanEmail) as Record<string, unknown> | undefined;

  if (!adminRow || !verifyPassword(password, String(adminRow.password_hash))) {
    res.status(401).json({ error: 'Invalid admin credentials.' });
    return;
  }

  const token = signSessionToken({ uid: Number(adminRow.id), role: 'admin', email: String(adminRow.email) });
  setSessionCookie(res, token);
  res.json({ ok: true, email: adminRow.email });
});

app.get('/api/admin/analytics', requireAdmin, (_req, res) => {
  const salesRow = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(*) AS total_orders FROM orders WHERE status != 'Cancelled'")
    .get() as { total_sales: number; total_orders: number };
  const custRow = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role != 'admin'").get() as { cnt: number };
  const prodRow = db.prepare('SELECT COUNT(*) AS cnt FROM products').get() as { cnt: number };
  const recentOrderRows = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC
       LIMIT 8`
    )
    .all() as Record<string, unknown>[];

  const categoryBreakdown = db
    .prepare(
      `SELECT c.name, COUNT(p.id) AS products, COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       GROUP BY c.id
       ORDER BY revenue DESC, products DESC`
    )
    .all();

  res.json({
    totalSales: Number(salesRow.total_sales),
    totalOrders: Number(salesRow.total_orders),
    totalCustomers: Number(custRow.cnt),
    totalProducts: Number(prodRow.cnt),
    recentOrders: hydrateOrders(recentOrderRows),
    categoryBreakdown,
  });
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
  const { dataUrl, filename } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image file data is required.' });
    return;
  }
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    res.status(400).json({ error: 'Only PNG, JPEG, or WEBP images are supported.' });
    return;
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) {
    res.status(400).json({ error: 'Image file must be under 2 MB.' });
    return;
  }
  const baseName = String(filename || 'product')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32) || 'product';
  const outName = `${baseName}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const resolvedPath = path.resolve(uploadsDir, outName);
  if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
    res.status(400).json({ error: 'Invalid file path.' });
    return;
  }
  fs.writeFileSync(resolvedPath, buf);
  res.status(201).json({ url: `/uploads/${outName}` });
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name, s.store_name AS seller_name,
              COALESCE(inv.stock_qty, 0) AS stock_qty, inv.sku
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       ORDER BY p.id DESC`
    )
    .all() as Record<string, unknown>[];
  res.json({ products: hydrateProducts(rows) });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, brand, category_id, description, original_price, price, stock_qty, images, is_top_deal, is_best_seller, is_recommended, is_trending } = req.body || {};
  if (!name || !brand || !category_id || !price) {
    res.status(400).json({ error: 'Product name, brand, category, and price are required.' });
    return;
  }
  const seller = db.prepare('SELECT id FROM sellers ORDER BY id ASC LIMIT 1').get() as { id: number } | undefined;
  if (!seller) {
    res.status(500).json({ error: 'No marketplace seller configured.' });
    return;
  }
  const mrp = Math.max(Number(original_price) || Number(price), Number(price));
  const sale = Math.max(1, Number(price));
  const disc = Math.max(0, Math.round(((mrp - sale) / mrp) * 100));

  const r = db
    .prepare(
      `INSERT INTO products (
        seller_id, category_id, slug, name, brand, description, specs_json, variants_json,
        original_price, price, discount_percent, rating, review_count,
        is_top_deal, is_best_seller, is_recommended, is_trending
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.5, 0, ?, ?, ?, ?)`
    )
    .run(
      seller.id,
      Number(category_id),
      slugify(String(name)),
      String(name).trim(),
      String(brand).trim(),
      String(description || '').trim(),
      JSON.stringify(req.body.specs || { Warranty: '1 Year' }),
      JSON.stringify(req.body.variants || { Options: ['Standard'] }),
      mrp,
      sale,
      disc,
      is_top_deal ? 1 : 0,
      is_best_seller ? 1 : 0,
      is_recommended ? 1 : 0,
      is_trending ? 1 : 0
    );
  const pid = Number(r.lastInsertRowid);
  const imgList = Array.isArray(images) ? images.filter((u: string) => isSafeImageUrl(u)) : [];
  if (imgList.length === 0) imgList.push('/src/assets/images/prod_smartphone_pro_1795581229943.jpg');
  imgList.forEach((url: string, idx: number) => {
    db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)').run(pid, url, idx);
  });
  db.prepare('INSERT INTO inventory (product_id, stock_qty, reserved_qty, sku) VALUES (?, ?, 0, ?)').run(
    pid,
    Math.max(0, Number(stock_qty) || 0),
    String(req.body.sku || `NC-ADM-${pid}`)
  );
  res.status(201).json({ ok: true, id: pid });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const pid = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  const mrp = req.body.original_price !== undefined ? Number(req.body.original_price) : Number(existing.original_price);
  const price = req.body.price !== undefined ? Number(req.body.price) : Number(existing.price);
  const disc = Math.max(0, Math.round(((Math.max(mrp, price) - price) / Math.max(mrp, price)) * 100));

  db.prepare(
    `UPDATE products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      category_id = COALESCE(?, category_id),
      description = COALESCE(?, description),
      original_price = ?,
      price = ?,
      discount_percent = ?,
      is_top_deal = COALESCE(?, is_top_deal),
      is_best_seller = COALESCE(?, is_best_seller),
      is_recommended = COALESCE(?, is_recommended),
      is_trending = COALESCE(?, is_trending)
     WHERE id = ?`
  ).run(
    req.body.name ?? null,
    req.body.brand ?? null,
    req.body.category_id ? Number(req.body.category_id) : null,
    req.body.description ?? null,
    Math.max(mrp, price),
    price,
    disc,
    typeof req.body.is_top_deal === 'boolean' ? (req.body.is_top_deal ? 1 : 0) : null,
    typeof req.body.is_best_seller === 'boolean' ? (req.body.is_best_seller ? 1 : 0) : null,
    typeof req.body.is_recommended === 'boolean' ? (req.body.is_recommended ? 1 : 0) : null,
    typeof req.body.is_trending === 'boolean' ? (req.body.is_trending ? 1 : 0) : null,
    pid
  );

  if (req.body.stock_qty !== undefined) {
    db.prepare("UPDATE inventory SET stock_qty = ?, updated_at = datetime('now') WHERE product_id = ?").run(
      Math.max(0, Number(req.body.stock_qty) || 0),
      pid
    );
  }
  if (Array.isArray(req.body.images) && req.body.images.length > 0) {
    const safeImgs = req.body.images.filter((u: string) => isSafeImageUrl(u));
    if (safeImgs.length > 0) {
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(pid);
      safeImgs.forEach((url: string, idx: number) => {
        db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)').run(pid, url, idx);
      });
    }
  }
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const pid = Number(req.params.id);
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Cannot delete a product referenced by existing orders. Set its stock to 0 instead.' });
  }
});

app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  const categories = db
    .prepare(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order ASC`
    )
    .all();
  res.json({ categories });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, description, image_url } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const img = isSafeImageUrl(String(image_url || '')) ? String(image_url) : '/src/assets/images/prod_books_backpack_1795581233133.jpg';
  const r = db
    .prepare('INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES (?, ?, ?, ?, 99)')
    .run(slug, String(name).trim(), String(description || '').trim(), img);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const cid = Number(req.params.id);
  const { name, description } = req.body || {};
  db.prepare('UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(
    name ?? null,
    description ?? null,
    cid
  );
  res.json({ ok: true });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Move or remove products in this category before deleting it.' });
  }
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC`
    )
    .all() as Record<string, unknown>[];
  res.json({ orders: hydrateOrders(rows) });
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const allowed = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Refunded'];
  const status = String(req.body?.status || '');
  if (!allowed.includes(status)) {
    res.status(400).json({ error: 'Invalid order status.' });
    return;
  }
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/coupons', requireAdmin, (_req, res) => {
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() });
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const { code, discount_type, discount_value, min_order_amount, max_discount, expires_at } = req.body || {};
  if (!code || !discount_value) {
    res.status(400).json({ error: 'Coupon code and discount value are required.' });
    return;
  }
  try {
    const r = db
      .prepare(
        'INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, active, expires_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      )
      .run(
        String(code).trim().toUpperCase(),
        discount_type === 'percent' ? 'percent' : 'flat',
        Number(discount_value),
        Number(min_order_amount) || 0,
        Number(max_discount) || 0,
        String(expires_at || '2028-12-31')
      );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'Coupon code already exists.' });
  }
});

app.put('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/customers', requireAdmin, (_req, res) => {
  const customers = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.created_at,
              COUNT(o.id) AS order_count, COALESCE(SUM(o.total_amount), 0) AS total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'Cancelled'
       WHERE u.role != 'admin'
       GROUP BY u.id
       ORDER BY u.id DESC`
    )
    .all();
  res.json({ customers });
});

app.put('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const role = req.body?.role;
  if (!['customer', 'seller'].includes(role)) {
    res.status(400).json({ error: 'Role must be customer or seller.' });
    return;
  }
  db.prepare("UPDATE users SET role = ? WHERE id = ? AND role != 'admin'").run(role, Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
  const reviews = db
    .prepare(
      `SELECT r.*, p.name AS product_name
       FROM reviews r JOIN products p ON p.id = r.product_id
       ORDER BY r.id DESC`
    )
    .all();
  res.json({ reviews });
});

app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const rid = Number(req.params.id);
  const rev = db.prepare('SELECT product_id FROM reviews WHERE id = ?').get(rid) as { product_id: number } | undefined;
  db.prepare('DELETE FROM reviews WHERE id = ?').run(rid);
  if (rev) {
    const stats = db
      .prepare('SELECT COALESCE(AVG(rating), 4.5) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE product_id = ?')
      .get(rev.product_id) as { avg_r: number; cnt: number };
    db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?').run(
      Number(Number(stats.avg_r).toFixed(1)),
      stats.cnt,
      rev.product_id
    );
  }
  res.json({ ok: true });
});

/* ===========================
   VITE / PRODUCTION STATIC
=========================== */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexCart server listening on http://localhost:${PORT}`);
  });
}

startServer();
