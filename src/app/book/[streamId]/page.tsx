'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Globe, Clock, Users, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck, Calendar, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { getDomainTerminology, formatWaitTime } from '@/lib/domain';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StreamInfo {
  business_name: string;
  stream_name: string;
  category?: string;
  broadcast_message?: string;
  current_serving_token: number;
  current_effective_time_mins: number;
  pace_per_patient_mins?: number;
  slot_booking_enabled: boolean;
}

interface SlotInfo {
  time: string;
  timeLabel: string;
  available: boolean;
  bookedCount: number;
  maxPerSlot: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDateStrip(): Array<{ date: Date; dateStr: string; label: string; dayName: string; dayNum: number; monthName: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().substring(0, 10);
    return {
      date: d,
      dateStr,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()],
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      monthName: MONTH_NAMES[d.getMonth()],
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RemoteBookingPage() {
  const routeParams = useParams();
  const streamId = routeParams?.streamId as string;

  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [bookingMode, setBookingMode] = useState<'LIVE' | 'SLOT'>('LIVE');

  // Live queue form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  // Slot booking state
  const dateStrip = getDateStrip();
  const [selectedDate, setSelectedDate] = useState(dateStrip[0].dateStr);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotName, setSlotName] = useState('');
  const [slotPhone, setSlotPhone] = useState('');
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotSuccess, setSlotSuccess] = useState<{ appointmentId: string; appointmentRef: string } | null>(null);

