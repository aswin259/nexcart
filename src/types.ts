export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  sort_order: number;
  product_count?: number;
}

export interface Product {
  id: number;
  seller_id: number;
  seller_name?: string;
  category_id: number;
  category_slug?: string;
  category_name?: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  specs: Record<string, string>;
  variants: Record<string, string[]>;
  original_price: number;
  price: number;
  discount_percent: number;
  rating: number;
  review_count: number;
  stock_qty: number;
  sku?: string;
  images: string[];
  is_top_deal: number;
  is_best_seller: number;
  is_recommended: number;
  is_trending: number;
  created_at?: string;
}

export interface Review {
  id: number;
  product_id: number;
  user_id: number | null;
  author_name: string;
  rating: number;
  title: string;
  comment: string;
  verified_purchase: number;
  created_at: string;
}

export interface Address {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  pincode: string;
  address_line: string;
  city: string;
  state: string;
  is_default: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: 'customer' | 'seller' | 'admin';
  created_at: string;
}

export interface SellerProfile {
  id: number;
  user_id: number | null;
  store_name: string;
  gst_number: string;
  pan_number: string;
  support_email: string;
  verified: number;
  total_earnings: number;
  created_at: string;
}

export interface CartItem {
  id?: number;
  product_id: number;
  variant_label: string;
  quantity: number;
  product: Product;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  seller_id: number;
  product_name: string;
  product_image: string;
  variant_label: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  customer_name?: string;
  customer_email?: string;
  address: {
    full_name: string;
    phone: string;
    pincode: string;
    address_line: string;
    city: string;
    state: string;
  };
  delivery_option: 'standard' | 'express';
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  total_amount: number;
  coupon_code: string | null;
  payment_method: string;
  payment_status: string;
  status:
    | 'Order Placed'
    | 'Confirmed'
    | 'Shipped'
    | 'Out for Delivery'
    | 'Delivered'
    | 'Cancelled'
    | 'Return Requested'
    | 'Refunded';
  estimated_delivery: string;
  cancel_reason: string | null;
  return_reason: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_discount: number;
  active: number;
  expires_at: string;
}
