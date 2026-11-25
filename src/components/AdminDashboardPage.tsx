import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Edit3,
  FolderKanban,
  IndianRupee,
  Lock,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatDateShort, formatINR } from '../lib/format';
import type { Category, Coupon, Order, Product, Review } from '../types';
import { SmartImage } from './SmartImage';

interface AdminStatus {
  configured: boolean;
  claimed: boolean;
  authenticated: boolean;
  adminEmail: string | null;
}

interface AnalyticsData {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  recentOrders: Order[];
  categoryBreakdown: { name: string; products: number; revenue: number }[];
}

interface CustomerRow {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: 'customer' | 'seller';
  created_at: string;
  order_count: number;
  total_spent: number;
}

interface AdminReviewRow extends Review {
  product_name: string;
}

type AdminTab = 'overview' | 'products' | 'categories' | 'orders' | 'coupons' | 'customers' | 'reviews';

const ORDER_STATUSES: Order['status'][] = [
  'Order Placed',
  'Confirmed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Return Requested',
  'Refunded',
];

const BUILTIN_IMAGES = [
  '/src/assets/images/prod_smartphone_pro_1795581229943.jpg',
  '/src/assets/images/prod_headphones_laptop_1795581229851.jpg',
  '/src/assets/images/prod_fashion_sneakers_1795581229836.jpg',
  '/src/assets/images/prod_furniture_chair_1795581231268.jpg',
  '/src/assets/images/prod_beauty_skincare_1795581231083.jpg',
  '/src/assets/images/prod_grocery_pantry_1795581231369.jpg',
  '/src/assets/images/prod_kitchen_appliance_1795581232270.jpg',
  '/src/assets/images/prod_sports_fitness_1795581232018.jpg',
  '/src/assets/images/prod_books_backpack_1795581233133.jpg',
];

