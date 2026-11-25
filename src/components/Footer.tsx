import React from 'react';
import { Globe, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Footer() {
  const { navigate } = useStore();

  return (
    <footer className="bg-[#172337] text-slate-300 mt-12 border-t border-slate-800">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">About</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button type="button" onClick={() => navigate('/info/about')} className="hover:text-white cursor-pointer">
                About NexCart
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/contact')} className="hover:text-white cursor-pointer">
                Contact Us
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/seller')} className="hover:text-white cursor-pointer">
                Sell on NexCart
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/products')} className="hover:text-white cursor-pointer">
                Browse All Catalog
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Help &amp; Support</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button type="button" onClick={() => navigate('/info/payments')} className="hover:text-white cursor-pointer">
                Payments &amp; Razorpay Test Mode
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/shipping')} className="hover:text-white cursor-pointer">
                Shipping &amp; Delivery
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/orders')} className="hover:text-white cursor-pointer">
                Cancellation &amp; Returns
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/support')} className="hover:text-white cursor-pointer">
                24x7 Customer Support
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Consumer Policy</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <button type="button" onClick={() => navigate('/info/return-policy')} className="hover:text-white cursor-pointer">
                Return Policy
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/terms')} className="hover:text-white cursor-pointer">
                Terms of Use
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/security')} className="hover:text-white cursor-pointer">
                Security
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/info/privacy')} className="hover:text-white cursor-pointer">
                Privacy Policy
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Social Media</h3>
          <ul className="space-y-2 text-xs">
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Instagram
              </a>
            </li>
            <li>
              <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> X (Twitter)
              </a>
            </li>
            <li>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> YouTube
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:border-l lg:border-slate-700 lg:pl-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Mail Us &amp; Office</h3>
          <p className="text-xs leading-relaxed text-slate-300">
            NexCart Internet Private Limited,<br />
            Outer Ring Road, Devarabeesanahalli Village,<br />
            Bengaluru, 560103, Karnataka, India
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            <p className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#FFE500]" /> care@nexcart.in
            </p>
            <p className="flex items-center gap-1.5 font-mono-num">
              <Phone className="w-3.5 h-3.5 text-[#FFE500]" /> +91 80 4561 4700
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700/80 bg-[#131d2e]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => navigate('/seller')} className="hover:text-white cursor-pointer">
              Become a Seller
            </button>
            <button type="button" onClick={() => navigate('/admin')} className="hover:text-white cursor-pointer">
              Admin Console
            </button>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Secure Checkout
            </span>
          </div>
          <span>&copy; {new Date().getFullYear()} NexCart.com. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
