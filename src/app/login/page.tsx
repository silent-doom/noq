'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    const stored = localStorage.getItem('noq_business_auth');
    if (stored) {
      try {
        const { dashboardUrl } = JSON.parse(stored);
        if (dashboardUrl) window.location.href = dashboardUrl;
      } catch {}
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Persist login across devices
        localStorage.setItem(
          'noq_business_auth',
          JSON.stringify({
            streamId: json.streamId,
            businessName: json.businessName,
            sessionToken: json.sessionToken,
            dashboardUrl: json.dashboardUrl,
          })
        );
        // Also set session auth so the dashboard PIN overlay is bypassed
        sessionStorage.setItem(`noq_auth_${json.streamId}`, 'true');
        if (json.sessionToken) {
          sessionStorage.setItem(`noq_token_${json.streamId}`, json.sessionToken);
        }
        window.location.href = json.dashboardUrl;
      } else {
        setError(json.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow background (GPU-friendly radial gradients) */}
      <div className="absolute inset-0 pointer-events-none transform-gpu overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px]"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px]"
          style={{
            background: 'radial-gradient(circle, rgba(13, 148, 136, 0.10) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <span className="text-4xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors duration-200">
              noQ
            </span>
            <span className="text-[11px] bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 font-mono font-bold px-2 py-1 rounded-lg tracking-widest">
              OPERATOR
            </span>
          </Link>
          <p className="text-zinc-500 text-sm mt-3 font-medium">
            Sign in to your operator dashboard
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl shadow-black/60">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight">Welcome back</h1>
            <p className="text-zinc-500 text-xs mt-1 font-medium">
              Access your queue management dashboard from any device.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username or Phone */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Username or Mobile Number
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="e.g. 9876543210 or clinic username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
                />
              </div>
            </div>

            {/* PIN or Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                6-Digit PIN or Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="6-digit PIN or password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950/60 border border-red-800/60 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-300 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-extrabold py-4 rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In to Dashboard →'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-xs text-zinc-500">
            New to noQ?{' '}
            <Link
              href="/signup"
              className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
            >
              Create your business account →
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-zinc-600 mt-6 space-y-2">
          <div className="flex items-center justify-center gap-4 text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-300 transition">Terms & Conditions</Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-zinc-300 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/mou" className="hover:text-zinc-300 transition">Doctor MoU</Link>
          </div>
          <div className="flex items-center justify-center gap-2 text-zinc-600 text-[10px]">
            <span>© 2026 noQ Virtual Queue Systems</span>
            <span>•</span>
            <Link href="/superadmin" className="hover:text-zinc-400 transition underline underline-offset-2">
              Super Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
