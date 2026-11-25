import React, { useState } from 'react';
import {
  Heart,
  LogOut,
  MapPin,
  Package,
  Plus,
  Store,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { Address, User } from '../types';

export function AccountPage() {
  const {
    user,
    setUserState,
    addresses,
    setAddressesState,
    wishlist,
    navigate,
    logout,
    showToast,
  } = useStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addrForm, setAddrForm] = useState({
    full_name: user?.name || '',
    phone: user?.mobile || '',
    pincode: '',
    address_line: '',
    city: '',
    state: '',
    is_default: false,
  });

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center bg-white rounded-md border border-slate-200 mt-6 p-8">
        <UserIcon className="w-12 h-12 text-[#2874F0]/40 mx-auto mb-3" />
        <h1 className="font-display text-xl font-bold">Sign in to manage your account</h1>
        <button
          type="button"
          onClick={() => navigate('/login?redirect=/account')}
          className="mt-4 bg-[#2874F0] text-white text-sm font-semibold px-6 py-2.5 rounded-sm cursor-pointer"
        >
          Login / Sign Up
        </button>
      </div>
    );
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email, mobile }),
      });
      setUserState(res.user);
      showToast('Profile updated successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ addresses: Address[] }>('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(addrForm),
      });
      setAddressesState(res.addresses);
      setShowAddForm(false);
      setAddrForm({
        full_name: user.name,
        phone: user.mobile || '',
        pincode: '',
        address_line: '',
        city: '',
        state: '',
        is_default: false,
      });
      showToast('Address added.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add address.', 'error');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const res = await apiFetch<{ addresses: Address[] }>(`/api/auth/addresses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_default: true }),
      });
      setAddressesState(res.addresses);
      showToast('Default delivery address updated.', 'info');
    } catch {
      // ignore
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      const res = await apiFetch<{ addresses: Address[] }>(`/api/auth/addresses/${id}`, {
        method: 'DELETE',
      });
      setAddressesState(res.addresses);
      showToast('Address removed.', 'info');
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Sidebar */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-4 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#2874F0]/10 text-[#2874F0] font-display font-bold text-lg flex items-center justify-center">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Hello,</p>
            <p className="font-display font-bold text-base text-[#212121] truncate">{user.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200/80 divide-y divide-slate-100 text-sm">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
          >
            <span className="flex items-center gap-2.5 font-semibold text-slate-700">
              <Package className="w-4 h-4 text-[#2874F0]" /> My Orders
            </span>
            <span className="text-xs text-[#2874F0]">View</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/wishlist')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
          >
            <span className="flex items-center gap-2.5 font-semibold text-slate-700">
              <Heart className="w-4 h-4 text-[#2874F0]" /> My Wishlist
            </span>
            <span className="text-xs font-mono-num text-slate-500">{wishlist.length}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/seller')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
          >
            <span className="flex items-center gap-2.5 font-semibold text-slate-700">
              <Store className="w-4 h-4 text-[#2874F0]" /> Seller Dashboard
            </span>
            <span className="text-xs text-[#2874F0]">Open</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full px-4 py-3.5 flex items-center gap-2.5 font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:col-span-8 space-y-5">
        {/* Profile Form */}
        <section className="bg-white rounded-md border border-slate-200/80 p-5">
          <h1 className="font-display text-lg font-bold text-[#212121] mb-4">
            Personal Information
          </h1>
          <form onSubmit={handleProfileSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                className="w-full h-10 px-3 text-sm font-mono-num border border-slate-300 rounded-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="h-10 px-6 bg-[#2874F0] hover:bg-[#1D5ED4] text-white text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        {/* Manage Addresses */}
        <section className="bg-white rounded-md border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#212121] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2874F0]" /> Manage Delivery Addresses
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs font-semibold text-[#2874F0] border border-[#2874F0]/30 px-3 py-1.5 rounded-sm flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Address
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddAddress} className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={addrForm.full_name}
                  onChange={(e) => setAddrForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Full Name"
                  className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                />
                <input
                  type="tel"
                  required
                  value={addrForm.phone}
                  onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Mobile Number"
                  className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm font-mono-num"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={addrForm.pincode}
                  onChange={(e) => setAddrForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '') }))}
                  placeholder="PIN Code"
                  className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm font-mono-num"
                />
                <input
                  type="text"
                  required
                  value={addrForm.city}
                  onChange={(e) => setAddrForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="City"
                  className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                />
                <input
                  type="text"
                  required
                  value={addrForm.address_line}
                  onChange={(e) => setAddrForm((p) => ({ ...p, address_line: e.target.value }))}
                  placeholder="Street, House/Flat No., Landmark"
                  className="sm:col-span-2 h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                />
                <input
                  type="text"
                  required
                  value={addrForm.state}
                  onChange={(e) => setAddrForm((p) => ({ ...p, state: e.target.value }))}
                  placeholder="State"
                  className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={addrForm.is_default}
                  onChange={(e) => setAddrForm((p) => ({ ...p, is_default: e.target.checked }))}
                  className="accent-[#2874F0]"
                />
                Set as default delivery address
              </label>
              <button
                type="submit"
                className="bg-[#2874F0] text-white text-xs font-semibold px-4 py-2 rounded-sm cursor-pointer"
              >
                Save Address
              </button>
            </form>
          )}

          {addresses.length === 0 ? (
            <p className="text-sm text-slate-500">No saved delivery addresses yet.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 border border-slate-200 rounded flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm text-[#212121]">
                      {a.full_name} · <span className="font-mono-num">{a.phone}</span>
                      {a.is_default === 1 && (
                        <span className="ml-2 text-[11px] font-semibold text-[#388E3C]">Default</span>
                      )}
                    </p>
                    <p className="text-slate-600">
                      {a.address_line}, {a.city}, {a.state} —{' '}
                      <strong className="font-mono-num">{a.pincode}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.is_default === 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(a.id)}
                        className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(a.id)}
                      aria-label="Delete address"
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