export function AdminDashboardPage() {
  const { navigate, showToast, refreshAuth, refreshCategories } = useStore();

  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Auth / First-run bootstrap state
  const [adminName, setAdminName] = useState('Store Admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Dashboard Datasets
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Product Editor Form
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pCategoryId, setPCategoryId] = useState<number>(0);
  const [pPrice, setPPrice] = useState('');
  const [pOriginalPrice, setPOriginalPrice] = useState('');
  const [pStock, setPStock] = useState('25');
  const [pDesc, setPDesc] = useState('');
  const [pImageUrl, setPImageUrl] = useState(BUILTIN_IMAGES[0]);
  const [pTopDeal, setPTopDeal] = useState(false);
  const [pBestSeller, setPBestSeller] = useState(false);
  const [pRecommended, setPRecommended] = useState(true);
  const [pTrending, setPTrending] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Category Form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState(BUILTIN_IMAGES[0]);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Coupon Form
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percent' | 'flat'>('percent');
  const [coupVal, setCoupVal] = useState('');
  const [coupMin, setCoupMin] = useState('499');
  const [coupMax, setCoupMax] = useState('1000');
  const [coupExp, setCoupExp] = useState('2028-12-31');

  const checkAdminStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await apiFetch<AdminStatus>('/api/admin/status');
      setStatus(s);
    } catch {
      setStatus({ configured: false, claimed: false, authenticated: false, adminEmail: null });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadAllAdminData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [an, pr, ca, or, cp, cu, rv] = await Promise.all([
        apiFetch<AnalyticsData>('/api/admin/analytics'),
        apiFetch<{ products: Product[] }>('/api/admin/products'),
        apiFetch<{ categories: Category[] }>('/api/admin/categories'),
        apiFetch<{ orders: Order[] }>('/api/admin/orders'),
        apiFetch<{ coupons: Coupon[] }>('/api/admin/coupons'),
        apiFetch<{ customers: CustomerRow[] }>('/api/admin/customers'),
        apiFetch<{ reviews: AdminReviewRow[] }>('/api/admin/reviews'),
      ]);
      setAnalytics(an);
      setProducts(pr.products);
      setCategories(ca.categories);
      setOrders(or.orders);
      setCoupons(cp.coupons);
      setCustomers(cu.customers);
      setReviews(rv.reviews);
      if (ca.categories.length > 0 && pCategoryId === 0) {
        setPCategoryId(ca.categories[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load admin console.', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [showToast, pCategoryId]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  useEffect(() => {
    if (status?.authenticated) {
      loadAllAdminData();
    }
  }, [status?.authenticated, loadAllAdminData]);

  const handleAdminBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    try {
      await apiFetch('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });
      showToast('Admin account created and signed in.', 'success');
      setAdminPassword('');
      await refreshAuth();
      await checkAdminStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to claim admin account.', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    try {
      await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });
      showToast('Signed in to NexCart Admin Console.', 'success');
      setAdminPassword('');
      await refreshAuth();
      await checkAdminStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid admin credentials.', 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const openCreateProduct = () => {
    setEditingProductId(null);
    setPName('');
    setPBrand('');
    setPCategoryId(categories[0]?.id || 1);
    setPPrice('');
    setPOriginalPrice('');
    setPStock('25');
    setPDesc('');
    setPImageUrl(BUILTIN_IMAGES[0]);
    setPTopDeal(false);
    setPBestSeller(false);
    setPRecommended(true);
    setPTrending(false);
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setPName(p.name);
    setPBrand(p.brand);
    setPCategoryId(p.category_id);
    setPPrice(String(p.price));
    setPOriginalPrice(String(p.original_price));
    setPStock(String(p.stock_qty));
    setPDesc(p.description);
    setPImageUrl(p.images[0] || BUILTIN_IMAGES[0]);
    setPTopDeal(Boolean(p.is_top_deal));
    setPBestSeller(Boolean(p.is_best_seller));
    setPRecommended(Boolean(p.is_recommended));
    setPTrending(Boolean(p.is_trending));
    setShowProductModal(true);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image file must be under 2 MB.', 'error');
      return;
    }
    setUploadingImg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({
            dataUrl: String(reader.result || ''),
            filename: file.name,
          }),
        });
        setPImageUrl(res.url);
        showToast('Product image uploaded.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Image upload failed.', 'error');
      } finally {
        setUploadingImg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(pPrice);
    const mrpNum = Number(pOriginalPrice) || priceNum;
    if (!pName.trim() || !pBrand.trim() || !priceNum || priceNum <= 0) {
      showToast('Name, brand, and valid selling price are required.', 'error');
      return;
    }
    const payload = {
      name: pName.trim(),
      brand: pBrand.trim(),
      category_id: pCategoryId,
      description: pDesc.trim(),
      original_price: Math.max(mrpNum, priceNum),
      price: priceNum,
      stock_qty: Math.max(0, Number(pStock) || 0),
      images: [pImageUrl.trim()],
      is_top_deal: pTopDeal,
      is_best_seller: pBestSeller,
      is_recommended: pRecommended,
      is_trending: pTrending,
    };

    try {
      if (editingProductId) {
        await apiFetch(`/api/admin/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Product updated on storefront.', 'success');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('New product added to storefront.', 'success');
      }
      setShowProductModal(false);
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save product.', 'error');
    }
  };

  const handleQuickStockChange = async (productId: number, newStock: number) => {
    try {
      await apiFetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ stock_qty: Math.max(0, newStock) }),
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock_qty: Math.max(0, newStock) } : p))
      );
      showToast('Inventory updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Stock update failed.', 'error');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await apiFetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      showToast('Product deleted.', 'info');
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete product.', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await apiFetch('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName.trim(), description: catDesc.trim(), image_url: catImage }),
      });
      setCatName('');
      setCatDesc('');
      showToast('Category created.', 'success');
      await Promise.all([loadAllAdminData(), refreshCategories()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Category error.', 'error');
    }
  };

  const handleSaveCategory = async (id: number) => {
    try {
      await apiFetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editCatName.trim(), description: editCatDesc.trim() }),
      });
      setEditingCatId(null);
      showToast('Category updated.', 'success');
      await Promise.all([loadAllAdminData(), refreshCategories()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update category.', 'error');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      showToast('Category deleted.', 'info');
      await Promise.all([loadAllAdminData(), refreshCategories()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot delete category.', 'error');
    }
  };

  const handleOrderStatusChange = async (orderId: number, newStatus: Order['status']) => {
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      showToast(`Order status changed to ${newStatus}.`, 'success');
      const an = await apiFetch<AnalyticsData>('/api/admin/analytics');
      setAnalytics(an);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupCode.trim() || !Number(coupVal)) return;
    try {
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: coupCode.trim().toUpperCase(),
          discount_type: coupType,
          discount_value: Number(coupVal),
          min_order_amount: Number(coupMin) || 0,
          max_discount: Number(coupMax) || 0,
          expires_at: coupExp,
        }),
      });
      setCoupCode('');
      setCoupVal('');
      showToast('Coupon published.', 'success');
      await loadAllAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Coupon creation failed.', 'error');
    }
  };

  const handleToggleCoupon = async (c: Coupon) => {
    try {
      await apiFetch(`/api/admin/coupons/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !c.active }),
      });
      setCoupons((prev) => prev.map((item) => (item.id === c.id ? { ...item, active: c.active ? 0 : 1 } : item)));
      showToast(`Coupon ${c.code} ${c.active ? 'paused' : 'activated'}.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update coupon.', 'error');
    }
  };

  const handleDeleteCoupon = async (id: number) => {
    try {
      await apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      showToast('Coupon removed.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const handleCustomerRole = async (id: number, role: 'customer' | 'seller') => {
    try {
      await apiFetch(`/api/admin/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, role } : c)));
      showToast('Customer account role updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Role update failed.', 'error');
    }
  };

  const handleDeleteReview = async (id: number) => {
    try {
      await apiFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      setReviews((prev) => prev.filter((r) => r.id !== id));
      showToast('Review removed and product rating recalculated.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  if (statusLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-12">
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-8 animate-pulse h-64" />
      </div>
    );
  }

  /* ===========================
     ADMIN AUTH / FIRST-RUN GATE
     =========================== */
  if (!status?.authenticated) {
    const needsFirstRunClaim = !status?.configured && !status?.claimed;
    return (
      <div className="max-w-[480px] mx-auto px-4 py-12">
        <div className="bg-white border border-[#E0E4EB] rounded-sm shadow-sm overflow-hidden">
          <div className="bg-[#172337] text-white px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#2874F0] flex items-center justify-center shrink-0">
              {needsFirstRunClaim ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {needsFirstRunClaim ? 'Claim Store Admin Account' : 'NexCart Admin Console'}
              </h1>
              <p className="text-xs text-white/75">
                {needsFirstRunClaim
                  ? 'Set up your primary administrator credentials to unlock full store controls.'
                  : 'Authorized administrator sign-in required.'}
              </p>
            </div>
          </div>

          {needsFirstRunClaim ? (
            <form onSubmit={handleAdminBootstrap} className="p-6 space-y-4">
              <div className="bg-[#2874F0]/5 border border-[#2874F0]/20 rounded-sm p-3 text-xs text-[#212121]">
                First-time setup: Create your administrator login. Passwords require at least 8 characters with uppercase, lowercase, and a digit.
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Admin Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@yourstore.in"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Strong password (8+ chars)"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-[#2874F0] hover:bg-[#1d63d8] disabled:opacity-60 text-white text-sm font-semibold rounded-sm"
              >
                {authSubmitting ? 'Creating Admin...' : 'Claim Admin & Enter Console'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              {!status?.configured && (
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@yourstore.in"
                    className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  {status?.configured ? 'Admin Passcode' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={status?.configured ? 'Enter configured admin passcode' : 'Enter admin password'}
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-[#2874F0] hover:bg-[#1d63d8] disabled:opacity-60 text-white text-sm font-semibold rounded-sm"
              >
                {authSubmitting ? 'Verifying...' : 'Sign In to Admin Dashboard'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2 text-xs text-[#616161] hover:text-[#212121]"
              >
                Return to Storefront
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const maxRev = Math.max(1, ...(analytics?.categoryBreakdown.map((c) => c.revenue) || [1]));

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Top Bar */}
      <div className="bg-[#172337] text-white rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-sm bg-[#2874F0] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">NexCart Admin Console</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-[#388E3C] text-white">
                Live Store Sync
              </span>
            </div>
            <p className="text-xs text-white/75">Signed in as {status.adminEmail || 'Administrator'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FB641B] hover:bg-[#e55610] text-white text-sm font-semibold rounded-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-sm"
          >
            View Storefront
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Total Sales</span>
            <IndianRupee className="w-4 h-4 text-[#388E3C]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {formatINR(analytics?.totalSales || 0)}
          </p>
        </div>
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#2874F0]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {analytics?.totalOrders || 0}
          </p>
        </div>
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Customers</span>
            <Users className="w-4 h-4 text-[#FF9F00]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {analytics?.totalCustomers || 0}
          </p>
        </div>
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Catalog Products</span>
            <Package className="w-4 h-4 text-[#2874F0]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {analytics?.totalProducts || 0}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border border-[#E0E4EB] rounded-sm">
        <div className="flex border-b border-[#E0E4EB] overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Analytics & Recent', icon: BarChart3 },
            { id: 'products', label: `Products (${products.length})`, icon: Package },
            { id: 'categories', label: `Categories (${categories.length})`, icon: FolderKanban },
            { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingBag },
            { id: 'coupons', label: `Coupons (${coupons.length})`, icon: Tag },
            { id: 'customers', label: `Customers (${customers.length})`, icon: Users },
            { id: 'reviews', label: `Reviews (${reviews.length})`, icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#2874F0] text-[#2874F0] bg-[#2874F0]/5'
                    : 'border-transparent text-[#616161] hover:text-[#212121]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {dataLoading && !analytics ? (
          <div className="p-8 text-center text-sm text-[#616161]">Loading store telemetry...</div>
        ) : (
          <div className="p-4 sm:p-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 border border-[#E0E4EB] rounded-sm p-4">
                  <h2 className="text-sm font-bold text-[#212121] uppercase tracking-wide mb-4">
                    Sales Analytics by Category
                  </h2>
                  <div className="space-y-3">
                    {analytics?.categoryBreakdown.map((cat) => {
                      const pct = Math.max(4, Math.round((cat.revenue / maxRev) * 100));
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-[#212121]">{cat.name}</span>
                            <span className="font-mono-num text-[#616161]">
                              {formatINR(cat.revenue)} · {cat.products} SKUs
                            </span>
                          </div>
                          <div className="h-2 bg-[#F1F3F6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2874F0] rounded-full"
                              style={{ width: `${cat.revenue > 0 ? pct : 3}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-3 border border-[#E0E4EB] rounded-sm p-4">
                  <h2 className="text-sm font-bold text-[#212121] uppercase tracking-wide mb-4">
                    Recent Orders
                  </h2>
                  {(!analytics?.recentOrders || analytics.recentOrders.length === 0) ? (
                    <p className="text-sm text-[#616161] py-8 text-center">
                      No orders placed yet. Orders placed via checkout appear here immediately.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#E0E4EB] text-xs text-[#616161] uppercase">
                            <th className="py-2 pr-3">Order</th>
                            <th className="py-2 px-3">Customer</th>
                            <th className="py-2 px-3">Total</th>
                            <th className="py-2 pl-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F3F6]">
                          {analytics.recentOrders.map((o) => (
                            <tr key={o.id}>
                              <td className="py-2.5 pr-3 font-mono-num font-semibold text-[#2874F0]">
                                {o.order_number}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-[#212121]">{o.customer_name || o.address.full_name}</div>
                                <div className="text-xs text-[#616161]">{o.payment_method}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono-num font-semibold">
                                {formatINR(o.total_amount)}
                              </td>
                              <td className="py-2.5 pl-3 text-right">
                                <span className="inline-flex px-2 py-0.5 rounded-sm text-xs font-semibold bg-[#2874F0]/10 text-[#2874F0]">
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRODUCTS & INVENTORY TAB */}
            {activeTab === 'products' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[#616161]">
                    Edit prices, update live stock levels, upload images, or feature deals on the homepage.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateProduct}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2874F0] text-white text-sm font-semibold rounded-sm"
                  >
                    <Plus className="w-4 h-4" /> New Product
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E0E4EB] text-xs font-semibold uppercase text-[#616161]">
                        <th className="py-3 pr-4">Product</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Price</th>
                        <th className="py-3 px-3">Stock Qty</th>
                        <th className="py-3 px-3">Highlights</th>
                        <th className="py-3 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F3F6]">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-[#F7F9FC]">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3 min-w-[230px]">
                              <SmartImage
                                src={p.images[0]}
                                alt={p.name}
                                className="w-11 h-11 rounded-sm object-contain bg-[#F7F9FC] border border-[#E0E4EB] shrink-0"
                              />
                              <div>
                                <div className="font-semibold text-[#212121] line-clamp-1">{p.name}</div>
                                <div className="text-xs text-[#616161]">
                                  {p.brand} · {p.seller_name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-[#616161] whitespace-nowrap">
                            {p.category_name}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-mono-num">
                            <span className="font-semibold text-[#212121]">{formatINR(p.price)}</span>
                            {p.discount_percent > 0 && (
                              <span className="text-xs text-[#388E3C] ml-1.5">{p.discount_percent}% off</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <input
                              type="number"
                              min={0}
                              defaultValue={p.stock_qty}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (!Number.isNaN(val) && val !== p.stock_qty) {
                                  handleQuickStockChange(p.id, val);
                                }
                              }}
                              className="w-20 px-2 py-1 border border-[#E0E4EB] rounded-sm text-xs font-mono-num focus:border-[#2874F0] focus:outline-none"
                              aria-label={`Stock for ${p.name}`}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {p.is_top_deal === 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#FF9F00]/15 text-[#b56d00] rounded-sm">
                                  Top Deal
                                </span>
                              )}
                              {p.is_best_seller === 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#388E3C]/10 text-[#388E3C] rounded-sm">
                                  Best Seller
                                </span>
                              )}
                              {p.is_trending === 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#2874F0]/10 text-[#2874F0] rounded-sm">
                                  Trending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#E0E4EB] rounded-sm text-xs font-medium text-[#2874F0] hover:bg-[#2874F0]/5"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 border border-[#E0E4EB] rounded-sm text-red-600 hover:bg-red-50"
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <form onSubmit={handleCreateCategory} className="border border-[#E0E4EB] rounded-sm p-4 space-y-3 h-fit">
                  <h3 className="text-sm font-bold text-[#212121]">Add Category</h3>
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g., Toys & Baby Care"
                      className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Short category subtitle"
                      className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                      Thumbnail Image
                    </label>
                    <select
                      value={catImage}
                      onChange={(e) => setCatImage(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm bg-white"
                    >
                      {BUILTIN_IMAGES.map((u) => (
                        <option key={u} value={u}>
                          {u.split('/').pop()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#2874F0] text-white text-sm font-semibold rounded-sm hover:bg-[#1d63d8]"
                  >
                    Create Category
                  </button>
                </form>

                <div className="lg:col-span-2 divide-y divide-[#F1F3F6] border border-[#E0E4EB] rounded-sm">
                  {categories.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                      {editingCatId === c.id ? (
                        <div className="flex-1 flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="px-3 py-1.5 border border-[#2874F0] rounded-sm text-sm"
                          />
                          <input
                            type="text"
                            value={editCatDesc}
                            onChange={(e) => setEditCatDesc(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-[#E0E4EB] rounded-sm text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCategory(c.id)}
                            className="px-3 py-1.5 bg-[#388E3C] text-white text-xs font-semibold rounded-sm"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="px-3 py-1.5 border border-[#E0E4EB] text-xs rounded-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <SmartImage
                              src={c.image_url}
                              alt={c.name}
                              className="w-11 h-11 rounded-sm object-contain bg-[#F7F9FC] border border-[#E0E4EB]"
                            />
                            <div>
                              <p className="font-semibold text-sm text-[#212121]">{c.name}</p>
                              <p className="text-xs text-[#616161]">
                                /{c.slug} · {c.product_count || 0} products
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(c.id);
                                setEditCatName(c.name);
                                setEditCatDesc(c.description);
                              }}
                              className="px-2.5 py-1 border border-[#E0E4EB] rounded-sm text-xs text-[#2874F0]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(c.id)}
                              className="p-1.5 border border-[#E0E4EB] rounded-sm text-red-600 hover:bg-red-50"
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <p className="text-sm text-[#616161] text-center py-10">No customer orders found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#E0E4EB] text-xs font-semibold uppercase text-[#616161]">
                          <th className="py-3 pr-4">Order ID</th>
                          <th className="py-3 px-3">Customer</th>
                          <th className="py-3 px-3">Items</th>
                          <th className="py-3 px-3">Payment</th>
                          <th className="py-3 px-3">Total</th>
                          <th className="py-3 pl-3 text-right">Update Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F3F6]">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-[#F7F9FC]">
                            <td className="py-3 pr-4 whitespace-nowrap">
                              <div className="font-mono-num font-semibold text-[#2874F0]">{o.order_number}</div>
                              <div className="text-xs text-[#616161]">{formatDateShort(o.created_at)}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-[#212121]">{o.customer_name || o.address.full_name}</div>
                              <div className="text-xs text-[#616161]">{o.address.city}, {o.address.pincode}</div>
                            </td>
                            <td className="py-3 px-3 text-xs text-[#616161]">
                              {o.items.map((it) => `${it.product_name} ×${it.quantity}`).join(', ')}
                            </td>
                            <td className="py-3 px-3 text-xs">
                              <div className="font-medium text-[#212121]">{o.payment_method}</div>
                              <div className="text-[#616161] uppercase">{o.payment_status}</div>
                            </td>
                            <td className="py-3 px-3 font-mono-num font-semibold">{formatINR(o.total_amount)}</td>
                            <td className="py-3 pl-3 text-right">
                              <select
                                value={o.status}
                                onChange={(e) => handleOrderStatusChange(o.id, e.target.value as Order['status'])}
                                className="px-2.5 py-1.5 border border-[#E0E4EB] rounded-sm text-xs font-semibold bg-white focus:border-[#2874F0] focus:outline-none"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* COUPONS TAB */}
            {activeTab === 'coupons' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <form onSubmit={handleCreateCoupon} className="border border-[#E0E4EB] rounded-sm p-4 space-y-3 h-fit">
                  <h3 className="text-sm font-bold text-[#212121]">Create Discount Coupon</h3>
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Code *</label>
                    <input
                      type="text"
                      required
                      value={coupCode}
                      onChange={(e) => setCoupCode(e.target.value.toUpperCase())}
                      placeholder="FESTIVE20"
                      className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Type</label>
                      <select
                        value={coupType}
                        onChange={(e) => setCoupType(e.target.value as 'percent' | 'flat')}
                        className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm bg-white"
                      >
                        <option value="percent">Percent (%)</option>
                        <option value="flat">Flat (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Value *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={coupVal}
                        onChange={(e) => setCoupVal(e.target.value)}
                        placeholder="15"
                        className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Min Order (₹)</label>
                      <input
                        type="number"
                        value={coupMin}
                        onChange={(e) => setCoupMin(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Max Discount (₹)</label>
                      <input
                        type="number"
                        value={coupMax}
                        onChange={(e) => setCoupMax(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">Expires On</label>
                    <input
                      type="date"
                      value={coupExp}
                      onChange={(e) => setCoupExp(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#2874F0] text-white text-sm font-semibold rounded-sm hover:bg-[#1d63d8]"
                  >
                    Create Coupon
                  </button>
                </form>

                <div className="lg:col-span-2 divide-y divide-[#F1F3F6] border border-[#E0E4EB] rounded-sm">
                  {coupons.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num font-bold text-sm px-2.5 py-0.5 bg-[#2874F0]/10 text-[#2874F0] rounded-sm">
                            {c.code}
                          </span>
                          <span className={`text-xs font-semibold ${c.active ? 'text-[#388E3C]' : 'text-[#9E9E9E]'}`}>
                            {c.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs text-[#616161] mt-1">
                          {c.discount_type === 'percent' ? `${c.discount_value}% off` : `${formatINR(c.discount_value)} off`} · Min order {formatINR(c.min_order_amount)} · Expires {c.expires_at}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCoupon(c)}
                          className="px-3 py-1.5 border border-[#E0E4EB] text-xs font-semibold rounded-sm hover:bg-[#F7F9FC]"
                        >
                          {c.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(c.id)}
                          className="p-1.5 border border-[#E0E4EB] rounded-sm text-red-600 hover:bg-red-50"
                          aria-label={`Delete coupon ${c.code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CUSTOMERS TAB */}
            {activeTab === 'customers' && (
              <div>
                {customers.length === 0 ? (
                  <p className="text-sm text-[#616161] text-center py-10">No registered customers yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#E0E4EB] text-xs font-semibold uppercase text-[#616161]">
                          <th className="py-3 pr-4">Customer</th>
                          <th className="py-3 px-3">Contact</th>
                          <th className="py-3 px-3">Orders</th>
                          <th className="py-3 px-3">Total Spent</th>
                          <th className="py-3 pl-3 text-right">Account Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F3F6]">
                        {customers.map((cu) => (
                          <tr key={cu.id} className="hover:bg-[#F7F9FC]">
                            <td className="py-3 pr-4">
                              <div className="font-semibold text-[#212121]">{cu.name}</div>
                              <div className="text-xs text-[#616161]">Joined {formatDateShort(cu.created_at)}</div>
                            </td>
                            <td className="py-3 px-3 text-xs">
                              <div>{cu.email}</div>
                              {cu.mobile && <div className="text-[#616161]">{cu.mobile}</div>}
                            </td>
                            <td className="py-3 px-3 font-mono-num">{cu.order_count}</td>
                            <td className="py-3 px-3 font-mono-num font-semibold">{formatINR(cu.total_spent)}</td>
                            <td className="py-3 pl-3 text-right">
                              <select
                                value={cu.role}
                                onChange={(e) => handleCustomerRole(cu.id, e.target.value as 'customer' | 'seller')}
                                className="px-2.5 py-1 border border-[#E0E4EB] rounded-sm text-xs bg-white"
                              >
                                <option value="customer">Customer</option>
                                <option value="seller">Seller</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div className="divide-y divide-[#F1F3F6] border border-[#E0E4EB] rounded-sm">
                {reviews.length === 0 ? (
                  <p className="text-sm text-[#616161] text-center py-10">No customer reviews submitted yet.</p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-bold font-mono-num">
                            {r.rating} ★
                          </span>
                          <span className="font-semibold text-sm text-[#212121]">{r.title}</span>
                          <span className="text-xs text-[#2874F0] font-medium">on {r.product_name}</span>
                        </div>
                        <p className="text-sm text-[#616161]">{r.comment}</p>
                        <p className="text-xs text-[#9E9E9E]">
                          By {r.author_name} · {formatDateShort(r.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(r.id)}
                        className="p-1.5 border border-[#E0E4EB] rounded-sm text-red-600 hover:bg-red-50 shrink-0"
                        aria-label="Remove review"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-[#E0E4EB]">
            <div className="px-6 py-4 border-b border-[#E0E4EB] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#212121]">
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-sm text-[#616161] hover:text-[#212121]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Brand *
                  </label>
                  <input
                    type="text"
                    required
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={pCategoryId}
                    onChange={(e) => setPCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={pOriginalPrice}
                    onChange={(e) => setPOriginalPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Upload Product Image (PNG/JPG/WEBP)
                  </label>
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-[#2874F0] rounded-sm text-xs font-semibold text-[#2874F0] cursor-pointer hover:bg-[#2874F0]/5">
                    <Upload className="w-4 h-4" />
                    {uploadingImg ? 'Uploading...' : 'Choose Image File'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <SmartImage
                  src={pImageUrl}
                  alt="Preview"
                  className="w-14 h-14 rounded-sm object-contain bg-[#F7F9FC] border border-[#E0E4EB] shrink-0"
                />
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                    Image Path / URL
                  </label>
                  <input
                    type="text"
                    value={pImageUrl}
                    onChange={(e) => setPImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-xs font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E0E4EB] rounded-sm text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pTopDeal} onChange={(e) => setPTopDeal(e.target.checked)} />
                  Top Deal
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pBestSeller} onChange={(e) => setPBestSeller(e.target.checked)} />
                  Best Seller
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pRecommended} onChange={(e) => setPRecommended(e.target.checked)} />
                  Recommended
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pTrending} onChange={(e) => setPTrending(e.target.checked)} />
                  Trending
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E0E4EB]">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-[#E0E4EB] text-sm rounded-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#FB641B] hover:bg-[#e55610] text-white text-sm font-semibold rounded-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingProductId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
