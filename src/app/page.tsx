'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NumberSlider } from '@/components/NumberSlider';

export default function LandingPage() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Form State
  const [bizName, setBizName] = useState('');
  const [category, setCategory] = useState('clinic');
  const [phone, setPhone] = useState('');
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

  const handleRegister = async (e: React.FormEvent) => {
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
          adminPasscode,
          baseServiceTimeMins: basePace,
          maxDailyCapacity: capacity,
          openingTime,
          closingTime,
          operatingDays,
          queueStructure,
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
      if (res.ok && json.dashboardUrl) {
        window.location.href = json.dashboardUrl;
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
      desc: 'Patients scan QR codes or book via WhatsApp to track live consultation status. Doctors manage flow effortlessly.',
      guestTerm: 'Patient',
      paceTerm: 'Consultation Pace',
    },
    restaurant: {
      badge: 'Restaurants & Hotels',
      title: 'Streamline Table Seating & Dining Queues',
      desc: 'Diners receive instant SMS/WhatsApp alerts when their table is ready, freeing up entrance foyers and boosting table turnover.',
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
          <span className="text-3xl font-black tracking-tight text-white">noQ</span>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            ENTERPRISE QUEUE PLATFORM
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard?streamId=c65dacd2-03e1-4737-b7b2-8d9502ec5ca1"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition hidden sm:block"
          >
            Live Demo Terminal
          </Link>
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-full transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Register Business Free
          </button>
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
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm px-8 py-4 rounded-2xl transition shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            ONBOARD YOUR BUSINESS NOW ↗
          </button>
          <Link
            href="/dashboard?streamId=c65dacd2-03e1-4737-b7b2-8d9502ec5ca1"
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-sm font-bold px-8 py-4 rounded-2xl transition cursor-pointer"
          >
            EXPLORE OPERATOR DASHBOARD
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
              💬
            </div>
            <h3 className="text-base font-bold text-white">WhatsApp & SMS Integration</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Customers can book tokens directly via WhatsApp messages and receive SMS alerts when their turn is approaching.
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 rounded-3xl max-w-md w-full p-7 border border-zinc-800 shadow-2xl text-white">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Register Your Business</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Start managing virtual queues in 60 seconds.</p>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-zinc-500 hover:text-white font-bold text-sm"
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
                    presets={[2, 3, 5, 8]}
                    onChange={setCountA}
                    accentColor="emerald"
                  />
                )}
              </div>

              {/* Fixed Working Hours Setup */}
              <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    Fixed Working Hours & Schedule
                  </p>
                  <span className="text-[10px] text-zinc-400 font-mono">24-Hour Format</span>
                </div>

                <div>
                  <span className="block text-[11px] font-medium text-zinc-400 mb-1.5">Operating / Working Days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const isSelected = operatingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
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

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
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

              <button
                type="submit"
                disabled={loading || !bizName.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-4 rounded-2xl text-sm tracking-wide shadow-lg shadow-emerald-500/20 transition cursor-pointer mt-2"
              >
                {loading ? 'CREATING YOUR QUEUE TERMINAL...' : 'CREATE QUEUE TERMINAL NOW ↗'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
