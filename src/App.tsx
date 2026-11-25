/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AccountPage } from './components/AccountPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AuthPage } from './components/AuthPage';
import { CartPage } from './components/CartPage';
import { CatalogPage } from './components/CatalogPage';
import { CheckoutPage } from './components/CheckoutPage';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { Navbar } from './components/Navbar';
import { OrdersPage } from './components/OrdersPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { SellerDashboardPage } from './components/SellerDashboardPage';
import { StaticInfoPage } from './components/StaticInfoPage';
import { WishlistPage } from './components/WishlistPage';

function ToastStack() {
  const { toasts } = useStore();
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-sm shadow-lg text-sm font-medium border ${
              t.tone === 'success'
                ? 'bg-[#212121] text-white border-[#388E3C]'
                : t.tone === 'error'
                ? 'bg-red-700 text-white border-red-800'
                : 'bg-[#172337] text-white border-[#2874F0]'
            }`}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#4caf50] shrink-0" />
            ) : t.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[#FFE500] shrink-0" />
            )}
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function NexCartRouter() {
  const { route, navigate } = useStore();
  const url = new URL(window.location.origin + route);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  const renderPage = () => {
    if (pathname === '/') {
      return <HomePage />;
    }
    if (pathname === '/products') {
      return <CatalogPage />;
    }
    if (pathname.startsWith('/category/')) {
      const slug = decodeURIComponent(pathname.replace('/category/', ''));
      return <CatalogPage categorySlug={slug} />;
    }
    if (pathname === '/search') {
      return <CatalogPage searchQuery={url.searchParams.get('q') || ''} />;
    }
    if (pathname.startsWith('/product/')) {
      const productId = decodeURIComponent(pathname.replace('/product/', ''));
      return <ProductDetailPage productId={productId} />;
    }
    if (pathname === '/cart') {
      return <CartPage />;
    }
    if (pathname === '/checkout') {
      return <CheckoutPage />;
    }
    if (pathname === '/orders') {
      return <OrdersPage />;
    }
    if (pathname.startsWith('/orders/')) {
      const oid = decodeURIComponent(pathname.replace('/orders/', ''));
      return <OrdersPage orderId={oid || undefined} />;
    }
    if (pathname === '/login') {
      return <AuthPage />;
    }
    if (pathname === '/account') {
      return <AccountPage />;
    }
    if (pathname === '/wishlist') {
      return <WishlistPage />;
    }
    if (pathname === '/seller') {
      return <SellerDashboardPage />;
    }
    if (pathname === '/admin') {
      return <AdminDashboardPage />;
    }
    if (pathname.startsWith('/info/')) {
      const slug = decodeURIComponent(pathname.replace('/info/', ''));
      return <StaticInfoPage slug={slug} />;
    }

    return (
      <div className="max-w-[700px] mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-[#E0E4EB] rounded-sm p-10">
          <h1 className="text-2xl font-bold text-[#212121]">Page Not Found</h1>
          <p className="text-sm text-[#616161] mt-2">
            The page you requested does not exist on NexCart.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2.5 bg-[#2874F0] text-white text-sm font-semibold rounded-sm hover:bg-[#1d63d8]"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F3F6] text-[#212121]">
      <Navbar />
      <main className="flex-1">{renderPage()}</main>
      <Footer />
      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <NexCartRouter />
      </StoreProvider>
    </MotionConfig>
  );
}
