import React, { useState } from 'react';
import { Check, Heart, ShoppingCart, Star, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/format';
import type { Product } from '../types';
import { SmartImage } from './SmartImage';

interface ProductCardProps {
  product: Product;
  showBuyNow?: boolean;
}

export function ProductCard({ product, showBuyNow = false }: ProductCardProps) {
  const { navigate, addToCart, toggleWishlist, isWishlisted, setBuyNowItem } = useStore();
  const [justAdded, setJustAdded] = useState(false);

  const wishlisted = isWishlisted(product.id);
  const inStock = product.stock_qty > 0;
  const firstVariant = Object.values(product.variants || {})[0]?.[0] || 'Standard';

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!inStock) return;
    await addToCart(product, 1, firstVariant);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!inStock) return;
    setBuyNowItem({
      product_id: product.id,
      variant_label: firstVariant,
      quantity: 1,
      product,
    });
    navigate('/checkout');
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => navigate(`/product/${product.id}`)}
      className="group bg-white rounded-md border border-slate-200/80 hover:border-blue-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden cursor-pointer relative"
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        <SmartImage
          src={product.images[0]}
          alt={product.name}
          fallbackLabel={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product);
          }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {!inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 text-white text-[11px] font-semibold text-center py-1">
            Out of Stock
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="uppercase tracking-wide font-medium truncate">{product.brand}</span>
          {product.discount_percent > 0 && (
            <span className="text-[#388E3C] font-semibold shrink-0">{product.discount_percent}% off</span>
          )}
        </div>

        <h3 className="mt-1 text-sm font-semibold text-[#212121] line-clamp-2 group-hover:text-[#2874F0] transition-colors leading-snug min-h-[2.5rem]">
          {product.name}
        </h3>

        <p className="mt-1 text-xs text-slate-500 line-clamp-1">{product.description}</p>

        {/* Rating row */}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-[#388E3C] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-xs font-mono-num">
            {product.rating.toFixed(1)} <Star className="w-2.5 h-2.5 fill-white" />
          </span>
          <span className="text-xs text-slate-500 font-mono-num">
            ({product.review_count.toLocaleString('en-IN')})
          </span>
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            {inStock ? 'In Stock' : 'Unavailable'}
          </span>
        </div>

        {/* Price row */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-base font-bold text-[#212121] font-mono-num">
            {formatINR(product.price)}
          </span>
          {product.original_price > product.price && (
            <span className="text-xs text-slate-400 line-through font-mono-num">
              {formatINR(product.original_price)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={!inStock}
            onClick={handleAdd}
            className={`flex-1 h-9 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              justAdded
                ? 'bg-[#388E3C] text-white'
                : 'bg-[#FF9F00] hover:bg-[#f29600] text-white'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
              </>
            )}
          </motion.button>

          {showBuyNow && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={!inStock}
              onClick={handleBuyNow}
              className="flex-1 h-9 rounded-sm bg-[#FB641B] hover:bg-[#e85811] text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-3.5 h-3.5" /> Buy Now
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
