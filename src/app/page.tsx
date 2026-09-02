'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NumberSlider } from '@/components/NumberSlider';
import { openRazorpayCheckout } from '@/lib/razorpayClient';

export default function LandingPage() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Form State
  const [bizName, setBizName] = useState('');
  const [category, setCategory] = useState('clinic');
  const [phone, setPhone] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('123456');
  const [basePace, setBasePace] = useState(15);
  const [capacity, setCapacity] = useState(100);
  const [loading, setLoading] = useState(false);

  // Working Hours & Queue Structure State
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [operatingDays, setOperatingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [queueStructure, setQueueStructure] = useState<'UNIFIED_PARALLEL' | 'DEDICATED_STREAMS'>('UNIFIED_PARALLEL');

  // Active Domain Preview Tab
  const [activeTab, setActiveTab] = useState<'clinic' | 'restaurant' | 'salon' | 'general'>('clinic');

  const [countA, setCountA] = useState<number>(2);
  const [countB, setCountB] = useState<number>(1);

  const toggleDay = (day: string) => {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleRegister = async (e: React.FormEvent, isTrial: boolean = false) => {
    e.preventDefault();
    if (!bizName.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/business/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          stationCounts: {
            consultationRooms: countA,
            stylingChairs: countA,
            hostTables: countA,
            counters: countA,
            examBeds: countB,
            washBasins: countB,
            expressCounters: countB,
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (isTrial) {
          // Free Trial - skip paywall immediately
          setLoading(false);
          window.location.href = json.dashboardUrl;
          return;
        }

        // Paid Onboarding - Open Razorpay Checkout
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
          onError: () => {
            setLoading(false);
            if (confirm('Payment was skipped or cancelled. View your newly created dashboard in trial mode?')) {
              window.location.href = json.dashboardUrl;
            }
          },
        });
      } else {
        alert(json.error || 'Registration failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('Network error. Please try again.');
      setLoading(false);
    }
  };

  const domainDemos = {
    clinic: {
      badge: 'Clinics & Hospitals',
      title: 'Eliminate Crowded OPD Waiting Rooms',
      desc: 'Patients scan on-site QR codes or book online to track live consultation status with automated SMS alerts. Doctors manage flow effortlessly.',
      guestTerm: 'Patient',
      paceTerm: 'Consultation Pace',
    },
    restaurant: {
      badge: 'Restaurants & Hotels',
      title: 'Streamline Table Seating & Dining Queues',
      desc: 'Diners receive instant SMS text alerts when their table is ready, freeing up entrance foyers and boosting table turnover.',
      guestTerm: 'Diner',
      paceTerm: 'Table Turn Time',
    },
    salon: {
      badge: 'Salons & Spas',
      title: 'Precision Client Appointment Flow',
      desc: 'Keep clients informed of stylist availability, estimated service duration, and real-time station calls.',
      guestTerm: 'Client',
      paceTerm: 'Service Duration',
    },
    general: {
      badge: 'Banks & Retail Counters',
      title: 'Zero Physical Queue Crowding',
      desc: 'Smart ticketing for service counters, branches, and customer centers with live TV display boards.',
      guestTerm: 'Customer',
      paceTerm: 'Service Pace',
    },
  };

  const activeDemo = domainDemos[activeTab];

  return (
    <div className="min-h-screen bg-[#07080a] text-white font-sans selection:bg-emerald-500 selection:text-black">
      {/* NAVIGATION BAR */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-3xl font-black tracking-tight text-white hover:text-emerald-400 transition">
            noQ
          </Link>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            ENTERPRISE QUEUE PLATFORM
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/dashboard?streamId=c65dacd2-03e1-4737-b7b2-8d9502ec5ca1"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition hidden md:block"
          >
            Live Demo
          </Link>
          <Link
            href="/login"
            className="text-xs font-bold text-zinc-300 hover:text-white px-3.5 py-2 rounded-full border border-zinc-800 hover:border-zinc-700 transition"
          >
            Operator Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 sm:px-5 py-2 sm:py-2.5 rounded-full transition shadow-lg shadow-emerald-500/20"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-4 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Zero Hardware • Zero App Install Required
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-tight text-white">
          Turn Physical Waiting Lines <br /> Into <span className="text-emerald-400">Digital Flow</span>
        </h1>

        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
          The non-intrusive queue engine for clinics, restaurants, salons, and retail counters.
          Give customers real-time mobile tracking passes while your team calls next in one tap.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm px-8 py-4 rounded-2xl transition shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            ONBOARD WITH 3-DAY FREE TRIAL ↗
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-sm font-bold px-8 py-4 rounded-2xl transition cursor-pointer"
          >
            OPERATOR LOGIN ➔
          </Link>
          <Link
            href="/dashboard?streamId=c65dacd2-03e1-4737-b7b2-8d9502ec5ca1"
            className="w-full sm:w-auto bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-900 text-xs font-semibold px-6 py-4 rounded-2xl transition cursor-pointer hidden md:block"
          >
            VIEW LIVE DEMO
          </Link>
        </div>
      </section>

      {/* INTERACTIVE DOMAIN SWITCHER SECTION */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white">Tailored for Every Business Domain</h2>
          <p className="text-zinc-400 text-xs mt-1">noQ automatically adapts vocabulary and terminology to match your industry.</p>
        </div>

        {/* Category Tabs */}
        <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-2">
          {(['clinic', 'restaurant', 'salon', 'general'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition capitalize cursor-pointer ${
                activeTab === tab
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {tab === 'clinic' ? '🏥 Clinics & OPD' : tab === 'restaurant' ? '🍽️ Hotels & Dining' : tab === 'salon' ? '✂️ Salons & Spas' : '🛍️ Retail & Banks'}
            </button>
          ))}
        </div>

        {/* Active Demo Preview Card */}
        <div className="bg-[#0d0e12] border border-zinc-800 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-2xl">
          <div className="md:col-span-6 space-y-4">
            <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {activeDemo.badge}
            </span>
            <h3 className="text-2xl font-bold text-white">{activeDemo.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{activeDemo.desc}</p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Customer Term</span>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">{activeDemo.guestTerm}</p>
              </div>
              <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Pace Metric</span>
                <p className="text-sm font-bold text-white mt-0.5">{activeDemo.paceTerm}</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
              LIVE DIGITAL PASS PREVIEW
            </div>
            <div className="text-5xl font-black text-white">#28</div>
            <div className="text-xs text-zinc-400 font-medium">1 {activeDemo.guestTerm} Ahead • ~5 Mins Est. Wait</div>
            <div className="p-3 bg-zinc-900 rounded-xl text-left border border-zinc-800">
              <p className="text-[10px] font-bold text-amber-400 uppercase">📢 Operator Live Broadcast</p>
              <p className="text-xs text-zinc-300 mt-0.5">Running on schedule. Next turn in 3 minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES GRID */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-zinc-900">
        <h2 className="text-2xl font-bold tracking-tight text-center text-white mb-12">
          Everything Your Venue Needs For Seamless Queueing
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              📱
            </div>
            <h3 className="text-base font-bold text-white">No-App Digital Pass</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Customers scan on-site QR codes or open web links. Live position updates sync without downloading any app.
            </p>
          </div>

          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              📲
            </div>
            <h3 className="text-base font-bold text-white">Automated SMS Text Alerts</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Customers receive instant cellular SMS text alerts on their mobile phones when their turn is approaching without needing any app.
            </p>
          </div>

          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              📢
            </div>
            <h3 className="text-base font-bold text-white">Live Delay & Broadcasts</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Publish instant announcements across operator dashboards, customer passes, and TV screens if delays occur.
            </p>
          </div>

          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              📺
            </div>
            <h3 className="text-base font-bold text-white">TV Display Queue Screen</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Full-screen TV display board for waiting lounges showing current serving token and upcoming waitlist in real-time.
            </p>
          </div>

          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              ⭐
            </div>
            <h3 className="text-base font-bold text-white">Post-Service Feedback Ratings</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Completed customers leave 5-star ratings and reviews directly on their pass, flowing into your admin dashboard.
            </p>
          </div>

          <div className="bg-[#0d0e12] border border-zinc-800/80 p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 bg-emerald-950 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
              📊
            </div>
            <h3 className="text-base font-bold text-white">Weekly Analytics & Reports</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Track throughput metrics, channel traffic breakdown, peak operating hours, and print weekly admin reports.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900 text-center text-xs text-zinc-500">
        © 2026 <a href="https://noq-serve.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white underline underline-offset-2">noQ (noq-serve.vercel.app)</a> — Enterprise Virtual Queue Engine. All rights reserved.
      </footer>

      {/* REGISTER BUSINESS MODAL */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-zinc-950 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-zinc-800 shadow-2xl text-white my-auto max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex justify-between items-center mb-5 sticky top-0 bg-zinc-950/95 backdrop-blur-xs pb-3 pt-1 border-b border-zinc-900 z-10">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Register Your Business</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Start managing virtual queues in 60 seconds.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Industry / Business Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white"
                >
                  <option value="clinic">Clinic / Healthcare (Patients & Doctor)</option>
                  <option value="restaurant">Restaurant / Hotel (Guests & Tables)</option>
                  <option value="salon">Salon / Spa (Clients & Stylists)</option>
                  <option value="general">General Retail / Bank (Customers & Counters)</option>
                </select>
              </div>

              {/* Domain Physical Layout Sliders */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1">
                  Physical Layout & Station Setup
                </p>

                {category === 'clinic' ? (
                  <div className="space-y-3">
                    <NumberSlider
                      label="Doctor Consultation Rooms"
                      description="Active consulting rooms / inspection cabins"
                      value={countA}
                      min={1}
                      max={10}
                      unit="Rooms"
                      singularUnit="Room"
                      presets={[1, 2, 3, 4, 6]}
                      onChange={setCountA}
                      accentColor="emerald"
                    />
                    <NumberSlider
                      label="Exam Beds / Observation Units"
                      description="Preliminary vitals & recovery stations"
                      value={countB}
                      min={0}
                      max={10}
                      unit="Beds"
                      singularUnit="Bed"
                      presets={[0, 1, 2, 4]}
                      onChange={setCountB}
                      accentColor="sky"
                    />
                  </div>
                ) : category === 'salon' ? (
                  <div className="space-y-3">
                    <NumberSlider
                      label="Stylist Chairs & Stations"
                      value={countA}
                      min={1}
                      max={12}
                      unit="Chairs"
                      singularUnit="Chair"
                      presets={[2, 3, 5, 8]}
                      onChange={setCountA}
                      accentColor="emerald"
                    />
                    <NumberSlider
                      label="Wash Basins / Treatment Beds"
                      value={countB}
                      min={0}
                      max={6}
                      unit="Basins"
                      singularUnit="Basin"
                      presets={[1, 2, 3]}
                      onChange={setCountB}
                      accentColor="sky"
                    />
                  </div>
                ) : category === 'restaurant' ? (
                  <div className="space-y-3">
                    <NumberSlider
                      label="Host Desks & Seating Sections"
                      value={countA}
                      min={1}
                      max={15}
                      unit="Desks"
                      singularUnit="Desk"
                      presets={[2, 4, 6, 10]}
                      onChange={setCountA}
                      accentColor="emerald"
                    />
                    <NumberSlider
                      label="Express Takeaway / Bar Counters"
                      value={countB}
                      min={0}
                      max={6}
                      unit="Counters"
                      singularUnit="Counter"
                      presets={[0, 1, 2]}
                      onChange={setCountB}
                      accentColor="amber"
                    />
                  </div>
                ) : (
                  <NumberSlider
                    label="Active Service Counters"
                    value={countA}
                    min={1}
                    max={15}
                    unit="Counters"
                    singularUnit="Counter"
                    presets={[2, 3, 5, 8]}
                    onChange={setCountA}
                    accentColor="emerald"
                  />
                )}
              </div>

              {/* Fixed Working Days Setup */}
              <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-2.5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Operating / Working Days
                </p>

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
                            : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Queue Structure Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Queue Structure & Flow *
                </label>
                <select
                  value={queueStructure}
                  onChange={(e: any) => setQueueStructure(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white"
                >
                  <option value="UNIFIED_PARALLEL">
                    ⚡ Parallel Unified Queue (Single line, available rooms/tables call next in parallel)
                  </option>
                  <option value="DEDICATED_STREAMS">
                    🩺 Dedicated Provider Queues (Separate queue per doctor/specialist)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 987 654 3210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Google Maps / Review Link
                  </label>
                  <span className="text-[10px] text-emerald-400 font-semibold">Optional</span>
                </div>
                <input
                  type="url"
                  placeholder="e.g. https://maps.app.goo.gl/... or https://g.page/r/..."
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-white placeholder-zinc-600"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  🌟 After service, customers will be redirected to leave a 5-star review on your Google Maps page.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Admin Terminal Security PIN *
                </label>
                <input
                  type="password"
                  required
                  maxLength={10}
                  placeholder="Set your 6-digit PIN (Default: 123456)"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              {/* Service Pace and Capacity Tactile Sliders */}
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
                  presets={[25, 50, 100, 200, 300]}
                  onChange={setCapacity}
                  accentColor="amber"
                />
              </div>

              {/* Subscription & Pricing Summary Box */}
              <div className="bg-zinc-900/90 border border-emerald-900/40 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    💳 Setup + 1st Month Plan
                  </span>
                  <span className="font-mono font-black text-emerald-400 text-sm">₹1,499</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-400 border-t border-zinc-800 pt-2">
                  <span>Recurring Renewal (Anchor Day: {new Date().getDate()})</span>
                  <span className="font-mono font-bold text-zinc-300">₹499 / month</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  ✨ Instant terminal access upon creation. Includes unlimited tokens, voice TTS announcements, multi-station parallel calling, and SMS gateway.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={loading || !bizName.trim()}
                  onClick={(e) => handleRegister(e, false)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  {loading ? 'ACTIVATING TERMINAL...' : 'PAY ₹1,499 & ACTIVATE 1ST MONTH NOW ↗'}
                </button>

                <button
                  type="button"
                  disabled={loading || !bizName.trim()}
                  onClick={(e) => handleRegister(e, true)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 text-zinc-200 font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>⚡ Start 3-Day Free Trial (No Card Required) ➔</span>
                </button>

                <p className="text-[10px] text-zinc-500 text-center leading-relaxed pt-1">
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
            </form>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE FOOTER */}
      <footer className="border-t border-zinc-900 bg-black/60 text-zinc-400 text-xs py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white">noQ</span>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                VIRTUAL QUEUES
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Enterprise-grade virtual queue and crowd orchestration engine. Zero hardware required. Masked PII security and sub-millisecond real-time sync.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Operator Access</h4>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/login" className="hover:text-emerald-400 transition">
                  Operator Sign In (/login)
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-emerald-400 transition">
                  Register Business (/signup)
                </Link>
              </li>
              <li>
                <Link href="/dashboard?streamId=c65dacd2-03e1-4737-b7b2-8d9502ec5ca1" className="hover:text-emerald-400 transition">
                  Live Terminal Demo
                </Link>
              </li>
              <li>
                <Link href="/superadmin" className="hover:text-emerald-400 transition">
                  Superadmin Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Customer Portals</h4>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/scan/c65dacd2-03e1-4737-b7b2-8d9502ec5ca1" className="hover:text-emerald-400 transition">
                  QR Venue Check-In
                </Link>
              </li>
              <li>
                <Link href="/book/c65dacd2-03e1-4737-b7b2-8d9502ec5ca1" className="hover:text-emerald-400 transition">
                  Remote Web Booking
                </Link>
              </li>
              <li>
                <Link href="/display/c65dacd2-03e1-4737-b7b2-8d9502ec5ca1" className="hover:text-emerald-400 transition">
                  Lounge TV Display Board
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Legal & Compliance</h4>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/terms" className="hover:text-emerald-400 transition">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-emerald-400 transition">
                  Privacy Policy & PII Protection
                </Link>
              </li>
              <li>
                <Link href="/mou" className="hover:text-emerald-400 transition">
                  Doctor & Clinic MoU Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-zinc-900 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-600 text-[11px]">
          <p>© 2026 noQ Virtual Queue Systems. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Zero-Hardware • Zero App Install • HIPAA & PII Compliant
          </p>
        </div>
      </footer>
    </div>
  );
}
