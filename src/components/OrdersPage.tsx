import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatDateShort, formatINR } from '../lib/format';
import type { Order } from '../types';
import { SmartImage } from './SmartImage';

interface OrdersPageProps {
  orderId?: string;
}

const TRACK_STEPS: Order['status'][] = [
  'Order Placed',
  'Confirmed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export function OrdersPage({ orderId }: OrdersPageProps) {
  const { user, navigate, showToast } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionOrder, setActionOrder] = useState<{ id: number; type: 'cancel' | 'return' } | null>(null);
  const [reason, setReason] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ orders: Order[] }>('/api/orders');
      setOrders(res.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadOrders();
    else setLoading(false);
  }, [user, loadOrders]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center bg-white rounded-md border border-slate-200 mt-6 p-8">
        <Package className="w-12 h-12 text-[#2874F0]/40 mx-auto mb-3" />
        <h1 className="font-display text-xl font-bold">Sign in to view your orders</h1>
        <button
          type="button"
          onClick={() => navigate('/login?redirect=/orders')}
          className="mt-4 bg-[#2874F0] text-white text-sm font-semibold px-6 py-2.5 rounded-sm cursor-pointer"
        >
          Login
        </button>
      </div>
    );
  }

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionOrder) return;
    try {
      const endpoint =
        actionOrder.type === 'cancel'
          ? `/api/orders/${actionOrder.id}/cancel`
          : `/api/orders/${actionOrder.id}/return`;
      const res = await apiFetch<{ order: Order }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)));
      showToast(
        actionOrder.type === 'cancel'
          ? 'Order cancelled and inventory restored.'
          : 'Return & refund request submitted.',
        'success'
      );
      setActionOrder(null);
      setReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update order.', 'error');
    }
  };

  const focusedOrder = orderId ? orders.find((o) => String(o.id) === String(orderId)) : null;

  return (
    <div className="max-w-[1150px] mx-auto px-3 sm:px-6 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-[#212121]">
            {focusedOrder ? `Order ${focusedOrder.order_number}` : 'My Orders & Tracking'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track shipments, download receipts, or manage cancellations &amp; returns
          </p>
        </div>
        {focusedOrder && (
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
          >
            View All Orders
          </button>
        )}
      </div>

      {focusedOrder && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-start sm:items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-bold text-emerald-950">
                Order Confirmed — #{focusedOrder.order_number}
              </p>
              <p className="mt-0.5">
                Status: <strong>{focusedOrder.status}</strong> · Estimated Delivery:{' '}
                <strong>{focusedOrder.estimated_delivery}</strong>
              </p>
            </div>
          </div>
          <div className="text-xs font-mono-num text-emerald-800 sm:text-right">
            <div>Subtotal: {formatINR(focusedOrder.subtotal)}</div>
            {focusedOrder.discount_amount > 0 && <div>Discount: −{formatINR(focusedOrder.discount_amount)}</div>}
            <div>Delivery: {focusedOrder.delivery_charge === 0 ? 'FREE' : formatINR(focusedOrder.delivery_charge)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-white rounded-md border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-md border border-slate-200 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold">No orders placed yet</h2>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="mt-4 bg-[#2874F0] text-white text-xs font-semibold px-5 py-2.5 rounded-sm cursor-pointer"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {(focusedOrder ? [focusedOrder] : orders).map((order) => {
            const stepIdx = TRACK_STEPS.indexOf(order.status);
            const isCancelled = order.status === 'Cancelled';
            const isReturn = order.status === 'Return Requested' || order.status === 'Refunded';

            return (
              <div
                key={order.id}
                className="bg-white rounded-md border border-slate-200/80 overflow-hidden"
              >
                {/* Header */}
                <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-slate-500 block">ORDER ID</span>
                      <span className="font-mono-num font-bold text-[#212121]">
                        {order.order_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PLACED ON</span>
                      <span className="font-medium text-slate-800">
                        {formatDateShort(order.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">TOTAL</span>
                      <span className="font-mono-num font-bold text-[#212121]">
                        {formatINR(order.total_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PAYMENT</span>
                      <span className="font-medium text-slate-800">{order.payment_method}</span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded ${
                      isCancelled
                        ? 'bg-red-50 text-red-700'
                        : isReturn
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-blue-50 text-[#2874F0]'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="p-4 sm:p-5 space-y-5">
                  {/* Tracking Progress */}
                  {!isCancelled && !isReturn && (
                    <div className="py-2">
                      <div className="grid grid-cols-5 gap-2">
                        {TRACK_STEPS.map((st, idx) => {
                          const done = stepIdx >= idx;
                          return (
                            <div key={st} className="flex flex-col items-center text-center">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                  done
                                    ? 'bg-[#388E3C] text-white'
                                    : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {idx + 1}
                              </div>
                              <span
                                className={`mt-1.5 text-[11px] font-medium ${
                                  done ? 'text-[#212121]' : 'text-slate-400'
                                }`}
                              >
                                {st}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-600 mt-3 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#2874F0]" />
                        Estimated Delivery: <strong>{order.estimated_delivery}</strong>
                      </p>
                    </div>
                  )}

                  {order.cancel_reason && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                      Cancellation note: {order.cancel_reason}
                    </p>
                  )}
                  {order.return_reason && (
                    <p className="text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded">
                      Return / Refund request: {order.return_reason}
                    </p>
                  )}

                  {/* Items */}
                  <div className="divide-y divide-slate-100">
                    {order.items.map((it) => (
                      <div key={it.id} className="py-2.5 flex items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/product/${it.product_id}`)}
                          className="w-14 h-14 rounded bg-slate-50 border border-slate-100 overflow-hidden shrink-0 cursor-pointer"
                        >
                          <SmartImage src={it.product_image} alt={it.product_name} className="w-full h-full object-cover" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/product/${it.product_id}`)}
                            className="text-sm font-semibold text-[#212121] hover:text-[#2874F0] text-left truncate block max-w-full cursor-pointer"
                          >
                            {it.product_name}
                          </button>
                          <p className="text-xs text-slate-500">
                            {it.variant_label} · Qty: <strong className="font-mono-num">{it.quantity}</strong>
                          </p>
                        </div>
                        <div className="text-sm font-bold font-mono-num text-[#212121]">
                          {formatINR(it.unit_price * it.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions & Shipping Info */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      Deliver to: <strong>{order.address.full_name}</strong> ({order.address.city},{' '}
                      <span className="font-mono-num">{order.address.pincode}</span>)
                    </div>
                    <div className="flex items-center gap-2">
                      {!focusedOrder && (
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="text-[#2874F0] font-semibold hover:underline px-2 py-1 cursor-pointer"
                        >
                          Track Order
                        </button>
                      )}
                      {['Order Placed', 'Confirmed'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => setActionOrder({ id: order.id, type: 'cancel' })}
                          className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-sm font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Order
                        </button>
                      )}
                      {order.status === 'Delivered' && (
                        <button
                          type="button"
                          onClick={() => setActionOrder({ id: order.id, type: 'return' })}
                          className="border border-amber-300 text-amber-800 hover:bg-amber-50 px-3 py-1.5 rounded-sm font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Request Return / Refund
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel / Return Reason Modal */}
      {actionOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={submitAction}
            className="bg-white rounded-md max-w-md w-full p-5 shadow-xl space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-[#212121]">
              {actionOrder.type === 'cancel' ? 'Cancel Order' : 'Request Return / Refund'}
            </h2>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionOrder.type === 'cancel'
                  ? 'Tell us why you would like to cancel...'
                  : 'Describe the issue for return or refund...'
              }
              className="w-full p-3 text-sm border border-slate-300 rounded focus:outline-none focus:border-[#2874F0]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionOrder(null);
                  setReason('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-sm cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-[#2874F0] text-white rounded-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
