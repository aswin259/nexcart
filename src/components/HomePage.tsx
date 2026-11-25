import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Tag, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';

const BANNERS = [
  {
    id: 1,
    eyebrow: 'Flagship Tech Showcase',
    title: 'Upgrade to Next-Gen Smartphones, Laptops & Audio',
    subtitle: 'Save up to 34% on Titan X15 Pro 5G, Aero Studio ANC, and ZenBook Air 14 with instant bank offers.',
    cta: 'Shop Electronics',
    href: '/category/mobiles-electronics',
    image: '/src/assets/images/banner_electronics_flagship_1795581227834.jpg',
    accent: 'from-[#0D2B6B]/90 via-[#1443A3]/70 to-transparent',
  },
  {
    id: 2,
    eyebrow: 'New Season Edit',
    title: 'Tailored Denim, Leather Sneakers & Everyday Knits',
    subtitle: 'Fresh arrivals crafted for comfort and durability. Flat 40% off across VerveStride & NorthLoft.',
    cta: 'Explore Fashion',
    href: '/category/fashion-clothing',
    image: '/src/assets/images/banner_fashion_lifestyle_1795581228607.jpg',
    accent: 'from-slate-900/85 via-slate-900/55 to-transparent',
  },
  {
    id: 3,
    eyebrow: 'Modern Kitchen & Living',
    title: 'Café-Grade Espresso Makers & Smart Home Tech',
    subtitle: 'Free doorstep delivery and 2-year onsite warranty on AuroraHome appliances.',
    cta: 'Shop Appliances',
    href: '/category/appliances',
    image: '/src/assets/images/banner_home_appliances_1795581229648.jpg',
    accent: 'from-slate-900/85 via-slate-900/55 to-transparent',
  },
];

export function HomePage() {
  const { navigate, categories, recentlyViewed } = useStore();
  const [bannerIdx, setBannerIdx] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ products: Product[] }>('/api/products?limit=60')
      .then((res) => {
        if (mounted) setProducts(res.products);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % BANNERS.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const topDeals = products.filter((p) => p.is_top_deal).slice(0, 5);
  const bestSellers = products.filter((p) => p.is_best_seller).slice(0, 5);
  const recommended = products.filter((p) => p.is_recommended).slice(0, 5);

  const byCat = (slug: string) => products.filter((p) => p.category_slug === slug).slice(0, 4);

  const activeBanner = BANNERS[bannerIdx];

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 space-y-6">
      {/* 1. Category Ribbon Strip */}
      <section className="bg-white rounded-md border border-slate-200/80 shadow-2xs px-3 py-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center justify-between gap-4 min-w-max sm:min-w-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/category/${cat.slug}`)}
              className="group flex flex-col items-center gap-1.5 min-w-[92px] sm:flex-1 text-center cursor-pointer"
            >
              <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden group-hover:border-[#2874F0] transition-colors">
                <SmartImage
                  src={cat.image_url}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-[#2874F0] leading-tight line-clamp-2 max-w-[110px]">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Promotional Banner Carousel */}
      <section aria-label="Featured promotions" className="relative rounded-md overflow-hidden bg-slate-900 shadow-sm h-[250px] sm:h-[340px] lg:h-[380px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeBanner.id}
            initial={{ opacity: 0.4, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.4 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <SmartImage
              src={activeBanner.image}
              alt={activeBanner.title}
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${activeBanner.accent}`} />
            <div className="relative z-10 h-full flex flex-col justify-center px-6 sm:px-12 max-w-2xl text-white">
              <span className="text-xs font-bold uppercase tracking-widest text-[#FFE500] mb-2">
                {activeBanner.eyebrow}
              </span>
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold leading-tight text-balance">
                {activeBanner.title}
              </h1>
              <p className="mt-2.5 text-xs sm:text-sm text-white/90 max-w-lg line-clamp-2">
                {activeBanner.subtitle}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(activeBanner.href)}
                  className="bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-sm inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {activeBanner.cta} <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-sm transition-colors cursor-pointer"
                >
                  View All Deals
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setBannerIdx((i) => (i - 1 + BANNERS.length) % BANNERS.length)}
          aria-label="Previous promotion"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-16 bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center rounded-r-md shadow cursor-pointer z-20"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setBannerIdx((i) => (i + 1) % BANNERS.length)}
          aria-label="Next promotion"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-16 bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center rounded-l-md shadow cursor-pointer z-20"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          {BANNERS.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBannerIdx(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === bannerIdx ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-md h-80 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : (
        <>
          {/* 3. Top Deals Section */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#2874F0]" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#212121]">Top Deals</h2>
                <span className="text-xs text-slate-500 hidden sm:inline">· Handpicked savings across categories</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/products?sort=popularity')}
                className="bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs font-semibold px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer"
              >
                VIEW ALL
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {topDeals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </motion.section>

          {/* 4. Trending Categories Section */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#2874F0]" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#212121]">
                  Trending Categories
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
              >
                Explore full catalog
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className="group flex items-center gap-3.5 p-3 rounded-md border border-slate-200/80 hover:border-[#2874F0] hover:bg-blue-50/40 text-left transition-all cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-md bg-slate-50 overflow-hidden shrink-0">
                    <SmartImage
                      src={cat.image_url}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#212121] group-hover:text-[#2874F0] line-clamp-2">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-[#388E3C] font-semibold mt-0.5">
                      {cat.product_count ?? 3}+ Products
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.section>

          {/* 5. Best Selling Products Section */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#212121]">
                Best Selling Products
              </h2>
              <button
                type="button"
                onClick={() => navigate('/products?sort=rating')}
                className="bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs font-semibold px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer"
              >
                VIEW ALL
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {bestSellers.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </motion.section>

          {/* 6. Recommended Products Section */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2874F0]" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#212121]">
                  Recommended Products
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
              >
                See more
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {recommended.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </motion.section>

          {/* 7. Category Spotlights: Electronics, Fashion, Home Appliances, Grocery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { title: 'Electronics & Mobiles', slug: 'mobiles-electronics' },
              { title: 'Fashion & Footwear', slug: 'fashion-clothing' },
              { title: 'Home Appliances', slug: 'appliances' },
              { title: 'Daily Grocery & Pantry', slug: 'grocery' },
            ].map((sec) => {
              const list = byCat(sec.slug);
              if (list.length === 0) return null;
              return (
                <section
                  key={sec.slug}
                  className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#212121]">
                      {sec.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate(`/category/${sec.slug}`)}
                      className="text-xs font-semibold text-[#2874F0] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {list.slice(0, 3).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* 8. Recently Viewed Products */}
          {recentlyViewed.length > 0 && (
            <section className="bg-white rounded-md border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-[#212121]">
                  Recently Viewed Products
                </h2>
                <span className="text-xs text-slate-500">Pick up where you left off</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {recentlyViewed.slice(0, 5).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
