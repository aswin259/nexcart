import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  IndianRupee,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatDateShort, formatINR } from '../lib/format';
import type { Product, SellerProfile } from '../types';
import { SmartImage } from './SmartImage';

interface SellerOrderItem {
  id: number;
  order_id: number;
  order_number: string;
  order_status: string;
  order_date: string;
  product_id: number;
  product_name: string;
  product_image: string;
  variant_label: string;
  unit_price: number;
  quantity: number;
}

interface SellerDashboardData {
  registered: boolean;
  seller: SellerProfile | null;
  products: Product[];
  orders: SellerOrderItem[];
  metrics: {
    totalProducts: number;
    totalSales: number;
    totalEarnings: number;
    unitsSold: number;
  } | null;
}

const PRESET_IMAGES = [
  { label: 'Smartphone / Tech', url: '/src/assets/images/prod_smartphone_pro_1795581229943.jpg' },
  { label: 'Headphones / Laptop', url: '/src/assets/images/prod_headphones_laptop_1795581229851.jpg' },
  { label: 'Sneakers / Fashion', url: '/src/assets/images/prod_fashion_sneakers_1795581229836.jpg' },
  { label: 'Chair / Furniture', url: '/src/assets/images/prod_furniture_chair_1795581231268.jpg' },
  { label: 'Beauty / Skincare', url: '/src/assets/images/prod_beauty_skincare_1795581231083.jpg' },
  { label: 'Grocery / Pantry', url: '/src/assets/images/prod_grocery_pantry_1795581231369.jpg' },
  { label: 'Kitchen Appliance', url: '/src/assets/images/prod_kitchen_appliance_1795581232270.jpg' },
  { label: 'Sports & Fitness', url: '/src/assets/images/prod_sports_fitness_1795581232018.jpg' },
  { label: 'Books & Backpack', url: '/src/assets/images/prod_books_backpack_1795581233133.jpg' },
];