  // Load stream info
  useEffect(() => {
    if (!streamId) return;
    async function loadStream() {
      try {
        const res = await fetch(`/api/queue/stream/${streamId}`);
        if (!res.ok) return;
        const json = await res.json();
        const streamData = json.stream || json.data?.stream;
        setStream(streamData);
        const tokensList = json.tokens || json.data?.tokens || [];
        setWaitingCount(tokensList.filter((t: any) => t.status === 'WAITING').length);
      } catch (err) {
        console.error('Failed to load stream info:', err);
      }
    }
    loadStream();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadStream();
    }, 10000);
    return () => clearInterval(interval);
  }, [streamId]);

  // Load slots when date changes (only in SLOT mode + addon enabled)
  const loadSlots = useCallback(async (date: string) => {
    if (!streamId || !stream?.slot_booking_enabled) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/slots/available?streamId=${streamId}&date=${date}`);
      const json = await res.json();
      setSlots(json.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [streamId, stream?.slot_booking_enabled]);

  useEffect(() => {
    if (bookingMode === 'SLOT' && stream?.slot_booking_enabled) {
      loadSlots(selectedDate);
    }
  }, [bookingMode, selectedDate, stream?.slot_booking_enabled, loadSlots]);

  // ── Live Queue Submit ──────────────────────────────────────────────────────
  const handleLiveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !streamId || isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/token/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, customerName: name.trim(), customerPhone: phone.trim(), accessChannel: 'REMOTE' }),
      });
      const json = await res.json();
      if (res.ok && json.data?.id) {
        setIsSuccess(true);
        window.location.href = `/t/${json.data.id}`;
      } else {
        alert(json.error || 'Failed to book spot. Please try again.');
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch {
      alert('Network error. Please try again.');
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // ── Slot Submit ────────────────────────────────────────────────────────────
  const handleSlotBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotName.trim() || !slotPhone.trim() || !selectedSlot || slotLoading) return;
    setSlotLoading(true);
    try {
      const res = await fetch('/api/slots/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          customerName: slotName.trim(),
          customerPhone: slotPhone.trim(),
          slotDate: selectedDate,
          slotTime: selectedSlot,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSlotSuccess({ appointmentId: json.appointmentId, appointmentRef: json.appointmentRef });
      } else {
        alert(json.error || 'Failed to book slot. Please try another time.');
        // Refresh slots in case it was just taken
        loadSlots(selectedDate);
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSlotLoading(false);
    }
  };

  const terms = getDomainTerminology(stream?.category);
  const pace = stream?.pace_per_patient_mins || stream?.current_effective_time_mins || 5;
  const estWaitMins = waitingCount * pace;
  const slotEnabled = Boolean(stream?.slot_booking_enabled);

  // ── Appointment Redirect ───────────────────────────────────────────────────
  if (slotSuccess) {
    window.location.href = `/appointment/${slotSuccess.appointmentId}`;
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-4 p-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
          <p className="text-zinc-600 font-medium text-sm">Redirecting to your appointment pass...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden">

        {/* Header */}
        <div className="bg-zinc-950 p-6 text-white border-b border-zinc-800">
          <div className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
            <Globe className="w-3.5 h-3.5" /> Remote Booking
          </div>
          <h1 className="text-2xl font-black tracking-tight">{stream?.business_name || 'Book Your Spot'}</h1>
          <p className="text-zinc-400 text-xs mt-1">{stream?.stream_name || terms.queueTitle}</p>
        </div>

        {/* Broadcast Banner */}
        {stream?.broadcast_message && (
          <div className="bg-amber-500 text-black px-5 py-3 text-xs font-bold shadow-sm">
            📢 {stream.broadcast_message}
          </div>
        )}

        {/* Live Status Bar */}
        <div className="bg-zinc-50 border-b border-zinc-200 p-4 grid grid-cols-2 gap-4 text-center">
          <div className="border-r border-zinc-200 pr-2">
            <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Users className="w-3 h-3" /> Ahead In Line
            </div>
            <span className="text-2xl font-black text-zinc-900">{waitingCount}</span>
            <span className="text-xs text-zinc-500 font-medium ml-1">{terms.guestTermPlural.toLowerCase()}</span>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Clock className="w-3 h-3" /> Est. Wait
            </div>
            <span className="text-2xl font-black text-emerald-600">~{formatWaitTime(estWaitMins)}</span>
          </div>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900">Spot Reserved!</h2>
            <p className="text-xs text-zinc-500">Redirecting to your digital tracking pass...</p>
            <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Booking Mode Toggle — only show SLOT tab if addon enabled */}
            <div
              className={`grid gap-2 p-1 bg-zinc-100 rounded-2xl border border-zinc-200 ${slotEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}
              id="booking-mode-selector"
            >
              <button
                type="button"
                onClick={() => setBookingMode('LIVE')}
                className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  bookingMode === 'LIVE'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
                id="tab-live-queue"
              >
                ⚡ Join Live Queue
              </button>
              {slotEnabled && (
                <button
                  type="button"
                  onClick={() => setBookingMode('SLOT')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    bookingMode === 'SLOT'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                  id="tab-book-slot"
                >
                  📅 Book a Slot
                </button>
              )}
            </div>

            {/* ── LIVE QUEUE FORM ────────────────────────────────────────── */}
            {bookingMode === 'LIVE' && (
              <form onSubmit={handleLiveBook} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-900 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    disabled={loading}
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-900 disabled:opacity-50"
                  />
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>You can track your live queue position anytime on your smartphone.</span>
                </div>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || !phone.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-sm tracking-wide shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  id="btn-join-queue"
                >
                  {loading ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /><span>RESERVING YOUR SPOT...</span></>
                  ) : (
                    <><span>RESERVE VIRTUAL SPOT</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* ── SLOT CALENDAR PICKER ───────────────────────────────────── */}
            {bookingMode === 'SLOT' && slotEnabled && (
              <div className="space-y-5" id="slot-booking-section">
                {/* Date Strip */}
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Select Date
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" id="date-strip">
                    {dateStrip.map((d) => (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(d.dateStr)}
                        className={`flex-shrink-0 w-14 flex flex-col items-center py-2.5 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                          selectedDate === d.dateStr
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-md'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                        }`}
                        data-date={d.dateStr}
                        id={`date-btn-${d.dateStr}`}
                      >
                        <span className={`text-[10px] uppercase tracking-wide ${selectedDate === d.dateStr ? 'text-zinc-300' : 'text-zinc-400'}`}>
                          {d.label === 'Today' ? 'Today' : d.label === 'Tomorrow' ? 'Tmrw' : d.dayName}
                        </span>
                        <span className="text-lg font-black leading-tight">{d.dayNum}</span>
                        <span className={`text-[9px] ${selectedDate === d.dateStr ? 'text-zinc-400' : 'text-zinc-400'}`}>{d.monthName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slot Grid */}
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">
                    Available Time Slots
                  </p>

                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-6 text-zinc-400 gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Loading slots...</span>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-6 text-zinc-400 bg-zinc-50 rounded-2xl border border-zinc-200" id="no-slots-message">
                      <p className="text-sm font-bold text-zinc-500">No slots available on this day</p>
                      <p className="text-xs text-zinc-400 mt-1">The business is closed or hasn't configured hours for this date.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2" id="slot-grid">
                      {slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            !slot.available
                              ? 'bg-zinc-100 border-zinc-200 text-zinc-400 line-through cursor-not-allowed opacity-60'
                              : selectedSlot === slot.time
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-emerald-50 hover:border-emerald-400'
                          }`}
                          data-time={slot.time}
                          data-available={slot.available}
                          id={`slot-${slot.time.replace(':', '')}`}
                        >
                          {slot.timeLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Booking Form (shows after selecting a slot) */}
                {selectedSlot && (
                  <form onSubmit={handleSlotBook} className="space-y-3 pt-2 border-t border-zinc-100" id="slot-confirm-form">
                    <p className="text-xs font-extrabold text-zinc-700">
                      Confirming slot: <span className="text-emerald-600">{slots.find(s => s.time === selectedSlot)?.timeLabel}</span>{' '}
                      on <span className="text-emerald-600">{dateStrip.find(d => d.dateStr === selectedDate)?.label || selectedDate}</span>
                    </p>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={slotName}
                        onChange={(e) => setSlotName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-900"
                        id="slot-name-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={slotPhone}
                        onChange={(e) => setSlotPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-900"
                        id="slot-phone-input"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={slotLoading || !slotName.trim() || !slotPhone.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl text-sm tracking-wide shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                      id="btn-confirm-slot"
                    >
                      {slotLoading ? (
                        <><RefreshCw className="w-5 h-5 animate-spin" /><span>BOOKING SLOT...</span></>
                      ) : (
                        <><Calendar className="w-4 h-4" /><span>CONFIRM APPOINTMENT</span></>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}