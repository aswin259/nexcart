import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatINR } from '../lib/format';
import type { Address, Order } from '../types';
import { SmartImage } from './SmartImage';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: Record<string, unknown>) => void) => void;
    };
  }
}

type PaymentMethod = 'cod' | 'upi' | 'credit_card' | 'debit_card' | 'netbanking';

export function CheckoutPage() {
  const {
    user,
    addresses,
    setAddressesState,
    cart,
    buyNowItem,
    setBuyNowItem,
    clearCartLocal,
    navigate,
    showToast,
    route,
  } = useStore();

  const items = buyNowItem ? [buyNowItem] : cart;
  const isBuyNow = Boolean(buyNowItem);

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    full_name: user?.name || '',
    phone: user?.mobile || '',
    pincode: '',
    address_line: '',
    city: '',
    state: '',
  });

  const [deliveryOption, setDeliveryOption] = useState<'standard' | 'express'>('standard');
  const [couponCode, setCouponCode] = useState(() => {
    const u = new URL(window.location.origin + route);
    return u.searchParams.get('coupon') || '';
  });
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [razorpayConfig, setRazorpayConfig] = useState<{ razorpayConfigured: boolean; keyId: string | null }>({
    razorpayConfigured: false,
    keyId: null,
  });
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ razorpayConfigured: boolean; keyId: string | null }>('/api/payments/config')
      .then(setRazorpayConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (addresses.length > 0 && selectedAddressId === null) {
      const def = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(def.id);
    } else if (addresses.length === 0) {
      setShowNewAddress(true);
    }
  }, [addresses, selectedAddressId]);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const deliveryCharge =
    deliveryOption === 'express' ? 99 : appliedCouponCode === 'FREESHIP' || subtotal >= 499 ? 0 : 49;
  const finalTotal = Math.max(1, subtotal - couponDiscount + deliveryCharge);

  useEffect(() => {
    if (couponCode && subtotal > 0 && !appliedCouponCode) {
      apiFetch<{ discount: number; coupon: { code: string } }>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode, subtotal }),
      })
        .then((res) => {
          setAppliedCouponCode(res.coupon.code);
          setCouponDiscount(res.discount);
        })
        .catch(() => {});
    }
  }, [couponCode, subtotal, appliedCouponCode]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-md border border-slate-200 p-8 text-center">
          <Lock className="w-10 h-10 text-[#2874F0] mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold">Sign in to complete checkout</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Your cart items are preserved. Sign in or create an account to select a delivery address and place your order.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login?redirect=/checkout')}
            className="mt-5 bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-sm font-semibold px-6 py-2.5 rounded-sm cursor-pointer"
          >
            Login / Sign Up
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center bg-white rounded-md border border-slate-200 mt-6 p-8">
        <h1 className="font-display text-xl font-bold">No items to checkout</h1>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="mt-4 bg-[#2874F0] text-white text-sm font-semibold px-6 py-2.5 rounded-sm cursor-pointer"
        >
          Browse Products
        </button>
      </div>
    );
  }

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ id: number; addresses: Address[] }>('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...newAddr, is_default: addresses.length === 0 }),
      });
      setAddressesState(res.addresses);
      setSelectedAddressId(res.id);
      setShowNewAddress(false);
      showToast('Delivery address saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save address.', 'error');
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    try {
      const res = await apiFetch<{ discount: number; coupon: { code: string } }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponCode.trim(), subtotal }),
        }
      );
      setAppliedCouponCode(res.coupon.code);
      setCouponDiscount(res.discount);
      showToast(`Applied coupon ${res.coupon.code}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid coupon.', 'error');
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const handlePlaceOrder = async () => {
    setOrderError(null);

    let deliveryAddress = selectedAddress;
    if (!deliveryAddress && showNewAddress) {
      const cleanPhone = newAddr.phone.replace(/\D/g, '');
      if (
        !newAddr.full_name.trim() ||
        !/^\d{10}$/.test(cleanPhone) ||
        !/^\d{6}$/.test(newAddr.pincode.trim()) ||
        !newAddr.address_line.trim() ||
        !newAddr.city.trim() ||
        !newAddr.state.trim()
      ) {
        const msg = 'Please complete all delivery address fields (with a 10-digit mobile number and 6-digit PIN code).';
        setOrderError(msg);
        showToast(msg, 'error');
        return;
      }
      try {
        const saved = await apiFetch<{ id: number; addresses: Address[] }>('/api/auth/addresses', {
          method: 'POST',
          body: JSON.stringify({ ...newAddr, phone: cleanPhone, is_default: addresses.length === 0 }),
        });
        setAddressesState(saved.addresses);
        setSelectedAddressId(saved.id);
        setShowNewAddress(false);
        deliveryAddress = saved.addresses.find((a) => a.id === saved.id) || saved.addresses[0];
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to save delivery address.';
        setOrderError(msg);
        showToast(msg, 'error');
        return;
      }
    }

    if (!deliveryAddress) {
      const msg = 'Please select or add a delivery address.';
      setOrderError(msg);
      showToast(msg, 'error');
      return;
    }

    const payload = {
      address: deliveryAddress,
      deliveryOption,
      couponCode: appliedCouponCode,
      isBuyNow,
      items: items.map((i) => ({
        product_id: i.product_id,
        variant_label: i.variant_label,
        quantity: i.quantity,
      })),
    };

    setPlacing(true);
    try {
      if (paymentMethod === 'cod') {
        const res = await apiFetch<{ order: Order }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ ...payload, paymentMethod: 'cod' }),
        });
        if (isBuyNow) setBuyNowItem(null);
        else clearCartLocal();
        showToast(`Order ${res.order.order_number} placed successfully!`, 'success');
        navigate(`/orders/${res.order.id}`);
        return;
      }

      const methodLabels: Record<PaymentMethod, string> = {
        cod: 'Cash on Delivery',
        upi: 'UPI (Razorpay Test)',
        credit_card: 'Credit Card (Razorpay Test)',
        debit_card: 'Debit Card (Razorpay Test)',
        netbanking: 'Net Banking (Razorpay Test)',
      };

      const rzpInit = await apiFetch<{
        keyId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        orderId: number;
        clearCart: boolean;
      }>('/api/payments/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          paymentMethodLabel: methodLabels[paymentMethod],
        }),
      });

      if (!window.Razorpay) {
        const msg = 'Razorpay Checkout SDK is still loading. Please try again in a second.';
        setOrderError(msg);
        showToast(msg, 'error');
        setPlacing(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: rzpInit.keyId,
        amount: rzpInit.amount,
        currency: rzpInit.currency,
        name: 'NexCart',
        description: 'NexCart Test Mode Checkout',
        order_id: rzpInit.razorpayOrderId,
        prefill: {
          name: deliveryAddress.full_name,
          email: user.email,
          contact: deliveryAddress.phone,
        },
        theme: { color: '#2874F0' },
        handler: async (response: Record<string, string>) => {
          try {
            const verified = await apiFetch<{ order: Order }>('/api/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                orderId: rzpInit.orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                clearCart: rzpInit.clearCart,
              }),
            });
            if (isBuyNow) setBuyNowItem(null);
            else clearCartLocal();
            showToast('Payment verified & order confirmed!', 'success');
            navigate(`/orders/${verified.order.id}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment verification failed.';
            setOrderError(msg);
            showToast(msg, 'error');
          } finally {
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            showToast('Payment window closed before completion.', 'info');
          },
        },
      });
      rzp.on('payment.failed', () => {
        setPlacing(false);
        const msg = 'Razorpay test payment failed. Please retry.';
        setOrderError(msg);
        showToast(msg, 'error');
      });
      rzp.open();
    } catch (err) {
      setPlacing(false);
      const msg = err instanceof Error ? err.message : 'Checkout failed.';
      setOrderError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto px-3 sm:px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Checkout Steps */}
        <div className="lg:col-span-8 space-y-4">
          {/* 1. Delivery Address */}
          <section className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
            <div className="bg-[#2874F0] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-bold">
                <span className="w-5 h-5 rounded-xs bg-white text-[#2874F0] text-xs flex items-center justify-center font-mono-num">
                  1
                </span>
                <span>DELIVERY ADDRESS</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAddress((v) => !v)}
                className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1 rounded-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Address
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-colors ${
                    selectedAddressId === addr.id
                      ? 'border-[#2874F0] bg-blue-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryAddress"
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1 accent-[#2874F0]"
                  />
                  <div className="text-sm">
                    <p className="font-bold text-[#212121]">
                      {addr.full_name} <span className="ml-2 font-mono-num text-xs text-slate-600">{addr.phone}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {addr.address_line}, {addr.city}, {addr.state} —{' '}
                      <strong className="font-mono-num">{addr.pincode}</strong>
                    </p>
                  </div>
                </label>
              ))}

              {showNewAddress && (
                <form
                  onSubmit={handleSaveNewAddress}
                  className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2874F0]" /> New Delivery Address
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newAddr.full_name}
                      onChange={(e) => setNewAddr((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Full Name"
                      className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                    <input
                      type="tel"
                      required
                      value={newAddr.phone}
                      onChange={(e) => setNewAddr((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="10-digit Mobile Number"
                      className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={newAddr.pincode}
                      onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '') }))}
                      placeholder="6-digit PIN Code"
                      className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm font-mono-num"
                    />
                    <input
                      type="text"
                      required
                      value={newAddr.city}
                      onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))}
                      placeholder="City / District"
                      className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                    <input
                      type="text"
                      required
                      value={newAddr.address_line}
                      onChange={(e) => setNewAddr((p) => ({ ...p, address_line: e.target.value }))}
                      placeholder="House No., Street, Landmark"
                      className="sm:col-span-2 h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                    <input
                      type="text"
                      required
                      value={newAddr.state}
                      onChange={(e) => setNewAddr((p) => ({ ...p, state: e.target.value }))}
                      placeholder="State"
                      className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-[#2874F0] text-white text-xs font-semibold px-4 py-2 rounded-sm cursor-pointer"
                    >
                      Save and Deliver Here
                    </button>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewAddress(false)}
                        className="text-xs text-slate-600 px-3 py-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* 2. Order Review & Delivery Option */}
          <section className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
            <div className="bg-[#2874F0] text-white px-5 py-3 flex items-center gap-2.5 text-sm font-bold">
              <span className="w-5 h-5 rounded-xs bg-white text-[#2874F0] text-xs flex items-center justify-center font-mono-num">
                2
              </span>
              <span>ORDER SUMMARY &amp; DELIVERY OPTION</span>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={`${item.product_id}-${item.variant_label}`} className="py-3 first:pt-0 flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                      <SmartImage src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#212121] truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.variant_label} · Qty: <strong className="font-mono-num">{item.quantity}</strong>
                      </p>
                    </div>
                    <div className="text-sm font-bold font-mono-num text-[#212121]">
                      {formatINR(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded border cursor-pointer flex items-center gap-3 ${
                    deliveryOption === 'standard' ? 'border-[#2874F0] bg-blue-50/40' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="delOpt"
                    checked={deliveryOption === 'standard'}
                    onChange={() => setDeliveryOption('standard')}
                    className="accent-[#2874F0]"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#2874F0]" /> Standard Delivery (4–5 Days)
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      {subtotal >= 499 ? 'Free on orders ₹499+' : '₹49 delivery fee'}
                    </p>
                  </div>
                </label>
                <label
                  className={`p-3 rounded border cursor-pointer flex items-center gap-3 ${
                    deliveryOption === 'express' ? 'border-[#2874F0] bg-blue-50/40' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="delOpt"
                    checked={deliveryOption === 'express'}
                    onChange={() => setDeliveryOption('express')}
                    className="accent-[#2874F0]"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">Express Priority (1–2 Days)</p>
                    <p className="text-slate-500 mt-0.5 font-mono-num">₹99 flat fee</p>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* 3. Payment Options */}
          <section className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
            <div className="bg-[#2874F0] text-white px-5 py-3 flex items-center gap-2.5 text-sm font-bold">
              <span className="w-5 h-5 rounded-xs bg-white text-[#2874F0] text-xs flex items-center justify-center font-mono-num">
                3
              </span>
              <span>PAYMENT OPTIONS</span>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              {!razorpayConfig.razorpayConfigured && (
                <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Razorpay Test Mode Keys Not Configured:</strong> To process UPI, Card, or Net Banking payments via Razorpay Test Mode, set <code className="font-mono-num">RAZORPAY_KEY_ID</code> and <code className="font-mono-num">RAZORPAY_KEY_SECRET</code> in your server environment. Cash on Delivery works immediately.
                  </div>
                </div>
              )}

              {[
                { id: 'cod' as PaymentMethod, label: 'Cash on Delivery (COD)', sub: 'Pay in cash or UPI at your doorstep', icon: Banknote },
                { id: 'upi' as PaymentMethod, label: 'UPI (GPay, PhonePe, BHIM)', sub: 'Verified via Razorpay Test Mode Gateway', icon: Smartphone },
                { id: 'credit_card' as PaymentMethod, label: 'Credit Card', sub: 'Visa, Mastercard, RuPay via Razorpay Test Mode', icon: CreditCard },
                { id: 'debit_card' as PaymentMethod, label: 'Debit Card', sub: 'All major bank debit cards via Razorpay Test Mode', icon: CreditCard },
                { id: 'netbanking' as PaymentMethod, label: 'Net Banking', sub: 'HDFC, ICICI, SBI, Axis via Razorpay Test Mode', icon: Landmark },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3.5 rounded border cursor-pointer transition-colors ${
                      paymentMethod === opt.id
                        ? 'border-[#2874F0] bg-blue-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === opt.id}
                      onChange={() => setPaymentMethod(opt.id)}
                      className="mt-1 accent-[#2874F0]"
                    />
                    <Icon className="w-4 h-4 text-[#2874F0] mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">{opt.label}</p>
                      <p className="text-slate-500 mt-0.5">{opt.sub}</p>
                    </div>
                  </label>
                );
              })}

              {orderError && (
                <div
                  role="alert"
                  className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{orderError}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  disabled={placing}
                  onClick={handlePlaceOrder}
                  className="bg-[#FB641B] hover:bg-[#e85811] text-white font-bold text-sm px-8 py-3 rounded-sm shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {placing
                    ? 'Processing...'
                    : paymentMethod === 'cod'
                      ? `Place Order (${formatINR(finalTotal)})`
                      : `Pay ${formatINR(finalTotal)} with Razorpay Test Mode`}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Summary */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-28">
          <div className="bg-white rounded-md border border-slate-200/80 p-4">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon code (WELCOME10)"
                className="flex-1 h-9 px-3 text-xs font-mono-num border border-slate-300 rounded-sm"
              />
              <button
                type="submit"
                className="h-9 px-3.5 bg-[#2874F0] text-white text-xs font-semibold rounded-sm cursor-pointer"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Order Summary
              </h2>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Items Subtotal</span>
                <span className="font-mono-num">{formatINR(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-[#388E3C]">
                  <span>Coupon ({appliedCouponCode})</span>
                  <span className="font-mono-num">− {formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Delivery</span>
                <span className="font-mono-num">
                  {deliveryCharge === 0 ? (
                    <span className="text-[#388E3C] font-semibold">FREE</span>
                  ) : (
                    formatINR(deliveryCharge)
                  )}
                </span>
              </div>
              <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between text-base font-bold text-[#212121]">
                <span>Total Payable</span>
                <span className="font-mono-num">{formatINR(finalTotal)}</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#2874F0] shrink-0" />
              <span>Server-verified pricing &amp; HMAC-SHA256 payment signature checks.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
