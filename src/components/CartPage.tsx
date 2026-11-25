import React, { useState } from 'react';
import {
  ArrowRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatINR } from '../lib/format';
import { SmartImage } from './SmartImage';

export function CartPage() {
  const {
    cart,
    navigate,
    updateCartQty,
    removeFromCart,
    toggleWishlist,
    showToast,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const mrpTotal = cart.reduce(
    (sum, item) => sum + (item.product.original_price || item.product.price) * item.quantity,
    0
  );
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const productDiscount = Math.max(0, mrpTotal - subtotal);

  const couponDiscount = appliedCoupon ? Math.min(appliedCoupon.discount, subtotal) : 0;
  const deliveryCharge =
    subtotal === 0 ? 0 : appliedCoupon?.code === 'FREESHIP' || subtotal >= 499 ? 0 : 49;
  const finalTotal = Math.max(0, subtotal - couponDiscount + deliveryCharge);
  const totalSavings = productDiscount + couponDiscount + (subtotal > 0 && deliveryCharge === 0 ? 49 : 0);

  const applyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const res = await apiFetch<{ valid: boolean; discount: number; coupon: { code: string } }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code, subtotal }),
        }
      );
      setAppliedCoupon({ code: res.coupon.code, discount: res.discount });
      setCouponInput(res.coupon.code);
      showToast(`Coupon ${res.coupon.code} applied! Saved ${formatINR(res.discount)}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid coupon code.', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 py-12">
        <div className="bg-white rounded-md border border-slate-200 p-10 text-center max-w-lg mx-auto">
          <ShoppingBag className="w-14 h-14 text-[#2874F0]/30 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-[#212121]">Your NexCart cart is empty</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Explore top deals across electronics, fashion, appliances, and everyday essentials.
          </p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="mt-5 bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-sm font-semibold px-6 py-2.5 rounded-sm transition-colors cursor-pointer"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto px-3 sm:px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Cart Items */}
        <div className="lg:col-span-8 bg-white rounded-md border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h1 className="font-display text-lg font-bold text-[#212121]">
              Shopping Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h1>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={`${item.product_id}-${item.variant_label}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${item.product_id}`)}
                    className="w-24 h-24 rounded bg-slate-50 border border-slate-100 overflow-hidden shrink-0 cursor-pointer"
                  >
                    <SmartImage
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${item.product_id}`)}
                      className="text-sm font-semibold text-[#212121] hover:text-[#2874F0] text-left line-clamp-2 cursor-pointer"
                    >
                      {item.product.name}
                    </button>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.variant_label} · Seller: {item.product.seller_name || 'NexCart Retail'}
                    </p>

                    <div className="mt-2.5 flex items-baseline gap-2.5">
                      <span className="text-base font-bold text-[#212121] font-mono-num">
                        {formatINR(item.product.price * item.quantity)}
                      </span>
                      {item.product.original_price > item.product.price && (
                        <>
                          <span className="text-xs text-slate-400 line-through font-mono-num">
                            {formatINR(item.product.original_price * item.quantity)}
                          </span>
                          <span className="text-xs font-semibold text-[#388E3C]">
                            {item.product.discount_percent}% off
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      {/* Quantity Stepper */}
                      <div className="inline-flex items-center border border-slate-300 rounded-sm">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <motion.span
                          key={item.quantity}
                          initial={{ scale: 1.2 }}
                          animate={{ scale: 1 }}
                          className="w-9 text-center text-xs font-bold font-mono-num"
                        >
                          {item.quantity}
                        </motion.span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock_qty}
                          aria-label="Increase quantity"
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await toggleWishlist(item.product);
                          await removeFromCart(item);
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-[#2874F0] flex items-center gap-1 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5" /> Save for Later
                      </button>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item)}
                        className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={() =>
                navigate(
                  appliedCoupon
                    ? `/checkout?coupon=${encodeURIComponent(appliedCoupon.code)}`
                    : '/checkout'
                )
              }
              className="bg-[#FB641B] hover:bg-[#e85811] text-white font-bold text-sm px-8 py-3 rounded-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              PLACE ORDER <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Price Summary & Coupons */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-28">
          {/* Coupon Box */}
          <div className="bg-white rounded-md border border-slate-200/80 p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#2874F0]" /> Apply Coupon
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyCoupon();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. WELCOME10)"
                className="flex-1 h-9 px-3 text-xs font-mono-num border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
              />
              <button
                type="submit"
                disabled={couponLoading}
                className="h-9 px-4 bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50"
              >
                {couponLoading ? '...' : 'Apply'}
              </button>
            </form>
            {appliedCoupon && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded text-xs">
                <span>
                  Code <strong>{appliedCoupon.code}</strong> applied (-{formatINR(couponDiscount)})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  aria-label="Remove coupon"
                  className="cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['WELCOME10', 'SAVE500', 'FREESHIP'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyCoupon(c)}
                  className="text-[11px] font-mono-num font-semibold text-[#2874F0] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price Details */}
          <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Price Details
              </h2>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Price ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
                <span className="font-mono-num">{formatINR(mrpTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discount</span>
                <span className="text-[#388E3C] font-mono-num">− {formatINR(productDiscount)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Coupon ({appliedCoupon?.code})</span>
                  <span className="text-[#388E3C] font-mono-num">− {formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Delivery Charges</span>
                <span className="font-mono-num">
                  {deliveryCharge === 0 ? (
                    <span className="text-[#388E3C] font-semibold">FREE</span>
                  ) : (
                    formatINR(deliveryCharge)
                  )}
                </span>
              </div>
              <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between text-base font-bold text-[#212121]">
                <span>Total Amount</span>
                <span className="font-mono-num">{formatINR(finalTotal)}</span>
              </div>
              {totalSavings > 0 && (
                <p className="text-xs font-semibold text-[#388E3C] pt-1">
                  You will save {formatINR(totalSavings)} on this order
                </p>
              )}
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#2874F0] shrink-0" />
              <span>Safe and Secure Payments. 100% Authentic Products.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
