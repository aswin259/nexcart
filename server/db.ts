import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve(process.env.DATABASE_PATH || './nexcart.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'seller', 'admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      pincode TEXT NOT NULL,
      address_line TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      store_name TEXT NOT NULL,
      gst_number TEXT DEFAULT '',
      pan_number TEXT DEFAULT '',
      support_email TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1,
      total_earnings REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      description TEXT NOT NULL,
      specs_json TEXT NOT NULL DEFAULT '{}',
      variants_json TEXT NOT NULL DEFAULT '{}',
      original_price REAL NOT NULL,
      price REAL NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 4.5,
      review_count INTEGER NOT NULL DEFAULT 0,
      is_top_deal INTEGER NOT NULL DEFAULT 0,
      is_best_seller INTEGER NOT NULL DEFAULT 0,
      is_recommended INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      reserved_qty INTEGER NOT NULL DEFAULT 0,
      sku TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_label TEXT NOT NULL DEFAULT 'Standard',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id, variant_label)
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'flat')),
      discount_value REAL NOT NULL,
      min_order_amount REAL NOT NULL DEFAULT 0,
      max_discount REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL DEFAULT '2028-12-31'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      address_json TEXT NOT NULL,
      delivery_option TEXT NOT NULL DEFAULT 'standard',
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      delivery_charge REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      coupon_code TEXT,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'Order Placed',
      estimated_delivery TEXT NOT NULL,
      cancel_reason TEXT,
      return_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      product_image TEXT NOT NULL,
      variant_label TEXT NOT NULL DEFAULT 'Standard',
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.prepare(
    "UPDATE sellers SET store_name = 'NexCart Retail', support_email = 'support@nexcart.in' WHERE store_name = 'ShopKart Retail'"
  ).run();
  seedDatabase();
}

