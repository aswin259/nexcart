import React from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';

export function WishlistPage() {
  const { wishlist, navigate } = useStore();

  return (
    <div className="max-w-[1300px] mx-auto px-3 sm:px-6 py-5">
      <div className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
          <h1 className="font-display text-xl font-bold text-[#212121]">
            My Wishlist ({wishlist.length})
          </h1>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
          >
            Continue Shopping
          </button>
        </div>

        {wishlist.length === 0 ? (
          <div className="py-14 text-center max-w-md mx-auto">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-slate-800">Empty Wishlist</h2>
            <p className="text-sm text-slate-500 mt-1">
              Save products you love by tapping the heart icon on any product card.
            </p>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="mt-5 bg-[#2874F0] text-white text-xs font-semibold px-5 py-2.5 rounded-sm cursor-pointer"
            >
              Explore Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {wishlist.map((p) => (
              <ProductCard key={p.id} product={p} showBuyNow />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
