import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const INFO_CONTENT: Record<string, { title: string; body: string[] }> = {
  about: {
    title: 'About NexCart',
    body: [
      'NexCart is a modern, customer-first online marketplace connecting trusted sellers with shoppers across India.',
      'From flagship electronics and apparel to home furniture, beauty, grocery, and kitchen appliances, every item is backed by verified seller ratings and transparent pricing.',
    ],
  },
  contact: {
    title: 'Contact NexCart',
    body: [
      'Customer Care Email: care@nexcart.in',
      'Support Hotline: +91 80 4561 4700 (Mon–Sun, 8:00 AM – 10:00 PM IST)',
      'Corporate Office: NexCart Internet Private Limited, Outer Ring Road, Bengaluru 560103.',
    ],
  },
  payments: {
    title: 'Payments & Razorpay Test Mode',
    body: [
      'NexCart supports Cash on Delivery as well as UPI, Credit Cards, Debit Cards, and Net Banking through Razorpay in Test Mode.',
      'All online payment signatures are verified server-side via HMAC-SHA256 before confirming any order.',
    ],
  },
  shipping: {
    title: 'Shipping & Delivery',
    body: [
      'Orders ₹499 and above qualify for free standard delivery (4–5 business days). Express Priority (1–2 days) is available for a flat ₹99 fee.',
      'Use the 6-digit PIN code checker on any product page to verify estimated delivery dates in your city.',
    ],
  },
  support: {
    title: '24x7 Customer Support',
    body: [
      'Need help with an existing shipment, cancellation, or return? Visit My Orders to track your package or raise a return request in one click.',
    ],
  },
  'return-policy': {
    title: '7-Day Return & Refund Policy',
    body: [
      'Delivered items in original condition with tags and packaging can be requested for return or refund directly from the My Orders page.',
    ],
  },
  terms: {
    title: 'Terms of Use',
    body: [
      'All prices displayed on NexCart include applicable taxes. Inventory availability is validated at checkout prior to order confirmation.',
    ],
  },
  security: {
    title: 'Account & Transaction Security',
    body: [
      'Customer passwords are salted and hashed with scrypt. Session cookies are HttpOnly and protected against cross-site request forgery.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Delivery addresses and order details are stored solely to fulfill your purchases and are never shared with unauthorized third parties.',
    ],
  },
};

export function StaticInfoPage({ slug }: { slug: string }) {
  const { navigate } = useStore();
  const content = INFO_CONTENT[slug] || INFO_CONTENT.about;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-md border border-slate-200 p-6 sm:p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xs font-semibold text-[#2874F0] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Storefront
        </button>
        <div className="flex items-center gap-2 text-[#2874F0]">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">NexCart Information</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-[#212121]">{content.title}</h1>
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          {content.body.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
