import React, { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatINR } from '../lib/format';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';

interface CatalogPageProps {
  categorySlug?: string;
  searchQuery?: string;
}

const SORT_OPTIONS = [
  { id: 'popularity', label: 'Popularity' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'rating', label: 'Customer Ratings' },
  { id: 'newest', label: 'Newest Arrivals' },
];

const PRICE_PRESETS = [
  { label: 'All Prices', min: '', max: '' },
  { label: 'Under ₹2,000', min: '', max: '2000' },
  { label: '₹2,000 – ₹10,000', min: '2000', max: '10000' },
  { label: '₹10,000 – ₹50,000', min: '10000', max: '50000' },
  { label: 'Above ₹50,000', min: '50000', max: '' },
];

export function CatalogPage({ categorySlug = 'all', searchQuery = '' }: CatalogPageProps) {
  const { categories, navigate } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(categorySlug);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('popularity');

  useEffect(() => {
    setSelectedCategory(categorySlug || 'all');
    setSelectedBrands([]);
  }, [categorySlug, searchQuery]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (searchQuery) params.set('q', searchQuery);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (selectedBrands.length > 0) params.set('brand', selectedBrands.join(','));
    if (minRating > 0) params.set('minRating', String(minRating));
    if (minDiscount > 0) params.set('minDiscount', String(minDiscount));
    if (inStockOnly) params.set('inStock', 'true');
    params.set('sort', sort);

    apiFetch<{ products: Product[]; brands: string[] }>(`/api/products?${params.toString()}`)
      .then((res) => {
        if (mounted) {
          setProducts(res.products);
          setAvailableBrands(res.brands);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedCategory, searchQuery, minPrice, maxPrice, selectedBrands, minRating, minDiscount, inStockOnly, sort]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const resetFilters = () => {
    setSelectedCategory(categorySlug || 'all');
    setSelectedBrands([]);
    setMinPrice('');
    setMaxPrice('');
    setMinRating(0);
    setMinDiscount(0);
    setInStockOnly(false);
    setSort('popularity');
  };

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const pageTitle = searchQuery
    ? `Search results for "${searchQuery}"`
    : activeCategoryObj
      ? activeCategoryObj.name
      : 'All Products';

  const hasActiveFilters =
    selectedBrands.length > 0 ||
    minPrice !== '' ||
    maxPrice !== '' ||
    minRating > 0 ||
    minDiscount > 0 ||
    inStockOnly ||
    (categorySlug === 'all' && selectedCategory !== 'all');

  const FilterPanel = (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <span className="font-display font-bold text-base text-[#212121] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#2874F0]" /> Filters
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-[#2874F0] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Clear All
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Category
        </h3>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              if (categorySlug !== 'all' && !searchQuery) navigate('/products');
            }}
            className={`w-full text-left text-xs py-1 px-2 rounded transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-50 text-[#2874F0] font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.slug);
                if (!searchQuery) navigate(`/category/${cat.slug}`);
              }}
              className={`w-full text-left text-xs py-1 px-2 rounded transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-blue-50 text-[#2874F0] font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pt-3 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Price Range
        </h3>
        <div className="space-y-1.5 mb-2.5">
          {PRICE_PRESETS.map((preset) => {
            const active = minPrice === preset.min && maxPrice === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setMinPrice(preset.min);
                  setMaxPrice(preset.max);
                }}
                className={`w-full text-left text-xs py-1 px-2 rounded cursor-pointer ${
                  active ? 'bg-blue-50 text-[#2874F0] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min ₹"
            aria-label="Minimum price"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#2874F0]"
          />
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max ₹"
            aria-label="Maximum price"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#2874F0]"
          />
        </div>
      </div>

      {/* Brands */}
      {availableBrands.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Brand
          </h3>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {availableBrands.map((b) => (
              <label key={b} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b)}
                  onChange={() => toggleBrand(b)}
                  className="accent-[#2874F0] rounded"
                />
                <span>{b}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Customer Ratings */}
      <div className="pt-3 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Customer Ratings
        </h3>
        <div className="space-y-1.5">
          {[4, 3, 0].map((r) => (
            <label key={r} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="ratingFilter"
                checked={minRating === r}
                onChange={() => setMinRating(r)}
                className="accent-[#2874F0]"
              />
              {r === 0 ? (
                <span>All Ratings</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {r} <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> &amp; above
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className="pt-3 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Discount
        </h3>
        <div className="space-y-1.5">
          {[40, 30, 20, 10, 0].map((d) => (
            <label key={d} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="discountFilter"
                checked={minDiscount === d}
                onChange={() => setMinDiscount(d)}
                className="accent-[#2874F0]"
              />
              <span>{d === 0 ? 'Any Discount' : `${d}% or more`}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="pt-3 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Availability
        </h3>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="accent-[#2874F0]"
          />
          <span>Exclude Out of Stock</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white rounded-md border border-slate-200/80 p-4 sticky top-28">
          {FilterPanel}
        </aside>

        {/* Main Results Column */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-md border border-slate-200/80 p-4 sm:p-5">
          {/* Header & Sort Bar */}
          <div className="pb-3 border-b border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold text-[#212121]">
                  {pageTitle}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing <span className="font-semibold text-slate-700 font-mono-num">{products.length}</span> products
                  {activeCategoryObj ? ` · ${activeCategoryObj.description}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => navigate('/products')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Search
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden text-xs font-semibold bg-slate-100 text-slate-800 px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                </button>
              </div>
            </div>

            {/* Sort Tabs */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <span className="text-xs font-semibold text-slate-500 shrink-0 mr-1">Sort By</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-sm border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    sort === opt.id
                      ? 'border-[#2874F0] text-[#2874F0] font-semibold bg-blue-50/50'
                      : 'border-transparent text-slate-600 hover:text-[#2874F0]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Active filter summary */}
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {selectedBrands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBrand(b)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {b} <X className="w-3 h-3" />
                  </button>
                ))}
                {(minPrice || maxPrice) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    Price: {minPrice ? formatINR(Number(minPrice)) : '₹0'} –{' '}
                    {maxPrice ? formatINR(Number(maxPrice)) : 'Any'} <X className="w-3 h-3" />
                  </button>
                )}
                {minRating > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinRating(0)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {minRating}★ &amp; above <X className="w-3 h-3" />
                  </button>
                )}
                {minDiscount > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinDiscount(0)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    {minDiscount}%+ off <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-80 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h2 className="font-display text-lg font-bold text-slate-900">No matching products found</h2>
              <p className="text-sm text-slate-500 mt-1">
                Try clearing your active filters or searching with a different keyword.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="bg-[#2874F0] text-white text-xs font-semibold px-4 py-2 rounded-sm cursor-pointer"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="border border-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-sm cursor-pointer"
                >
                  Browse All Products
                </button>
              </div>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-5"
            >
              <AnimatePresence mode="popLayout">
                {products.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ProductCard product={p} showBuyNow />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 lg:hidden flex"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22 }}
              className="w-80 max-w-[85vw] bg-white h-full p-5 overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-bold text-base">Filter Products</span>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters"
                  className="p-1.5 rounded hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {FilterPanel}
            </motion.div>
            <div className="flex-1" onClick={() => setMobileFiltersOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