export function SellerDashboardPage() {
  const { user, authLoading, categories, navigate, showToast, refreshAuth } = useStore();
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'add' | 'orders'>('products');

  // Seller Registration Form
  const [storeName, setStoreName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [registering, setRegistering] = useState(false);

  // Add Product Form
  const [prodName, setProdName] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodCategory, setProdCategory] = useState<number>(0);
  const [prodMrp, setProdMrp] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('25');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImage, setProdImage] = useState(PRESET_IMAGES[0].url);
  const [savingProduct, setSavingProduct] = useState(false);

  // Inline Edit Product
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editStock, setEditStock] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (categories.length > 0 && prodCategory === 0) {
      setProdCategory(categories[0].id);
    }
  }, [categories, prodCategory]);

  useEffect(() => {
    if (user && !supportEmail) {
      setSupportEmail(user.email);
    }
  }, [user, supportEmail]);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<SellerDashboardData>('/api/seller/dashboard');
      setData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load seller dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (!authLoading) {
      loadDashboard();
    }
  }, [authLoading, loadDashboard]);

  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeName.trim().length < 3) {
      showToast('Store name must be at least 3 characters.', 'error');
      return;
    }
    setRegistering(true);
    try {
      await apiFetch('/api/seller/register', {
        method: 'POST',
        body: JSON.stringify({
          storeName: storeName.trim(),
          gstNumber: gstNumber.trim(),
          panNumber: panNumber.trim(),
          supportEmail: supportEmail.trim(),
        }),
      });
      showToast('Seller account activated! Welcome to NexCart Seller Hub.', 'success');
      await refreshAuth();
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Registration failed.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(prodPrice);
    const mrpNum = Number(prodMrp) || priceNum;
    if (!prodName.trim() || !prodBrand.trim() || !prodCategory || !priceNum || priceNum <= 0) {
      showToast('Please enter product name, brand, category, and valid selling price.', 'error');
      return;
    }
    setSavingProduct(true);
    try {
      await apiFetch('/api/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          name: prodName.trim(),
          brand: prodBrand.trim(),
          category_id: prodCategory,
          original_price: Math.max(mrpNum, priceNum),
          price: priceNum,
          stock_qty: Math.max(0, Number(prodStock) || 0),
          description: prodDesc.trim() || undefined,
          image_url: prodImage.trim(),
        }),
      });
      showToast('Product published to NexCart marketplace.', 'success');
      setProdName('');
      setProdBrand('');
      setProdMrp('');
      setProdPrice('');
      setProdStock('25');
      setProdDesc('');
      setActiveTab('products');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add product.', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditPrice(String(p.price));
    setEditMrp(String(p.original_price));
    setEditStock(String(p.stock_qty));
  };

  const handleSaveEdit = async (productId: number) => {
    const priceNum = Number(editPrice);
    const mrpNum = Number(editMrp);
    const stockNum = Number(editStock);
    if (!priceNum || priceNum <= 0) {
      showToast('Selling price must be greater than 0.', 'error');
      return;
    }
    try {
      await apiFetch(`/api/seller/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({
          price: priceNum,
          original_price: Math.max(mrpNum || priceNum, priceNum),
          stock_qty: Math.max(0, stockNum || 0),
        }),
      });
      setEditingId(null);
      showToast('Price and stock updated.', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await apiFetch(`/api/seller/products/${productId}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      showToast('Product removed from your store.', 'info');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove product.', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-12">
        <div className="bg-white rounded-sm p-8 border border-[#E0E4EB] animate-pulse space-y-4">
          <div className="h-7 w-56 bg-[#F1F3F6] rounded" />
          <div className="h-32 bg-[#F1F3F6] rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-12">
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-8 sm:p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#2874F0]/10 text-[#2874F0] flex items-center justify-center mb-4">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-[#212121]">Become a NexCart Seller</h1>
          <p className="text-sm text-[#616161] max-w-md mx-auto mt-2">
            Reach millions of shoppers across India. Sign in or create a NexCart account to set up your Seller Hub, list products, manage stock, and track payouts.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/login?redirect=/seller')}
              className="px-6 py-3 bg-[#FB641B] hover:bg-[#e55610] text-white font-semibold text-sm rounded-sm transition-colors"
            >
              Sign In / Create Account
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-3 border border-[#E0E4EB] text-[#212121] font-medium text-sm rounded-sm hover:bg-[#F7F9FC]"
            >
              Back to Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.registered || !data.seller) {
    return (
      <div className="max-w-[1000px] mx-auto px-4 py-8">
        <div className="grid md:grid-cols-5 bg-white border border-[#E0E4EB] rounded-sm overflow-hidden shadow-xs">
          <div className="md:col-span-2 bg-[#2874F0] text-white p-7 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-sm mb-4">
                <Store className="w-3.5 h-3.5" /> Seller Onboarding
              </div>
              <h1 className="text-2xl font-bold leading-snug">Launch your online store on NexCart</h1>
              <p className="text-sm text-white/85 mt-3">
                List products in minutes, control your pricing and inventory, and track every order and settlement transparently.
              </p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-white/90">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FFE500] shrink-0" />
                Instant catalog publishing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FFE500] shrink-0" />
                Real-time inventory & order tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#FFE500] shrink-0" />
                Fast 7-day bank settlements
              </li>
            </ul>
          </div>

          <form onSubmit={handleRegisterSeller} className="md:col-span-3 p-7 space-y-4">
            <h2 className="text-lg font-bold text-[#212121]">Register Your Seller Store</h2>
            <div>
              <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                Store Display Name *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g., Horizon Electronics Hub"
                className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="27AABCS1429B1Z1"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm font-mono-num focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  PAN Number (Optional)
                </label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="AABCS1429B"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm font-mono-num focus:outline-none focus:border-[#2874F0]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                Business Support Email
              </label>
              <input
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@yourstore.in"
                className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
              />
            </div>
            <button
              type="submit"
              disabled={registering}
              className="w-full py-3 bg-[#FB641B] hover:bg-[#e55610] disabled:opacity-60 text-white font-semibold text-sm rounded-sm transition-colors"
            >
              {registering ? 'Setting up your store...' : 'Activate Seller Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const metrics = data.metrics || { totalProducts: 0, totalSales: 0, totalEarnings: 0, unitsSold: 0 };

  return (
    <div className="max-w-[1360px] mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-[#E0E4EB] rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-sm bg-[#2874F0]/10 text-[#2874F0] flex items-center justify-center shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#212121]">{data.seller.store_name}</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-[#388E3C]/10 text-[#388E3C]">
                Verified Seller
              </span>
            </div>
            <p className="text-xs text-[#616161] mt-0.5">
              Support: {data.seller.support_email}
              {data.seller.gst_number ? ` · GSTIN: ${data.seller.gst_number}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2874F0] hover:bg-[#1d63d8] text-white text-sm font-semibold rounded-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-4 py-2 border border-[#E0E4EB] text-sm font-medium text-[#212121] rounded-sm hover:bg-[#F7F9FC]"
          >
            View Marketplace
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Net Earnings (92%)</span>
            <IndianRupee className="w-4 h-4 text-[#388E3C]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {formatINR(metrics.totalEarnings)}
          </p>
          <p className="text-xs text-[#616161] mt-1">After 8% marketplace fee</p>
        </div>

        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Gross Sales</span>
            <TrendingUp className="w-4 h-4 text-[#2874F0]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {formatINR(metrics.totalSales)}
          </p>
          <p className="text-xs text-[#616161] mt-1">{metrics.unitsSold} units ordered</p>
        </div>

        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Active Listings</span>
            <Package className="w-4 h-4 text-[#FF9F00]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {metrics.totalProducts}
          </p>
          <p className="text-xs text-[#616161] mt-1">Published in catalog</p>
        </div>

        <div className="bg-white border border-[#E0E4EB] rounded-sm p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#616161] uppercase">
            <span>Seller Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#2874F0]" />
          </div>
          <p className="text-2xl font-bold text-[#212121] font-mono-num mt-2">
            {data.orders.length}
          </p>
          <p className="text-xs text-[#616161] mt-1">Line items received</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-[#E0E4EB] rounded-sm">
        <div className="flex border-b border-[#E0E4EB] overflow-x-auto">
          {[
            { id: 'products', label: `My Products (${data.products.length})` },
            { id: 'add', label: 'Add New Product' },
            { id: 'orders', label: `Orders & Sales (${data.orders.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'products' | 'add' | 'orders')}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#2874F0] text-[#2874F0] bg-[#2874F0]/5'
                  : 'border-transparent text-[#616161] hover:text-[#212121]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* My Products Tab */}
        {activeTab === 'products' && (
          <div className="p-4 sm:p-5">
            {data.products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-10 h-10 text-[#9E9E9E] mx-auto mb-3" />
                <p className="text-base font-semibold text-[#212121]">No products listed yet</p>
                <p className="text-sm text-[#616161] mt-1">
                  Add your first product to start selling on NexCart.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="mt-4 px-5 py-2.5 bg-[#2874F0] text-white text-sm font-semibold rounded-sm hover:bg-[#1d63d8]"
                >
                  List Your First Product
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E0E4EB] text-xs font-semibold uppercase text-[#616161]">
                      <th className="py-3 pr-4">Product</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Price / MRP</th>
                      <th className="py-3 px-3">Stock</th>
                      <th className="py-3 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F6] text-sm">
                    {data.products.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-[#F7F9FC]">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <SmartImage
                                src={p.images[0]}
                                alt={p.name}
                                className="w-12 h-12 rounded-sm object-contain bg-[#F7F9FC] border border-[#E0E4EB] shrink-0"
                              />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/product/${p.id}`)}
                                  className="font-semibold text-[#212121] hover:text-[#2874F0] text-left line-clamp-1"
                                >
                                  {p.name}
                                </button>
                                <p className="text-xs text-[#616161]">
                                  {p.brand} · SKU: {p.sku || `PRD-${p.id}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-[#616161] whitespace-nowrap">
                            {p.category_name}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-24 px-2 py-1 border border-[#2874F0] rounded-sm text-xs font-mono-num"
                                  aria-label="Selling price"
                                />
                                <input
                                  type="number"
                                  value={editMrp}
                                  onChange={(e) => setEditMrp(e.target.value)}
                                  className="w-24 px-2 py-1 border border-[#E0E4EB] rounded-sm text-xs font-mono-num"
                                  aria-label="MRP"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-[#212121] font-mono-num">
                                  {formatINR(p.price)}
                                </span>
                                {p.original_price > p.price && (
                                  <span className="text-xs text-[#9E9E9E] line-through ml-1.5 font-mono-num">
                                    {formatINR(p.original_price)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={editStock}
                                onChange={(e) => setEditStock(e.target.value)}
                                className="w-20 px-2 py-1 border border-[#2874F0] rounded-sm text-xs font-mono-num"
                                aria-label="Stock quantity"
                              />
                            ) : (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold font-mono-num ${
                                  p.stock_qty > 5
                                    ? 'bg-[#388E3C]/10 text-[#388E3C]'
                                    : p.stock_qty > 0
                                    ? 'bg-[#FF9F00]/15 text-[#b56d00]'
                                    : 'bg-red-50 text-red-600'
                                }`}
                              >
                                {p.stock_qty} units
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(p.id)}
                                  className="px-3 py-1 bg-[#388E3C] text-white text-xs font-semibold rounded-sm"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 border border-[#E0E4EB] text-xs rounded-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : confirmDeleteId === p.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-sm"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 border border-[#E0E4EB] text-xs rounded-sm"
                                >
                                  Keep
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#E0E4EB] rounded-sm text-xs font-medium text-[#2874F0] hover:bg-[#2874F0]/5"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(p.id)}
                                  className="p-1.5 border border-[#E0E4EB] rounded-sm text-red-600 hover:bg-red-50"
                                  aria-label={`Delete ${p.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add Product Tab */}
        {activeTab === 'add' && (
          <form onSubmit={handleAddProduct} className="p-5 sm:p-6 max-w-3xl space-y-4">
            <h2 className="text-base font-bold text-[#212121]">Publish a New Product</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g., Studio Wireless Over-Ear Headphones"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Brand *
                </label>
                <input
                  type="text"
                  required
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                  placeholder="e.g., SoundCraft"
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Category *
                </label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#E0E4EB] rounded-sm text-sm bg-white focus:outline-none focus:border-[#2874F0]"
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
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="2499"
                  className="w-full px-3 py-2.5 border border-[#E0E4EB] rounded-sm text-sm font-mono-num focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  value={prodMrp}
                  onChange={(e) => setProdMrp(e.target.value)}
                  placeholder="3999"
                  className="w-full px-3 py-2.5 border border-[#E0E4EB] rounded-sm text-sm font-mono-num focus:outline-none focus:border-[#2874F0]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Opening Stock Qty
                </label>
                <input
                  type="number"
                  min={0}
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm font-mono-num focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                  Catalog Image Preset
                </label>
                <select
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E0E4EB] rounded-sm text-sm bg-white focus:outline-none focus:border-[#2874F0]"
                >
                  {PRESET_IMAGES.map((img) => (
                    <option key={img.url} value={img.url}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#616161] uppercase mb-1">
                Product Description
              </label>
              <textarea
                rows={3}
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Key highlights, warranty details, and box contents..."
                className="w-full px-3.5 py-2.5 border border-[#E0E4EB] rounded-sm text-sm focus:outline-none focus:border-[#2874F0]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingProduct}
                className="px-6 py-2.5 bg-[#FB641B] hover:bg-[#e55610] disabled:opacity-60 text-white text-sm font-semibold rounded-sm"
              >
                {savingProduct ? 'Publishing...' : 'Publish Product'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="px-5 py-2.5 border border-[#E0E4EB] text-sm font-medium rounded-sm hover:bg-[#F7F9FC]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="p-4 sm:p-5">
            {data.orders.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-10 h-10 text-[#9E9E9E] mx-auto mb-3" />
                <p className="text-base font-semibold text-[#212121]">No customer orders yet</p>
                <p className="text-sm text-[#616161] mt-1">
                  Orders containing your store&apos;s products will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E0E4EB] text-xs font-semibold uppercase text-[#616161]">
                      <th className="py-3 pr-4">Order ID</th>
                      <th className="py-3 px-3">Item</th>
                      <th className="py-3 px-3">Qty</th>
                      <th className="py-3 px-3">Sale Value</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 pl-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F6] text-sm">
                    {data.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#F7F9FC]">
                        <td className="py-3 pr-4 font-mono-num font-semibold text-[#2874F0]">
                          {o.order_number}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <SmartImage
                              src={o.product_image}
                              alt={o.product_name}
                              className="w-9 h-9 rounded-sm object-contain bg-[#F7F9FC] border border-[#E0E4EB]"
                            />
                            <div>
                              <p className="font-medium text-[#212121] line-clamp-1">{o.product_name}</p>
                              <p className="text-xs text-[#616161]">{o.variant_label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono-num">{o.quantity}</td>
                        <td className="py-3 px-3 font-mono-num font-semibold text-[#212121]">
                          {formatINR(o.unit_price * o.quantity)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded-sm text-xs font-semibold bg-[#2874F0]/10 text-[#2874F0]">
                            {o.order_status}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right text-xs text-[#616161] whitespace-nowrap">
                          {formatDateShort(o.order_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
