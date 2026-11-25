import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

export function AuthPage() {
  const { navigate, refreshAuth, showToast, route } = useStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPw, setShowPw] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [devCodeHint, setDevCodeHint] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget = (() => {
    try {
      const u = new URL(window.location.origin + route);
      const r = u.searchParams.get('redirect');
      return r && r.startsWith('/') ? r : '/';
    } catch {
      return '/';
    }
  })();

  const pwChecks = {
    len: password.length >= 8,
    alphaNum: /[A-Za-z]/.test(password) && /[0-9]/.test(password),
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      await refreshAuth();
      showToast('Welcome back to NexCart!', 'success');
      navigate(redirectTarget);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, mobile, password }),
      });
      await refreshAuth();
      showToast('Account created! Welcome to NexCart.', 'success');
      navigate(redirectTarget);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Registration failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string; devResetCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ identifier }),
        }
      );
      showToast(res.message, 'info');
      if (res.devResetCode) setDevCodeHint(res.devResetCode);
      setResetStep('verify');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ identifier, code: resetCode, newPassword }),
      });
      showToast(res.message, 'success');
      setMode('login');
      setResetStep('request');
      setResetCode('');
      setDevCodeHint('');
      setNewPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Flipkart-style Blue Panel */}
        <div className="md:col-span-5 bg-[#2874F0] text-white p-7 flex flex-col justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FFE500]">
              <ShoppingBag className="w-4 h-4" /> NexCart Account
            </span>
            <h1 className="font-display text-2xl font-bold mt-3">
              {mode === 'login'
                ? 'Login'
                : mode === 'register'
                  ? "Looks like you're new here!"
                  : 'Reset Password'}
            </h1>
            <p className="text-sm text-white/85 mt-2 leading-relaxed">
              {mode === 'login'
                ? 'Get access to your Orders, Wishlist, Saved Addresses, and personalized Deals.'
                : mode === 'register'
                  ? 'Sign up with your email and mobile number to start shopping seamlessly.'
                  : 'Verify your email or mobile to securely reset your account password.'}
            </p>
          </div>
          <div className="mt-8 pt-4 border-t border-white/20 text-xs text-white/80 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Salted scrypt hashing &amp; encrypted session cookies</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-8">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email or 10-digit Mobile Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or 9876543210"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-10 pl-3 pr-10 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label="Toggle password visibility"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-[#FB641B] hover:bg-[#e85811] text-white font-bold text-sm rounded-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Login'}
              </button>

              <div className="pt-4 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
                >
                  New to NexCart? Create an account
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya@example.com"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mobile Number (10 digits)
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full h-10 px-3 text-sm font-mono-num border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars with letters & numbers"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                />
                <div className="mt-1.5 flex gap-3 text-[11px]">
                  <span className={pwChecks.len ? 'text-[#388E3C] font-semibold' : 'text-slate-400'}>
                    8+ characters
                  </span>
                  <span className={pwChecks.alphaNum ? 'text-[#388E3C] font-semibold' : 'text-slate-400'}>
                    Letters &amp; numbers
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-[#FB641B] hover:bg-[#e85811] text-white font-bold text-sm rounded-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="pt-3 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
                >
                  Existing User? Log in
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <div className="space-y-4">
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <KeyRound className="w-4 h-4 text-[#2874F0]" /> Request Password Reset Code
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter registered email or mobile"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm focus:outline-none focus:border-[#2874F0]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-10 bg-[#2874F0] text-white text-sm font-semibold rounded-sm cursor-pointer"
                  >
                    {submitting ? 'Generating...' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="space-y-3.5">
                  {devCodeHint && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                      Preview verification code: <strong className="font-mono-num">{devCodeHint}</strong>
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit verification code"
                    className="w-full h-10 px-3 text-sm font-mono-num border border-slate-300 rounded-sm"
                  />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (8+ chars, letters & numbers)"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-sm"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-10 bg-[#FB641B] text-white text-sm font-bold rounded-sm cursor-pointer"
                  >
                    {submitting ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetStep('request');
                }}
                className="text-xs font-semibold text-[#2874F0] hover:underline cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
