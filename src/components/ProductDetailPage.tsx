import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Heart,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatDateShort, formatINR, safeImageSrc } from '../lib/format';
import type { Product, Review } from '../types';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';

interface ProductDetailPageProps {
  productId: string;
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const {
    navigate,
    user,
    addToCart,
    toggleWishlist,
    isWishlisted,
    recordRecentlyViewed,
    setBuyNowItem,
    showToast,
  } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [fbt, setFbt] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeImg, setActiveImg] = useState(0);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);

  const [pincode, setPincode] = useState('560103');
  const [pinStatus, setPinStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setActiveImg(0);
    setQty(1);
    setPinStatus(null);
    apiFetch<{
      product: Product;
      reviews: Review[];
      similar: Product[];
      frequentlyBoughtTogether: Product[];
    }>(`/api/products/${encodeURIComponent(productId)}`)
      .then((res) => {
        if (!mounted) return;
        setProduct(res.product);
        setReviews(res.reviews);
        setSimilar(res.similar);
        setFbt(res.frequentlyBoughtTogether);
        recordRecentlyViewed(res.product);

        const initialVar: Record<string, string> = {};
        Object.entries(res.product.variants || {}).forEach(([k, opts]) => {
          if (Array.isArray(opts) && opts.length > 0) {
            initialVar[k] = opts[0];
          }
        });
        setSelectedVariants(initialVar);
      })
      .catch(() => {
        if (mounted) setProduct(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [productId, recordRecentlyViewed]);

  const checkPincode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinLoading(true);
    try {
      const res = await apiFetch<{ available: boolean; message: string }>(
        `/api/pincode/${encodeURIComponent(pincode.trim())}`
      );
      setPinStatus(res);
    } catch (err) {
      setPinStatus({
        available: false,
        message: err instanceof Error ? err.message : 'Unable to verify PIN code.',
      });
    } finally {
      setPinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-md p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          <div className="lg:col-span-5 h-96 bg-slate-100 rounded" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-7 bg-slate-100 w-3/4 rounded" />
            <div className="h-5 bg-slate-100 w-1/3 rounded" />
            <div className="h-32 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Product Not Found</h1>
        <p className="text-sm text-slate-500 mt-2">
          This product may have been removed or the URL is incorrect.
        </p>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="mt-5 bg-[#2874F0] text-white text-sm font-semibold px-6 py-2.5 rounded-sm cursor-pointer"
        >
          Browse Catalog
        </button>
      </div>
    );
  }

  const inStock = product.stock_qty > 0;
  const wishlisted = isWishlisted(product.id);
  const variantLabel =
    Object.entries(selectedVariants)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ') || 'Standard';

  const handleBuyNow = () => {
    if (!inStock) return;
    setBuyNowItem({
      product_id: product.id,
      variant_label: variantLabel,
      quantity: qty,
      product,
    });
    navigate('/checkout');
  };

  const handleAddBundle = async () => {
    await addToCart(product, 1, variantLabel);
    for (const item of fbt) {
      const defVar = Object.values(item.variants || {})[0]?.[0] || 'Standard';
      await addToCart(item, 1, defVar);
    }
    showToast('Added bundle items to your cart.', 'success');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please login to write a verified review.', 'info');
      navigate('/login');
      return;
    }
    setRevSubmitting(true);
    try {
      const res = await apiFetch<{ reviews: Review[]; rating: number; review_count: number }>(
        `/api/products/${product.id}/reviews`,
        {
          method: 'POST',
          body: JSON.stringify({
            rating: revRating,
            title: revTitle,
            comment: revComment,
          }),
        }
      );
      setReviews(res.reviews);
      setProduct((prev) =>
        prev ? { ...prev, rating: res.rating, review_count: res.review_count } : prev
      );
      setRevTitle('');
      setRevComment('');
      showToast('Thank you! Your review has been published.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit review.', 'error');
    } finally {
      setRevSubmitting(false);
    }
  };

  const images = product.images.length > 0 ? product.images : ['/src/assets/images/prod_smartphone_pro_1795581229943.jpg'];
  const bundleTotal = product.price + fbt.reduce((s, p) => s + p.price, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap">
        <button type="button" onClick={() => navigate('/')} className="hover:text-[#2874F0] cursor-pointer">
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <button
          type="button"
          onClick={() => navigate(`/category/${product.category_slug}`)}
          className="hover:text-[#2874F0] cursor-pointer"
        >
          {product.category_name}
        </button>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-slate-700 font-medium truncate">{product.name}</span>
      </nav>

      {/* Main Product Panel */}
      <div className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Multi-Image Gallery with Zoom */}
        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            {/* Thumbnails */}
            <div className="flex sm:flex-col gap-2 overflow-x-auto sm:w-16 shrink-0">
              {images.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onMouseEnter={() => setActiveImg(idx)}
                  onClick={() => setActiveImg(idx)}
                  className={`w-16 h-16 rounded border-2 overflow-hidden bg-slate-50 shrink-0 transition-colors cursor-pointer ${
                    activeImg === idx ? 'border-[#2874F0]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <SmartImage src={img} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Main Image Canvas with Optical Zoom */}
            <div
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setZoomPos({ x, y });
              }}
              onMouseLeave={() => setZoomPos(null)}
              className="relative flex-1 aspect-square rounded-md border border-slate-200 bg-slate-50 overflow-hidden cursor-zoom-in"
            >
              <motion.img
                key={images[activeImg]}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                src={safeImageSrc(images[activeImg])}
                alt={product.name}
                referrerPolicy="no-referrer"
                style={
                  zoomPos
                    ? {
                        transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                        transform: 'scale(1.85)',
                      }
                    : undefined
                }
                className="w-full h-full object-cover transition-transform duration-150 ease-out"
              />
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Primary Purchase Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!inStock}
              onClick={() => addToCart(product, qty, variantLabel)}
              className="h-12 rounded-sm bg-[#FF9F00] hover:bg-[#f09400] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" /> ADD TO CART
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!inStock}
              onClick={handleBuyNow}
              className="h-12 rounded-sm bg-[#FB641B] hover:bg-[#e85811] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4" /> BUY NOW
            </motion.button>
          </div>
        </div>

        {/* Right: Contiguous Purchase & Specification Module */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2874F0]">
              {product.brand} · Sold by {product.seller_name}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#212121] mt-1 leading-snug">
              {product.name}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 bg-[#388E3C] text-white text-xs font-bold px-2 py-0.5 rounded-xs font-mono-num">
                {product.rating.toFixed(1)} <Star className="w-3 h-3 fill-white" />
              </span>
              <span className="text-xs font-medium text-slate-500">
                {product.review_count.toLocaleString('en-IN')} Ratings &amp; {reviews.length} Reviews
              </span>
              <span
                className={`text-xs font-semibold ${
                  inStock ? 'text-[#388E3C]' : 'text-red-600'
                }`}
              >
                {inStock ? `In Stock (${product.stock_qty} units available)` : 'Currently Out of Stock'}
              </span>
            </div>
          </div>

          {/* Pricing Block */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-md p-4">
            <p className="text-xs font-semibold text-[#388E3C]">Special Price</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#212121] font-mono-num">
                {formatINR(product.price)}
              </span>
              {product.original_price > product.price && (
                <>
                  <span className="text-sm text-slate-400 line-through font-mono-num">
                    {formatINR(product.original_price)}
                  </span>
                  <span className="text-sm font-bold text-[#388E3C]">
                    {product.discount_percent}% off
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Inclusive of all taxes</p>
          </div>

          {/* Available Offers */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Available Offers
            </h2>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-[#388E3C] mt-0.5 shrink-0" />
                <span>
                  <strong>Coupon Offer:</strong> Apply <code className="font-mono-num font-bold text-[#2874F0]">WELCOME10</code> at checkout for 10% instant savings (orders ₹999+).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-[#388E3C] mt-0.5 shrink-0" />
                <span>
                  <strong>Flat Discount:</strong> Save ₹500 on orders ₹2,999+ using code <code className="font-mono-num font-bold text-[#2874F0]">SAVE500</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2874F0] mt-0.5 shrink-0" />
                <span>7-Day Easy Replacement &amp; Verified Razorpay Test Mode Checkout.</span>
              </li>
            </ul>
          </div>

          {/* Variants */}
          {Object.entries(product.variants || {}).map(([groupName, options]) => (
            <div key={groupName}>
              <p className="text-xs font-bold text-slate-600 mb-2">{groupName}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const selected = selectedVariants[groupName] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setSelectedVariants((prev) => ({ ...prev, [groupName]: opt }))
                      }
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#2874F0] bg-blue-50 text-[#2874F0]'
                          : 'border-slate-300 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity + PIN Code Checker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2">Quantity</p>
              <div className="inline-flex items-center border border-slate-300 rounded-sm">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-bold font-mono-num">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock_qty), q + 1))}
                  aria-label="Increase quantity"
                  className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2874F0]" /> Check Delivery Availability
              </p>
              <form onSubmit={checkPincode} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN"
                  aria-label="Delivery PIN code"
                  className="w-36 h-9 px-3 text-xs font-mono-num border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="h-9 px-3 text-xs font-semibold text-[#2874F0] hover:bg-blue-50 border border-[#2874F0]/30 rounded-sm cursor-pointer"
                >
                  {pinLoading ? 'Checking...' : 'Check'}
                </button>
              </form>
              {pinStatus && (
                <p
                  className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                    pinStatus.available ? 'text-[#388E3C]' : 'text-red-600'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinStatus.message}</span>
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="pt-3 border-t border-slate-100">
            <h2 className="text-sm font-bold text-[#212121] mb-1.5">Product Description</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
          </div>

          {/* Specifications */}
          {Object.keys(product.specs || {}).length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h2 className="text-sm font-bold text-[#212121] mb-3">Specifications</h2>
              <div className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-200">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 text-xs">
                    <div className="bg-slate-50 px-3.5 py-2.5 font-medium text-slate-500">{k}</div>
                    <div className="col-span-2 px-3.5 py-2.5 text-slate-800 font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Frequently Bought Together */}
      {fbt.length > 0 && (
        <section className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold text-[#212121] mb-4">
            Frequently Bought Together
          </h2>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {[product, ...fbt].map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 && <span className="text-xl font-bold text-slate-400">+</span>}
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${item.id}`)}
                    className="w-40 p-2.5 rounded border border-slate-200 hover:border-[#2874F0] text-left cursor-pointer"
                  >
                    <div className="aspect-square bg-slate-50 rounded overflow-hidden mb-2">
                      <SmartImage src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs font-bold font-mono-num text-[#212121] mt-0.5">
                      {formatINR(item.price)}
                    </p>
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="lg:border-l lg:border-slate-200 lg:pl-6 text-center lg:text-left">
              <p className="text-xs text-slate-500">Bundle Price ({1 + fbt.length} items)</p>
              <p className="text-2xl font-extrabold font-mono-num text-[#212121] mt-0.5">
                {formatINR(bundleTotal)}
              </p>
              <button
                type="button"
                onClick={handleAddBundle}
                className="mt-3 bg-[#FF9F00] hover:bg-[#eb9300] text-white text-xs font-bold px-5 py-2.5 rounded-sm cursor-pointer"
              >
                ADD ALL {1 + fbt.length} TO CART
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Customer Reviews & Ratings */}
      <section className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#212121]">
            Customer Reviews &amp; Ratings
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-extrabold font-mono-num text-[#212121]">
              {product.rating.toFixed(1)}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(product.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Based on {product.review_count.toLocaleString('en-IN')} customer ratings
              </p>
            </div>
          </div>

          <form onSubmit={handleReviewSubmit} className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Write a Review</h3>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRevRating(r)}
                  aria-label={`Rate ${r} stars`}
                  className="p-1 cursor-pointer"
                >
                  <Star
                    className={`w-5 h-5 ${
                      r <= revRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={revTitle}
              onChange={(e) => setRevTitle(e.target.value)}
              placeholder="Review headline"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#2874F0]"
            />
            <textarea
              required
              rows={3}
              value={revComment}
              onChange={(e) => setRevComment(e.target.value)}
              placeholder="Share your experience with quality, fit, or delivery..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#2874F0]"
            />
            <button
              type="submit"
              disabled={revSubmitting}
              className="bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs font-semibold px-4 py-2 rounded-sm cursor-pointer disabled:opacity-50"
            >
              {revSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 divide-y divide-slate-100">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 py-6">No reviews yet. Be the first to review!</p>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="py-4 first:pt-0">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 bg-[#388E3C] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-xs font-mono-num">
                    {rev.rating} <Star className="w-2.5 h-2.5 fill-white" />
                  </span>
                  <span className="text-sm font-bold text-[#212121]">{rev.title}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{rev.comment}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-600">{rev.author_name}</span>
                  <span className="inline-flex items-center gap-1 text-[#388E3C]">
                    <CheckCircle2 className="w-3 h-3" /> Certified Buyer
                  </span>
                  <span>·</span>
                  <span>{formatDateShort(rev.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold text-[#212121] mb-4">Similar Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
