'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NumberSlider } from '@/components/NumberSlider';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

export default function SignupPage() {
  // Account credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Business info
  const [bizName, setBizName] = useState('');
  const [category, setCategory] = useState('clinic');
  const [phone, setPhone] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('123456');
  const [basePace, setBasePace] = useState(15);
  const [capacity, setCapacity] = useState(100);

  // Hours & structure
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [operatingDays, setOperatingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [queueStructure, setQueueStructure] = useState<'UNIFIED_PARALLEL' | 'DEDICATED_STREAMS'>('UNIFIED_PARALLEL');

  // Station counts
  const [countA, setCountA] = useState(2);
  const [countB, setCountB] = useState(1);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Account, Step 2: Business

  const toggleDay = (day: string) => {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSignup = async (e: React.FormEvent, isTrial: boolean = false) => {
    e.preventDefault();
    if (loading) return;

    // Validation
    if (!username.trim()) { setError('Username is required.'); return; }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (/\s/.test(username.trim())) { setError('Username cannot contain spaces.'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!bizName.trim()) { setError('Business name is required.'); return; }

    setLoading(true);
    setError(null);

    try {
      const stationCounts: Record<string, number> = {
        consultationRooms: countA,
        stylingChairs: countA,
        hostTables: countA,
        counters: countA,
        examBeds: countB,
        washBasins: countB,
        expressCounters: countB,
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: bizName,
          category,
          phone,
          googleMapsUrl: googleMapsUrl.trim(),
          adminPasscode,
          baseServiceTimeMins: basePace,
          maxDailyCapacity: capacity,
          openingTime,
          closingTime,
          operatingDays,
          queueStructure,
          isFreeTrial: isTrial,
          initialPaymentAmount: 1499,
          stationCounts,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Save auth so they're auto-logged-in on the dashboard
        localStorage.setItem(
          'noq_business_auth',
          JSON.stringify({
            streamId: json.streamId,
            businessName: json.business?.name,
            dashboardUrl: json.dashboardUrl,
          })
        );
        sessionStorage.setItem(`noq_auth_${json.streamId}`, 'true');

        if (isTrial) {
          setLoading(false);
          window.location.href = json.dashboardUrl;
          return;
        }

        // Paid onboarding — open Razorpay
        await openRazorpayCheckout({
          businessId: json.business.id,
          streamId: json.streamId,
          businessName: bizName,
          customerPhone: phone,
          amount: 1499,
          paymentType: 'ONBOARDING_INITIAL',
          onSuccess: () => {
            setLoading(false);
            window.location.href = json.dashboardUrl;
          },
          onDismiss: () => {
            setLoading(false);
            setError('Payment window was closed. You can retry activating your plan, or click "Start 3-Day Free Trial" below.');
          },
          onError: (err) => {
            setLoading(false);
            setError(err?.message || 'Payment could not be completed. You can retry or start your 3-day free trial.');
          },
        });
      } else {
        setError(json.error || 'Registration failed. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Ambient glow (GPU-friendly radial gradients) */}
      <div className="fixed inset-0 pointer-events-none transform-gpu overflow-hidden">
        <div
          className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px]"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px]"
          style={{
            background: 'radial-gradient(circle, rgba(13, 148, 136, 0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">noQ</span>
          <span className="text-[10px] bg-zinc-800/80 border border-zinc-700/50 text-zinc-500 font-mono px-2 py-0.5 rounded-lg tracking-widest">OPERATOR</span>
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          Already registered?
          <span className="text-emerald-400 font-bold">Sign In →</span>
        </Link>
      </nav>

      {/* Main content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        {/* Header */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/60 text-zinc-300 text-xs px-4 py-1.5 rounded-full font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Queue management in 60 seconds
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            Register Your Business
          </h1>
          <p className="text-zinc-400 text-sm font-medium">
            Create your operator account and start managing virtual queues instantly.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
              step === 1
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-black">1</span>
            Account Setup
          </button>
          <div className="w-8 h-px bg-zinc-700" />
          <button
            type="button"
            onClick={() => {
              if (!username.trim() || !password || password.length < 6) return;
              setStep(2);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
              step === 2
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-black">2</span>
            Business Details
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          {/* STEP 1: Account credentials */}
          {step === 1 && (
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white mb-1">Create Your Login Credentials</h2>
                <p className="text-xs text-zinc-500">You'll use these to access your dashboard from any device.</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Username *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="signup-username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="e.g. metrocare-clinic"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
                  />
                </div>
                <p className="text-[11px] text-zinc-600 mt-1">Lowercase letters, numbers, and hyphens only. Min 3 characters.</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
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

                {/* Real-time Password Strength Meter */}
                {password.length > 0 && (() => {
                  const hasMin = password.length >= 8;
                  const hasNum = /\d/.test(password);
                  const hasUpper = /[A-Z]/.test(password);
                  const hasSym = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
                  let score = 0;
                  if (password.length >= 6) score += 1;
                  if (hasMin) score += 1;
                  if (hasNum) score += 1;
                  if (hasUpper) score += 1;
                  if (hasSym) score += 1;

                  const strength =
                    score <= 1
                      ? { label: 'Weak', barColor: 'bg-red-500', text: 'text-red-400', count: 1 }
                      : score <= 2
                      ? { label: 'Fair', barColor: 'bg-amber-500', text: 'text-amber-400', count: 2 }
                      : score <= 4
                      ? { label: 'Strong', barColor: 'bg-emerald-500', text: 'text-emerald-400', count: 3 }
                      : { label: 'Very Strong', barColor: 'bg-teal-400', text: 'text-teal-300', count: 4 };

                  return (
                    <div className="mt-2.5 space-y-2 p-3 bg-zinc-950/60 border border-zinc-800 rounded-2xl animate-in fade-in">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500 font-medium">Password Strength:</span>
                        <span className={`font-mono font-bold ${strength.text}`}>{strength.label}</span>
                      </div>

                      {/* 4 Segment Meter */}
                      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                        {[1, 2, 3, 4].map((stepNum) => (
                          <div
                            key={stepNum}
                            className={`h-full rounded-full transition-all duration-300 ${
                              stepNum <= strength.count ? strength.barColor : 'bg-zinc-800'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Requirement Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasMin ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                          {hasMin ? '✓' : '○'} 8+ Chars
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasNum ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                          {hasNum ? '✓' : '○'} Number (0-9)
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasUpper ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                          {hasUpper ? '✓' : '○'} Uppercase (A-Z)
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasSym ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                          {hasSym ? '✓' : '○'} Special Symbol
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    id="signup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3.5 bg-zinc-800/60 border rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 transition font-medium ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-600/60 focus:border-red-500/60 focus:ring-red-500/20'
                        : 'border-zinc-700/60 focus:border-emerald-500/60 focus:ring-emerald-500/20'
                    }`}
                  />
                  {confirmPassword && confirmPassword === password && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-[11px] text-red-400 mt-1 font-semibold">Passwords do not match.</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-950/60 border border-red-800/60 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-300 font-medium">{error}</p>
                </div>
              )}

              <button
                type="button"
                id="signup-next-step"
                onClick={() => {
                  setError(null);
                  if (!username.trim() || username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
                  if (/\s/.test(username.trim())) { setError('Username cannot contain spaces.'); return; }
                  if (!password || password.length < 6) { setError('Password must be at least 6 characters (8+ with numbers and symbols recommended).'); return; }
                  if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
                  setStep(2);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Continue to Business Details →
              </button>
            </div>
          )}

          {/* STEP 2: Business info */}
          {step === 2 && (
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white mb-1">Business Information</h2>
                  <p className="text-xs text-zinc-500">Configure your venue and queue settings.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-zinc-400 hover:text-white font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  ← Back
                </button>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Business / Venue Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Care Clinic / Spice Garden"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/60 text-white placeholder-zinc-600 transition"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Industry / Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/60 text-white transition cursor-pointer"
                >
                  <option value="clinic">🏥 Clinic / Healthcare (Patients & Doctor)</option>
                  <option value="restaurant">🍽️ Restaurant / Hotel (Guests & Tables)</option>
                  <option value="salon">✂️ Salon / Spa (Clients & Stylists)</option>
                  <option value="general">🛍️ General Retail / Bank (Customers & Counters)</option>
                </select>
              </div>

              {/* Station counts */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Physical Station Setup</p>
                {category === 'clinic' ? (
                  <div className="space-y-3">
                    <NumberSlider label="Doctor Consultation Rooms" value={countA} min={1} max={10} unit="Rooms" singularUnit="Room" presets={[1, 2, 3, 4, 6]} onChange={setCountA} accentColor="emerald" />
                    <NumberSlider label="Exam Beds / Observation Units" value={countB} min={0} max={10} unit="Beds" singularUnit="Bed" presets={[0, 1, 2, 4]} onChange={setCountB} accentColor="sky" />
                  </div>
                ) : category === 'salon' ? (
                  <div className="space-y-3">
                    <NumberSlider label="Stylist Chairs & Stations" value={countA} min={1} max={12} unit="Chairs" singularUnit="Chair" presets={[2, 3, 5, 8]} onChange={setCountA} accentColor="emerald" />
                    <NumberSlider label="Wash Basins / Treatment Beds" value={countB} min={0} max={6} unit="Basins" singularUnit="Basin" presets={[1, 2, 3]} onChange={setCountB} accentColor="sky" />
                  </div>
                ) : category === 'restaurant' ? (
                  <div className="space-y-3">
                    <NumberSlider label="Host Desks & Seating Sections" value={countA} min={1} max={15} unit="Desks" singularUnit="Desk" presets={[2, 4, 6, 10]} onChange={setCountA} accentColor="emerald" />
                    <NumberSlider label="Express Takeaway / Bar Counters" value={countB} min={0} max={6} unit="Counters" singularUnit="Counter" presets={[0, 1, 2]} onChange={setCountB} accentColor="amber" />
                  </div>
                ) : (
                  <NumberSlider label="Active Service Counters" value={countA} min={1} max={15} unit="Counters" singularUnit="Counter" presets={[2, 3, 5, 8]} onChange={setCountA} accentColor="emerald" />
                )}
              </div>

              {/* Operating days */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 p-4 rounded-2xl space-y-2.5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Operating / Working Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const isSelected = operatingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-black shadow-xs'
                            : 'bg-zinc-900/80 text-zinc-500 border border-zinc-700/60 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Working hours */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 p-4 rounded-2xl space-y-3 min-w-0">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Working Hours</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Opening Time</label>
                    <input
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="w-full min-w-0 bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 cursor-pointer [color-scheme:dark]"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">Closing Time</label>
                    <input
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="w-full min-w-0 bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 cursor-pointer [color-scheme:dark]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">
                  The daily queue will automatically archive and reset for the new operational day at 4:00 AM.
                </p>
              </div>

              {/* Queue structure */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Queue Structure *
                </label>
                <select
                  value={queueStructure}
                  onChange={(e: any) => setQueueStructure(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/60 text-white transition cursor-pointer"
                >
                  <option value="UNIFIED_PARALLEL">⚡ Parallel Unified Queue (Single line, parallel calling)</option>
                  <option value="DEDICATED_STREAMS">🩺 Dedicated Provider Queues (Separate queue per provider)</option>
                </select>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/60 text-white placeholder-zinc-600 transition"
                />
              </div>

              {/* Google Maps */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Google Maps / Review Link
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold">Optional</span>
                </div>
                <input
                  type="url"
                  placeholder="https://maps.app.goo.gl/..."
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/60 text-white placeholder-zinc-600 transition"
                />
              </div>

              {/* Admin PIN */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Admin Terminal PIN *
                </label>
                <input
                  type="password"
                  required
                  maxLength={10}
                  placeholder="Set your 6-digit PIN (Default: 123456)"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-emerald-500/60 text-white transition"
                />
              </div>

              {/* Service pace & capacity */}
              <div className="space-y-3">
                <NumberSlider
                  label="Estimated Service Pace"
                  description="Average consultation / service duration"
                  value={basePace}
                  min={2}
                  max={120}
                  step={1}
                  unit="Min"
                  presets={[5, 10, 15, 20, 30, 45]}
                  onChange={setBasePace}
                  accentColor="emerald"
                />
                <NumberSlider
                  label="Maximum Daily Guest Capacity"
                  description="Automatic queue cutoff limit"
                  value={capacity}
                  min={10}
                  max={500}
                  step={5}
                  unit="Guests"
                  singularUnit="Guest"
                  presets={[25, 50, 100, 200, 300]}
                  onChange={setCapacity}
                  accentColor="amber"
                />
              </div>

              {/* Pricing summary */}
              <div className="bg-zinc-800/40 border border-emerald-900/30 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">💳 Setup + 1st Month Plan</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">₹1,499</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-400 border-t border-zinc-700/40 pt-2">
                  <span>Recurring Renewal (Anchor Day: {new Date().getDate()})</span>
                  <span className="font-mono font-bold text-zinc-300">₹499 / month</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  ✨ Instant terminal access. Includes unlimited tokens, multi-station calling, SMS gateway & TV display.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-950/60 border border-red-800/60 rounded-2xl px-4 py-3 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-300 font-medium">{error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  id="signup-pay-submit"
                  type="button"
                  disabled={loading || !bizName.trim()}
                  onClick={(e) => handleSignup(e as any, false)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold py-4 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all duration-200 cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Activating Terminal...
                    </span>
                  ) : 'Pay ₹1,499 & Activate 1st Month Now ↗'}
                </button>

                <button
                  id="signup-trial-submit"
                  type="button"
                  disabled={loading || !bizName.trim()}
                  onClick={(e) => handleSignup(e as any, true)}
                  className="w-full bg-zinc-800/80 hover:bg-zinc-700/80 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700/60 text-zinc-200 font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
                >
                  ⚡ Start 3-Day Free Trial (No Card Required) →
                </button>

                <p className="text-[11px] text-zinc-500 text-center leading-relaxed pt-2">
                  By proceeding, you agree to our{' '}
                  <Link href="/terms" className="text-emerald-400 hover:underline">
                    Terms & Conditions
                  </Link>
                  ,{' '}
                  <Link href="/privacy" className="text-emerald-400 hover:underline">
                    Privacy Policy
                  </Link>
                  , and{' '}
                  <Link href="/mou" className="text-emerald-400 hover:underline">
                    Healthcare MoU
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="text-center text-[11px] text-zinc-600 mt-8 space-y-2">
          <div className="flex items-center justify-center gap-4 text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-300 transition">Terms & Conditions</Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-zinc-300 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/mou" className="hover:text-zinc-300 transition">Doctor MoU</Link>
          </div>
          <p>© 2026 noQ — Virtual Queue Management System</p>
        </div>
      </div>
    </div>
  );
}