function seedDatabase(): void {
  const existingCategories = db.prepare('SELECT COUNT(*) AS cnt FROM categories').get() as { cnt: number };
  if (existingCategories.cnt > 0) return;

  const IMG = {
    bannerTech: '/src/assets/images/banner_electronics_flagship_1795581227834.jpg',
    bannerFashion: '/src/assets/images/banner_fashion_lifestyle_1795581228607.jpg',
    bannerHome: '/src/assets/images/banner_home_appliances_1795581229648.jpg',
    phone: '/src/assets/images/prod_smartphone_pro_1795581229943.jpg',
    audioLaptop: '/src/assets/images/prod_headphones_laptop_1795581229851.jpg',
    fashion: '/src/assets/images/prod_fashion_sneakers_1795581229836.jpg',
    chair: '/src/assets/images/prod_furniture_chair_1795581231268.jpg',
    beauty: '/src/assets/images/prod_beauty_skincare_1795581231083.jpg',
    grocery: '/src/assets/images/prod_grocery_pantry_1795581231369.jpg',
    appliance: '/src/assets/images/prod_kitchen_appliance_1795581232270.jpg',
    sports: '/src/assets/images/prod_sports_fitness_1795581232018.jpg',
    books: '/src/assets/images/prod_books_backpack_1795581233133.jpg',
  };

  // Official marketplace seller row (user_id NULL so no dummy login account exists)
  const sellerResult = db
    .prepare(
      `INSERT INTO sellers (user_id, store_name, gst_number, pan_number, support_email, verified, total_earnings)
       VALUES (NULL, ?, ?, ?, ?, 1, 0)`
    )
    .run('NexCart Retail', '29AAACS1234F1Z5', 'AAACS1234F', 'support@nexcart.in');
  const officialSellerId = Number(sellerResult.lastInsertRowid);

  const categories = [
    {
      slug: 'mobiles-electronics',
      name: 'Mobiles and Electronics',
      description: 'Flagship smartphones, laptops, noise-canceling audio, and smart accessories.',
      image: IMG.phone,
      sort: 1,
    },
    {
      slug: 'fashion-clothing',
      name: 'Fashion and Clothing',
      description: 'Tailored denim, leather sneakers, cotton essentials, and seasonal outerwear.',
      image: IMG.fashion,
      sort: 2,
    },
    {
      slug: 'home-furniture',
      name: 'Home and Furniture',
      description: 'Solid oak seating, modern lighting, and warm minimalist home accents.',
      image: IMG.chair,
      sort: 3,
    },
    {
      slug: 'beauty-personal-care',
      name: 'Beauty and Personal Care',
      description: 'Dermatologist-tested serums, ceramide moisturizers, and botanical grooming.',
      image: IMG.beauty,
      sort: 4,
    },
    {
      slug: 'grocery',
      name: 'Grocery',
      description: 'Single-origin coffee, cold-pressed oils, raw honey, and pantry staples.',
      image: IMG.grocery,
      sort: 5,
    },
    {
      slug: 'appliances',
      name: 'Appliances',
      description: 'Countertop espresso machines, smart air fryers, and quiet kitchen tech.',
      image: IMG.appliance,
      sort: 6,
    },
    {
      slug: 'sports-fitness',
      name: 'Sports and Fitness',
      description: 'Cushioned running footwear, hex dumbbells, and studio-grade yoga gear.',
      image: IMG.sports,
      sort: 7,
    },
    {
      slug: 'books-accessories',
      name: 'Books and Accessories',
      description: 'Bestselling hardcover reads, canvas commuter packs, and precision pens.',
      image: IMG.books,
      sort: 8,
    },
  ];

  const catIdBySlug: Record<string, number> = {};
  const insertCat = db.prepare(
    'INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of categories) {
    const r = insertCat.run(c.slug, c.name, c.description, c.image, c.sort);
    catIdBySlug[c.slug] = Number(r.lastInsertRowid);
  }

  const products = [
    // 1. Mobiles and Electronics
    {
      cat: 'mobiles-electronics',
      slug: 'titan-x15-pro-5g-256gb',
      name: 'Titan X15 Pro 5G (Natural Titanium, 256 GB)',
      brand: 'ApexMobile',
      desc: 'Aerospace-grade titanium frame with 6.7-inch 120Hz LTPO OLED display, 48MP triple camera system, and all-day battery life.',
      specs: { Display: '6.7" 120Hz OLED', Processor: 'A18 Octa-Core 3nm', Storage: '256 GB NVMe', Camera: '48MP + 12MP + 12MP', Battery: '4685 mAh · 45W Fast Charge', Warranty: '1 Year Manufacturer' },
      variants: { Colors: ['Natural Titanium', 'Obsidian Black', 'Cobalt Blue'], Storage: ['128 GB', '256 GB', '512 GB'] },
      mrp: 119900,
      price: 94990,
      rating: 4.8,
      reviews: 1240,
      stock: 42,
      sku: 'MOB-TX15-256',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.phone, IMG.bannerTech],
    },
    {
      cat: 'mobiles-electronics',
      slug: 'aero-studio-anc-headphones',
      name: 'Aero Studio Wireless ANC Over-Ear Headphones',
      brand: 'SoundCraft',
      desc: 'Adaptive hybrid active noise cancellation up to 46dB with custom 40mm planar drivers, multipoint Bluetooth 5.4, and 48-hour playback.',
      specs: { Driver: '40mm Dynamic Titanium', Connectivity: 'Bluetooth 5.4 + USB-C Audio', Battery: '48 Hours (ANC On)', Weight: '254 g', Charging: '10 min = 5 hrs' },
      variants: { Colors: ['Brushed Silver', 'Matte Slate'] },
      mrp: 24990,
      price: 16490,
      rating: 4.7,
      reviews: 865,
      stock: 64,
      sku: 'AUD-AERO-01',
      flags: { top: 1, best: 1, rec: 0, trend: 1 },
      images: [IMG.audioLaptop, IMG.bannerTech],
    },
    {
      cat: 'mobiles-electronics',
      slug: 'zenbook-air-14-ultrabook',
      name: 'ZenBook Air 14 M-Series Ultrabook (16GB / 512GB)',
      brand: 'NovaTech',
      desc: 'Featherlight 1.18 kg CNC aluminum laptop with 14-inch 2.8K anti-glare IPS display, backlit keyboard, and 18-hour productivity battery.',
      specs: { Display: '14" 2.8K IPS 120Hz', Memory: '16 GB LPDDR5X', Storage: '512 GB PCIe 4.0 SSD', Ports: '2x Thunderbolt 4, HDMI, Audio', Weight: '1.18 kg' },
      variants: { Colors: ['Space Silver', 'Midnight Blue'], RAM: ['16 GB', '32 GB'] },
      mrp: 98990,
      price: 78990,
      rating: 4.6,
      reviews: 412,
      stock: 19,
      sku: 'LAP-ZBA14-512',
      flags: { top: 0, best: 1, rec: 1, trend: 0 },
      images: [IMG.audioLaptop, IMG.bannerTech],
    },

    // 2. Fashion and Clothing
    {
      cat: 'fashion-clothing',
      slug: 'court-classic-leather-sneakers',
      name: 'Court Classic Full-Grain Leather Low-Top Sneakers',
      brand: 'VerveStride',
      desc: 'Hand-stitched full-grain leather upper with cushioned OrthoLite insole and durable natural rubber cupsole for everyday comfort.',
      specs: { Material: 'Full-Grain Leather', Sole: 'Vulcanized Rubber', Closure: 'Waxed Cotton Lace-Up', Care: 'Wipe with dry cloth' },
      variants: { Colors: ['White / Navy', 'Triple White'], Sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
      mrp: 5499,
      price: 3299,
      rating: 4.6,
      reviews: 530,
      stock: 85,
      sku: 'FSH-SNK-09',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.fashion, IMG.bannerFashion],
    },
    {
      cat: 'fashion-clothing',
      slug: 'raw-indigo-selvedge-overshirt',
      name: 'Heritage Raw Indigo Denim Overshirt Jacket',
      brand: 'NorthLoft',
      desc: '12.5 oz Japanese cotton twill overshirt tailored with contrast topstitching, twin chest pockets, and brushed metal buttons.',
      specs: { Fabric: '100% Cotton 12.5 oz Denim', Fit: 'Relaxed Tailored', Wash: 'Cold gentle machine wash', Origin: 'Crafted in India' },
      variants: { Colors: ['Deep Indigo', 'Washed Sky'], Sizes: ['S', 'M', 'L', 'XL'] },
      mrp: 3999,
      price: 2399,
      rating: 4.5,
      reviews: 318,
      stock: 46,
      sku: 'FSH-DNM-12',
      flags: { top: 0, best: 0, rec: 1, trend: 1 },
      images: [IMG.bannerFashion, IMG.fashion],
    },
    {
      cat: 'fashion-clothing',
      slug: 'merino-ribbed-crewneck-knit',
      name: 'Fine-Gauge Cotton Merino Crewneck Sweater',
      brand: 'NorthLoft',
      desc: 'Breathable 70% organic cotton and 30% extra-fine merino wool knit featuring ribbed cuffs and a structured collar.',
      specs: { Blend: '70% Organic Cotton, 30% Merino', Gauge: '12-Gauge Knit', Fit: 'Regular Fit' },
      variants: { Colors: ['Navy', 'Oatmeal', 'Olive'], Sizes: ['S', 'M', 'L', 'XL'] },
      mrp: 3499,
      price: 2199,
      rating: 4.4,
      reviews: 194,
      stock: 32,
      sku: 'FSH-KNT-04',
      flags: { top: 0, best: 1, rec: 0, trend: 0 },
      images: [IMG.bannerFashion, IMG.fashion],
    },

    // 3. Home and Furniture
    {
      cat: 'home-furniture',
      slug: 'nordic-solid-oak-boucle-lounge-chair',
      name: 'Nordic Solid Oak & Bouclé Accent Lounge Chair',
      brand: 'HavenCraft',
      desc: 'Kiln-dried solid European oak frame paired with high-density CertiPUR foam cushions upholstered in tactile cream bouclé.',
      specs: { Frame: 'Solid Kiln-Dried Oak', Upholstery: 'Textured Cream Bouclé', Dimensions: '74 x 78 x 81 cm', Assembly: 'Pre-assembled Frame', Warranty: '3 Years Structural' },
      variants: { Colors: ['Natural Oak / Cream', 'Walnut / Sand'] },
      mrp: 28990,
      price: 19490,
      rating: 4.8,
      reviews: 215,
      stock: 14,
      sku: 'HOM-CHR-01',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.chair, IMG.bannerHome],
    },
    {
      cat: 'home-furniture',
      slug: 'sculpted-travertine-ceramic-vase',
      name: 'Artisan Fluted Matte Ceramic Table Vase',
      brand: 'HavenCraft',
      desc: 'Wheel-thrown matte stoneware vase finished in a warm travertine glaze—ideal for dried botanicals or fresh stems.',
      specs: { Material: 'High-Fired Stoneware', Height: '28 cm', Finish: 'Matte Travertine' },
      variants: { Colors: ['Warm Limestone', 'Sandstone'] },
      mrp: 2499,
      price: 1499,
      rating: 4.6,
      reviews: 142,
      stock: 50,
      sku: 'HOM-VAS-03',
      flags: { top: 0, best: 0, rec: 1, trend: 0 },
      images: [IMG.bannerHome, IMG.chair],
    },
    {
      cat: 'home-furniture',
      slug: 'solid-oak-minimalist-side-table',
      name: 'Low-Profile Solid Oak Coffee & Book Bench',
      brand: 'TimberLine',
      desc: 'Compact architectural side table crafted from sustainably harvested oak with concealed mortise joinery.',
      specs: { Material: 'Solid Oak Wood', Dimensions: '90 x 45 x 34 cm', LoadCapacity: '65 kg' },
      variants: { Colors: ['Natural Oak', 'Smoked Oak'] },
      mrp: 12990,
      price: 8990,
      rating: 4.5,
      reviews: 89,
      stock: 22,
      sku: 'HOM-TBL-02',
      flags: { top: 0, best: 0, rec: 0, trend: 1 },
      images: [IMG.chair, IMG.bannerHome],
    },

    // 4. Beauty and Personal Care
    {
      cat: 'beauty-personal-care',
      slug: 'aura-botanics-vitamin-c-15-serum',
      name: 'Aura Botanics 15% Vitamin C + Hyaluronic Glow Serum (30ml)',
      brand: 'AuraBotanics',
      desc: 'Stabilized L-Ascorbic Acid 15% serum paired with multi-molecular hyaluronic acid and ferulic acid for brighter, firmer skin.',
      specs: { Actives: '15% Vitamin C, 1% Ferulic, Hyaluronic', Volume: '30 ml Amber Dropper', SkinType: 'All Skin Types', DermatologistTested: 'Yes · Fragrance Free' },
      variants: { Sizes: ['30 ml', '50 ml'] },
      mrp: 1299,
      price: 899,
      rating: 4.7,
      reviews: 1840,
      stock: 150,
      sku: 'BTY-VITC-30',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.beauty],
    },
    {
      cat: 'beauty-personal-care',
      slug: 'lumina-ceramide-barrier-moisturizer',
      name: 'Lumina Hydration 5-Ceramide + Peptide Daily Cream (50ml)',
      brand: 'LuminaSkin',
      desc: 'Rich non-comedogenic barrier repair moisturizer formulated with 5 bio-identical ceramides, squalane, and soothing peptides.',
      specs: { KeyIngredients: '5 Ceramides, Matrixyl Peptides, Squalane', Volume: '50 ml Jar', Texture: 'Whipped Gel-Cream' },
      variants: { Sizes: ['50 ml', '100 ml'] },
      mrp: 1499,
      price: 1049,
      rating: 4.6,
      reviews: 920,
      stock: 98,
      sku: 'BTY-MOIST-50',
      flags: { top: 0, best: 1, rec: 1, trend: 0 },
      images: [IMG.beauty],
    },
    {
      cat: 'beauty-personal-care',
      slug: 'lumina-am-pm-skincare-duo',
      name: 'AM/PM Radiance Serum & Ceramide Barrier Kit',
      brand: 'AuraBotanics',
      desc: 'Complete daily skincare duo combining brightening 15% Vitamin C serum and deep-hydrating Ceramide Peptide cream.',
      specs: { Includes: '30ml Serum + 50ml Cream', CrueltyFree: '100% Vegan & Paraben-Free' },
      variants: { Editions: ['Standard Duo', 'Gift Box'] },
      mrp: 2798,
      price: 1799,
      rating: 4.8,
      reviews: 410,
      stock: 60,
      sku: 'BTY-DUO-01',
      flags: { top: 1, best: 0, rec: 0, trend: 1 },
      images: [IMG.beauty],
    },

    // 5. Grocery
    {
      cat: 'grocery',
      slug: 'sumatra-reserve-dark-roast-coffee',
      name: 'Sumatra Reserve Single-Origin Dark Roast Coffee (340g)',
      brand: 'SilverLeaf',
      desc: 'Small-batch 100% Arabica whole bean coffee featuring tasting notes of dark cacao, roasted hazelnut, and caramelized brown sugar.',
      specs: { Roast: 'Dark Roast · Whole Bean', Origin: 'Single-Origin Sumatra', Weight: '340 g Aroma-Seal Bag', ShelfLife: '9 Months' },
      variants: { Grind: ['Whole Bean', 'Espresso Fine', 'French Press Coarse'] },
      mrp: 799,
      price: 599,
      rating: 4.8,
      reviews: 670,
      stock: 110,
      sku: 'GRC-COF-340',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.grocery],
    },
    {
      cat: 'grocery',
      slug: 'cold-pressed-extra-virgin-olive-oil',
      name: 'Silver Leaf First Cold-Pressed Extra Virgin Olive Oil (750ml)',
      brand: 'SilverLeaf',
      desc: 'Single-estate Spanish extra virgin olive oil harvested early and cold-extracted within 4 hours for vibrant polyphenol richness.',
      specs: { Acidity: '< 0.25%', Volume: '750 ml Dark Glass Bottle', Origin: 'Andalusia, Spain' },
      variants: { Sizes: ['500 ml', '750 ml', '1 Litre'] },
      mrp: 1599,
      price: 1199,
      rating: 4.7,
      reviews: 512,
      stock: 76,
      sku: 'GRC-OIL-750',
      flags: { top: 0, best: 1, rec: 1, trend: 0 },
      images: [IMG.grocery],
    },
    {
      cat: 'grocery',
      slug: 'wild-bloom-unfiltered-raw-honey',
      name: 'Wild Bloom Unfiltered Organic Raw Wildflower Honey (454g)',
      brand: 'WildBloom',
      desc: 'Pure unheated wildflower honey packed in reusable glass jars with wooden dipper, preserving natural enzymes and floral aroma.',
      specs: { Purity: '100% NMR Tested Pure', Weight: '454 g Glass Jar', Additives: 'Zero Added Sugar' },
      variants: { Sizes: ['454 g', '900 g'] },
      mrp: 649,
      price: 479,
      rating: 4.6,
      reviews: 389,
      stock: 140,
      sku: 'GRC-HNY-454',
      flags: { top: 0, best: 0, rec: 1, trend: 1 },
      images: [IMG.grocery],
    },

    // 6. Appliances
    {
      cat: 'appliances',
      slug: 'aurora-barista-pro-espresso-machine',
      name: 'Aurora Barista Pro 15-Bar Espresso Maker with Conical Grinder',
      brand: 'AuroraHome',
      desc: 'Brushed stainless steel espresso station with integrated burr grinder, PID digital temperature control, pressure gauge, and steam wand.',
      specs: { Pressure: '15-Bar Italian Pump', Grinder: '18-Setting Conical Burr', Tank: '2.0 L Removable', Power: '1450W · 230V', Warranty: '2 Years Onsite' },
      variants: { Finishes: ['Brushed Steel', 'Matte Black'] },
      mrp: 42990,
      price: 31990,
      rating: 4.8,
      reviews: 348,
      stock: 16,
      sku: 'APP-ESP-01',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.appliance, IMG.bannerHome],
    },
    {
      cat: 'appliances',
      slug: 'aurora-digital-smart-air-fryer-6l',
      name: 'Aurora CrispPro 6L Digital Stainless Smart Air Fryer',
      brand: 'AuroraHome',
      desc: 'Rapid 360-degree vortex convection air fryer with 8 one-touch presets, dishwasher-safe basket, and up to 85% less oil.',
      specs: { Capacity: '6.0 Litres', Wattage: '1700W', TempRange: '80°C – 200°C', Display: 'LED Touch Panel' },
      variants: { Colors: ['Brushed Steel / Black'] },
      mrp: 11990,
      price: 7490,
      rating: 4.6,
      reviews: 740,
      stock: 38,
      sku: 'APP-AIR-06',
      flags: { top: 1, best: 1, rec: 0, trend: 1 },
      images: [IMG.bannerHome, IMG.appliance],
    },
    {
      cat: 'appliances',
      slug: 'aurora-matte-manual-espresso-brewer',
      name: 'Aurora Studio Matte Black Espresso Brewer',
      brand: 'AuroraHome',
      desc: 'Compact café-grade espresso brewer engineered with a brass boiler, 58mm commercial portafilter, and microfoam steam wand.',
      specs: { Boiler: 'Thermal Block PID', Portafilter: '58mm Stainless', Warranty: '2 Years' },
      variants: { Colors: ['Matte Black'] },
      mrp: 32990,
      price: 25990,
      rating: 4.7,
      reviews: 155,
      stock: 11,
      sku: 'APP-ESP-02',
      flags: { top: 0, best: 0, rec: 1, trend: 0 },
      images: [IMG.bannerHome, IMG.appliance],
    },

    // 7. Sports and Fitness
    {
      cat: 'sports-fitness',
      slug: 'stridepro-nitrogen-running-shoes',
      name: 'StridePro Ghost Nitrogen-Cushioned Road Running Shoes',
      brand: 'StridePro',
      desc: 'Engineered breathable mesh upper with responsive nitrogen-infused midsole foam and high-abrasion carbon rubber outsole.',
      specs: { Drop: '8mm Heel-to-Toe', Weight: '248 g', Surface: 'Road & Track', Upper: '3D Engineered Mesh' },
      variants: { Colors: ['Carbon Black', 'Slate Blue'], Sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'] },
      mrp: 8999,
      price: 5999,
      rating: 4.7,
      reviews: 620,
      stock: 54,
      sku: 'SPT-RUN-01',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.sports],
    },
    {
      cat: 'sports-fitness',
      slug: 'ironcore-10kg-hex-dumbbell-pair',
      name: 'IronCore Rubber-Encased Hex Dumbbell Pair (2 x 10 kg)',
      brand: 'IronCore',
      desc: 'Anti-roll hexagonal cast iron heads coated in low-odor virgin rubber with ergonomic chrome-knurled steel handles.',
      specs: { Weight: '20 kg Total (Pair of 10 kg)', Grip: 'Knurled Chrome Steel', Coating: 'Virgin Rubber Anti-Roll' },
      variants: { Weights: ['5 kg Pair', '10 kg Pair', '15 kg Pair'] },
      mrp: 4999,
      price: 3499,
      rating: 4.8,
      reviews: 445,
      stock: 30,
      sku: 'SPT-DMB-10',
      flags: { top: 0, best: 1, rec: 0, trend: 1 },
      images: [IMG.sports],
    },
    {
      cat: 'sports-fitness',
      slug: 'zenflow-6mm-tpe-pro-yoga-mat',
      name: 'ZenFlow 6mm Dual-Grip Alignment Yoga & Pilates Mat',
      brand: 'ZenFlow',
      desc: 'Eco-friendly closed-cell TPE mat with non-slip wave underside, carrying strap, and 6mm joint-cushioning thickness.',
      specs: { Dimensions: '183 x 61 cm', Thickness: '6 mm', Material: 'High-Density Eco TPE', Included: 'Nylon Carry Strap' },
      variants: { Colors: ['Midnight Navy', 'Charcoal'] },
      mrp: 1999,
      price: 1299,
      rating: 4.5,
      reviews: 280,
      stock: 92,
      sku: 'SPT-MAT-06',
      flags: { top: 0, best: 0, rec: 1, trend: 0 },
      images: [IMG.sports],
    },

    // 8. Books and Accessories
    {
      cat: 'books-accessories',
      slug: 'heritage-canvas-leather-commuter-backpack',
      name: 'Heritage Waxed Canvas & Saddle Leather Laptop Backpack (22L)',
      brand: 'NomadCarry',
      desc: 'Water-resistant 16 oz waxed cotton canvas commuter pack with full-grain vegetable-tanned leather straps and padded 16" laptop sleeve.',
      specs: { Capacity: '22 Litres', LaptopFit: 'Up to 16 inches', Material: '16 oz Waxed Canvas & Leather', Hardware: 'Solid Brass Buckles' },
      variants: { Colors: ['Slate / Cognac', 'Charcoal / Tan'] },
      mrp: 6999,
      price: 4699,
      rating: 4.8,
      reviews: 392,
      stock: 37,
      sku: 'ACC-BAG-22',
      flags: { top: 1, best: 1, rec: 1, trend: 1 },
      images: [IMG.books],
    },
    {
      cat: 'books-accessories',
      slug: 'mindful-living-hardcover-5-book-box-set',
      name: 'Modern Clarity Hardcover 5-Book Collector Box Set',
      brand: 'folioPress',
      desc: 'Curated cloth-bound hardcover collection featuring Essentialism, Quiet, Calm, Minimalism, and Slow Living on archival acid-free paper.',
      specs: { Format: '5 Cloth-Bound Hardcovers', Language: 'English', Pages: '1,420 Total Pages', Publisher: 'Folio Press' },
      variants: { Editions: ['Collector Hardcover Set'] },
      mrp: 3999,
      price: 2599,
      rating: 4.9,
      reviews: 518,
      stock: 44,
      sku: 'BKS-SET-05',
      flags: { top: 1, best: 1, rec: 1, trend: 0 },
      images: [IMG.books],
    },
    {
      cat: 'books-accessories',
      slug: 'solid-brass-machined-fountain-pen',
      name: 'Atelier Solid Machined Brass Fountain Pen (Fine Nib)',
      brand: 'AtelierInk',
      desc: 'CNC-turned solid brass fountain pen fitted with a smooth German stainless steel fine nib and refillable ink converter.',
      specs: { Body: 'Solid C360 Brass', Nib: 'Fine 0.5mm German Steel', Refill: 'Standard International / Converter' },
      variants: { NibSize: ['Extra Fine', 'Fine', 'Medium'] },
      mrp: 2999,
      price: 2199,
      rating: 4.7,
      reviews: 164,
      stock: 51,
      sku: 'ACC-PEN-01',
      flags: { top: 0, best: 0, rec: 1, trend: 1 },
      images: [IMG.books],
    },
  ];

  const insertProd = db.prepare(
    `INSERT INTO products (
      seller_id, category_id, slug, name, brand, description,
      specs_json, variants_json, original_price, price, discount_percent,
      rating, review_count, is_top_deal, is_best_seller, is_recommended, is_trending
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertImg = db.prepare(
    'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)'
  );
  const insertInv = db.prepare(
    'INSERT INTO inventory (product_id, stock_qty, reserved_qty, sku) VALUES (?, ?, 0, ?)'
  );
  const insertReview = db.prepare(
    'INSERT INTO reviews (product_id, user_id, author_name, rating, title, comment, verified_purchase) VALUES (?, NULL, ?, ?, ?, ?, 1)'
  );

  const sampleReviewers = [
    { name: 'Aarav Mehta', rating: 5, title: 'Outstanding build & fast delivery', comment: 'Arrived in 2 days neatly packed. Quality genuinely feels flagship-grade and matches all listed specs.' },
    { name: 'Priya Nair', rating: 4, title: 'Great value at the discounted price', comment: 'Using it daily for two weeks now. Very reliable performance and crisp finish.' },
  ];

  for (const p of products) {
    const disc = Math.max(0, Math.round(((p.mrp - p.price) / p.mrp) * 100));
    const res = insertProd.run(
      officialSellerId,
      catIdBySlug[p.cat],
      p.slug,
      p.name,
      p.brand,
      p.desc,
      JSON.stringify(p.specs),
      JSON.stringify(p.variants),
      p.mrp,
      p.price,
      disc,
      p.rating,
      p.reviews,
      p.flags.top,
      p.flags.best,
      p.flags.rec,
      p.flags.trend
    );
    const pid = Number(res.lastInsertRowid);
    p.images.forEach((url, idx) => insertImg.run(pid, url, idx));
    insertInv.run(pid, p.stock, p.sku);
    for (const r of sampleReviewers) {
      insertReview.run(pid, r.name, r.rating, r.title, r.comment);
    }
  }

  const insertCoupon = db.prepare(
    `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, '2028-12-31')`
  );
  insertCoupon.run('WELCOME10', 'percent', 10, 999, 1000);
  insertCoupon.run('SAVE500', 'flat', 500, 2999, 500);
  insertCoupon.run('FREESHIP', 'flat', 99, 499, 99);
}
