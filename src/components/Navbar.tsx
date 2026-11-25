import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatINR } from '../lib/format';
import { SmartImage } from './SmartImage';

interface SuggestionItem {
  id: number;
  name: string;
  brand: string;
  price: number;
  category_name: string;
  category_slug: string;
  image: string;
}

export function Navbar() {
  const { route, navigate, user, cartCount, wishlist, categories, logout } = useStore();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.origin + route);
    if (url.pathname === '/search') {
      setQuery(url.searchParams.get('q') || '');
    }
  }, [route]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ suggestions: SuggestionItem[] }>(
          `/api/products/suggestions?q=${encodeURIComponent(trimmed)}`
        );
        setSuggestions(res.suggestions);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    setShowSug(false);
    setMobileMenuOpen(false);
    if (!trimmed) {
      navigate('/products');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setShowSug(false);
    if (route.startsWith('/search')) {
      navigate('/products');
    }
  };

  const activeCategorySlug = route.startsWith('/category/')
    ? route.replace('/category/', '').split('?')[0]
    : '';

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* Main Blue Navigation Bar */}
      <div className="bg-[#2874F0] text-white">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          {/* Mobile Burger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 -ml-1 rounded-md hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex flex-col items-start shrink-0 text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded px-1"
          >
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight leading-none text-white">
              NexCart
            </span>
            <span className="text-[10px] font-medium italic text-white/85 leading-none mt-0.5 flex items-center gap-1">
              Explore <span className="text-[#FFE500] font-bold not-italic">Plus</span>
            </span>
          </button>

          {/* Desktop Search Bar */}
          <div ref={searchBoxRef} className="relative flex-1 max-w-2xl hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                value={query}
                onFocus={() => setShowSug(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSug(true);
                }}
                placeholder="Search for products, brands and more"
                aria-label="Search products"
                className="w-full h-10 pl-4 pr-20 rounded-sm bg-white text-[#212121] text-sm placeholder:text-[#757575] focus:outline-none shadow-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-10 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-[#2874F0] hover:text-[#1D5ED4] cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            <AnimatePresence>
              {showSug && query.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-10.5 bg-white text-[#212121] rounded-b-md shadow-xl border border-slate-200 overflow-hidden z-50"
                >
                  {suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 flex items-center justify-between">
                      <span>No instant matches for &ldquo;{query.trim()}&rdquo;</span>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="text-[#2874F0] font-semibold hover:underline cursor-pointer"
                      >
                        Search all products
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setShowSug(false);
                            navigate(`/product/${s.id}`);
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50/60 text-left transition-colors cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                            <SmartImage src={s.image} alt={s.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                            <p className="text-xs text-slate-500">
                              {s.brand} · in <span className="text-[#2874F0]">{s.category_name}</span>
                            </p>
                          </div>
                          <span className="text-xs font-semibold font-mono-num text-slate-700 shrink-0">
                            {formatINR(s.price)}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="w-full px-4 py-2 text-xs font-semibold text-[#2874F0] bg-slate-50 hover:bg-blue-50 text-center cursor-pointer"
                      >
                        View all search results for &ldquo;{query.trim()}&rdquo;
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Navigation Actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-5 shrink-0">
            {/* Login / Account */}
            {!user ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="bg-white text-[#2874F0] hover:bg-blue-50 font-semibold text-sm px-4 sm:px-6 py-1.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Login
              </button>
            ) : (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[100px] truncate hidden sm:inline">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white text-[#212121] rounded-md shadow-xl border border-slate-200 py-1.5 z-50"
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/account');
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-[#2874F0]" /> My Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/orders');
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Package className="w-4 h-4 text-[#2874F0]" /> Orders
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/wishlist');
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Heart className="w-4 h-4 text-[#2874F0]" /> Wishlist
                        </span>
                        <span className="text-xs text-slate-500 font-mono-num">{wishlist.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/seller');
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Store className="w-4 h-4 text-[#2874F0]" /> Seller Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/admin');
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#2874F0]" /> Admin Console
                      </button>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" /> Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Become a Seller */}
            <button
              type="button"
              onClick={() => navigate('/seller')}
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold hover:text-white/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Store className="w-4 h-4" />
              <span>Become a Seller</span>
            </button>

            {/* Admin quick access */}
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hidden xl:flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>

            {/* Wishlist quick link */}
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              className="hidden md:flex items-center gap-1 text-sm font-semibold hover:text-white/90 transition-colors cursor-pointer whitespace-nowrap relative"
              aria-label="Wishlist"
            >
              <Heart className="w-4 h-4" />
              {wishlist.length > 0 && (
                <span className="text-[11px] font-mono-num bg-white/20 px-1.5 py-0.5 rounded-full">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Cart Button with Live Animated Count */}
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="flex items-center gap-2 text-sm font-semibold hover:bg-white/10 px-2.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap"
              aria-label={`Cart with ${cartCount} items`}
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <AnimatePresence mode="popLayout">
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFE500] text-[#212121] text-[11px] font-bold font-mono-num flex items-center justify-center shadow-xs"
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="hidden sm:inline">Cart</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-3 pb-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands and more"
              aria-label="Search products on mobile"
              className="w-full h-9 pl-3.5 pr-16 rounded-sm bg-white text-[#212121] text-sm placeholder:text-[#757575] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-9 p-1 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-[#2874F0]"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Category Navigation Strip (Desktop & Tablet) */}
      <nav
        aria-label="Product categories"
        className="bg-white border-b border-slate-200 hidden lg:block"
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar h-11">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className={`text-xs font-semibold whitespace-nowrap py-2 border-b-2 transition-colors cursor-pointer ${
              route === '/products'
                ? 'border-[#2874F0] text-[#2874F0]'
                : 'border-transparent text-slate-700 hover:text-[#2874F0]'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/category/${cat.slug}`)}
              className={`text-xs font-semibold whitespace-nowrap py-2 border-b-2 transition-colors cursor-pointer ${
                activeCategorySlug === cat.slug
                  ? 'border-[#2874F0] text-[#2874F0]'
                  : 'border-transparent text-slate-700 hover:text-[#2874F0]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile Slide-Down Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white border-b border-slate-200 overflow-hidden shadow-lg"
          >
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/products');
                  }}
                  className="text-left text-xs font-semibold px-3 py-2.5 rounded bg-slate-50 hover:bg-blue-50 text-slate-800"
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(`/category/${cat.slug}`);
                    }}
                    className="text-left text-xs font-semibold px-3 py-2.5 rounded bg-slate-50 hover:bg-blue-50 text-slate-800 truncate"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(user ? '/account' : '/login');
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded bg-[#2874F0] text-white"
                >
                  {user ? 'My Account' : 'Login / Signup'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/orders');
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-700"
                >
                  Orders
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/wishlist');
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-700"
                >
                  Wishlist ({wishlist.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/seller');
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-700"
                >
                  Become a Seller
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/admin');
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-700"
                >
                  Admin Console
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
