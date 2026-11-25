# NexCart — E-Commerce Marketplace

A full-stack, Flipkart-inspired e-commerce platform built with React, TypeScript, Tailwind CSS, Express, and SQLite (`node:sqlite`).

## Features

- **Storefront & Navigation**: Responsive blue-and-white header with NexCart brand, search bar with live autocomplete suggestions, Login/Account menu, live Cart counter, Become a Seller portal, and 8 category routes.
- **8 Product Categories**: Mobiles and Electronics, Fashion and Clothing, Home and Furniture, Beauty and Personal Care, Grocery, Appliances, Sports and Fitness, and Books and Accessories.
- **Product Listing & Search**: Multi-facet filters (price range, brand, rating, discount, availability, category), 5 sort modes, and instant clear filters.
- **Product Details**: Multi-image gallery with hover zoom, color/size variants, PIN code delivery availability check, quantity selector, wishlist toggle, specifications, Frequently Bought Together bundle, Similar Products, and verified Customer Reviews.
- **User Authentication**: Email or mobile number login, registration with password strength validation, Forgot Password reset flow, profile management, address book, wishlist, and order history. Passwords are salted and hashed with `crypto.scryptSync`.
- **Cart & Checkout**: Persistent cart, coupon codes (`WELCOME10`, `SAVE500`, `FREESHIP`), delivery speed selection, Cash on Delivery, and Razorpay Test Mode checkout with server-side HMAC-SHA256 signature verification.
- **Orders & Tracking**: Unique order IDs, step-by-step tracking (`Order Placed` -> `Confirmed` -> `Shipped` -> `Out for Delivery` -> `Delivered`), cancellation, and return/refund requests.
- **Seller Dashboard (`/seller`)**: Seller registration, product management, price & stock updates, seller order tracking, and earnings analytics.
- **Admin Dashboard (`/admin`)**: First-run secure admin setup or environment passcode login, sales analytics, product CRUD with image uploads, category & inventory management, order status updates, coupon management, customer accounts, and review moderation.

## Prerequisites

- Node.js `v22.14+` (uses built-in `node:sqlite`)
- npm

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment template and configure optional secrets:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_PATH`: Path to SQLite database file (defaults to `./nexcart.db`).
   - `ADMIN_EMAIL` & `ADMIN_PASSCODE`: Optional server-side admin login credentials. If left unset, visit `/admin` in the browser to claim the first admin account via the one-time setup form.
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Your Razorpay **Test Mode** API keys for verifying UPI/Card/Netbanking payments on the backend.

3. Run in development mode (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```

4. Build and run for production:
   ```bash
   npm run build
   npm start
   ```

## Sample Coupons

- `WELCOME10`: 10% off (max ₹1,000) on orders ₹999+
- `SAVE500`: ₹500 off on orders ₹2,999+
- `FREESHIP`: ₹99 delivery fee waiver on orders ₹499+
