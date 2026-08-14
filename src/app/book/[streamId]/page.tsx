'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Clock, Users, ArrowRight, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getDomainTerminology, formatWaitTime } from '@/lib/domain';

interface StreamInfo {
  business_name: string;
  stream_name: string;
  category?: string;
  broadcast_message?: string;
  current_serving_token: number;
  current_effective_time_mins: number;
  pace_per_patient_mins?: number;
}

export default function RemoteBookingPage({ params }: { params: { streamId: string } }) {
  const router = useRouter();
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingMode, setBookingMode] = useState<'LIVE' | 'SLOT'>('LIVE');
  const [selectedSlot, setSelectedSlot] = useState<string>('10:00 AM');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const isSubmittingRef = useRef(false);

  // Fetch current stream details & queue length
  useEffect(() => {
    async function loadStreamInfo() {
      try {
        const res = await fetch(`/api/queue/stream/${params.streamId}`);
        if (!res.ok) return;
        const json = await res.json();
        setStream(json.stream || json.data?.stream);
        
        const tokensList = json.tokens || json.data?.tokens || [];
        const waiting = tokensList.filter((t: any) => t.status === 'WAITING');
        setWaitingCount(waiting.length);
      } catch (err) {
        console.error('Failed to load stream info:', err);
      }
    }

    loadStreamInfo();
    const interval = setInterval(loadStreamInfo, 3000);
    return () => clearInterval(interval);
  }, [params.streamId]);

  const handleRemoteBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim() || isSubmittingRef.current || loading) return;

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/token/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId: params.streamId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          accessChannel: 'REMOTE',
        }),
      });

      const json = await res.json();

      if (res.ok && json.data?.id) {
        setIsSuccess(true);
        router.push(`/t/${json.data.id}`);
      } else {
        alert(json.error || 'Failed to book spot. Please try again.');
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const terms = getDomainTerminology(stream?.category);
  const pace = stream?.pace_per_patient_mins || stream?.current_effective_time_mins || 5;
  const estWaitMins = waitingCount * pace;

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

        {/* Live Broadcast Banner if Active */}
        {stream?.broadcast_message && (
          <div className="bg-amber-500 text-black px-5 py-3 text-xs font-bold shadow-xs">
            📢 Announcement: <span className="font-semibold">{stream.broadcast_message}</span>
          </div>
        )}

        {/* Live Queue Status Banner */}
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
              <Clock className="w-3 h-3" /> Est. Wait Time
            </div>
            <span className="text-2xl font-black text-emerald-600">~{formatWaitTime(estWaitMins)}</span>
          </div>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900">Spot Reserved!</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Redirecting to your digital tracking pass...
            </p>
            <div className="pt-4">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleRemoteBook} className="p-6 space-y-4">
            {/* Booking Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
              <button
                type="button"
                onClick={() => setBookingMode('LIVE')}
                className={`py-2.5 rounded-xl text-xs font-bold transition ${
                  bookingMode === 'LIVE'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                ⚡ Join Live Queue
              </button>
              <button
                type="button"
                onClick={() => setBookingMode('SLOT')}
                className={`py-2.5 rounded-xl text-xs font-bold transition ${
                  bookingMode === 'SLOT'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                📅 Advance Slot
              </button>
            </div>

            {bookingMode === 'SLOT' && (
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Select Preferred Time Slot *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        selectedSlot === slot
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-sm tracking-wide shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>RESERVING YOUR SPOT...</span>
                </>
              ) : (
                <>
                  <span>RESERVE VIRTUAL SPOT</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}