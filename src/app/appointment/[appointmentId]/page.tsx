'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, CheckCircle2, Clock, AlertCircle, RefreshCw, MapPin } from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

interface AppointmentData {
  id: string;
  appointment_ref: string;
  stream_id: string;
  customer_name: string;
  customer_phone: string;
  slot_date: string;
  slot_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW';
  created_at: string;
  business_name?: string;
  stream_name?: string;
  category?: string;
}

function formatTime12h(time24: string): string {
  const [h, m] = (time24 || '').split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function formatAppointmentDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AppointmentPassPage() {
  const routeParams = useParams();
  const appointmentId = routeParams?.appointmentId as string;

  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) return;

    async function load() {
      try {
        const res = await fetch(`/api/slots/appointments?appointmentId=${appointmentId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setAppointment(json.appointment);
        } else {
          setError(json.error || 'Appointment not found');
        }
      } catch {
        setError('Network error loading appointment');
      } finally {
        setLoading(false);
      }
    }

    load();
    // Poll every 30s to catch status changes
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [appointmentId]);

  const statusConfig = {
    PENDING: {
      label: 'Awaiting Confirmation',
      icon: <Clock className="w-5 h-5" />,
      bg: 'bg-amber-50 border-amber-300',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-700 border-amber-300',
      dot: 'bg-amber-500 animate-pulse',
      headerBg: 'from-amber-500 to-orange-500',
    },
    CONFIRMED: {
      label: 'Confirmed ✓',
      icon: <CheckCircle2 className="w-5 h-5" />,
      bg: 'bg-emerald-50 border-emerald-300',
      text: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      dot: 'bg-emerald-500',
      headerBg: 'from-emerald-600 to-teal-600',
    },
    CANCELLED: {
      label: 'Cancelled',
      icon: <AlertCircle className="w-5 h-5" />,
      bg: 'bg-red-50 border-red-300',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-700 border-red-300',
      dot: 'bg-red-500',
      headerBg: 'from-red-600 to-rose-600',
    },
    NO_SHOW: {
      label: 'Marked No-Show',
      icon: <AlertCircle className="w-5 h-5" />,
      bg: 'bg-zinc-50 border-zinc-300',
      text: 'text-zinc-600',
      badge: 'bg-zinc-100 text-zinc-600 border-zinc-300',
      dot: 'bg-zinc-400',
      headerBg: 'from-zinc-600 to-zinc-700',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm font-medium">Loading your appointment...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-zinc-200 shadow-lg p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900">Appointment Not Found</h2>
          <p className="text-sm text-zinc-500">{error || 'This appointment link may be invalid or expired.'}</p>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[appointment.status] || statusConfig.PENDING;
  const timeLabel = formatTime12h(appointment.slot_time);
  const dateLabel = formatAppointmentDate(appointment.slot_date);

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden" id="appointment-pass">

        {/* Colored Header */}
        <div className={`bg-gradient-to-br ${cfg.headerBg} p-6 text-white`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 opacity-80" />
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">Appointment Pass</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          </div>
          <h1 className="text-xl font-black tracking-tight leading-tight">
            {appointment.business_name || 'noQ Booking'}
          </h1>
          <p className="text-white/70 text-xs mt-0.5">{appointment.stream_name || 'Appointment'}</p>
        </div>

        {/* Main Details Card */}
        <div className="p-6 space-y-5">
          {/* Date & Time — Google Calendar style */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-red-500 uppercase">
                {new Date(appointment.slot_date + 'T00:00:00').toLocaleString('en', { month: 'short' })}
              </span>
              <span className="text-2xl font-black text-zinc-900 leading-none">
                {new Date(appointment.slot_date + 'T00:00:00').getDate()}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-400">{dateLabel}</p>
              <p className="text-2xl font-black text-zinc-900 mt-0.5">{timeLabel}</p>
              <p className="text-xs text-zinc-400">Your scheduled appointment</p>
            </div>
          </div>

          {/* Guest Details */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-medium">Name</span>
              <span className="font-bold text-zinc-900">{appointment.customer_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-medium">Phone</span>
              <span className="font-mono font-semibold text-zinc-700">{appointment.customer_phone}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-medium">Ref. No.</span>
              <span className="font-mono font-black text-emerald-700 text-xs tracking-wider">{appointment.appointment_ref}</span>
            </div>
          </div>

          {/* Status Banner */}
          <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${cfg.bg}`}>
            <span className={cfg.text}>{cfg.icon}</span>
            <div>
              <p className={`text-xs font-extrabold ${cfg.text}`}>{cfg.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {appointment.status === 'PENDING' && 'Your booking is received. The business will confirm shortly.'}
                {appointment.status === 'CONFIRMED' && 'Please arrive 5 minutes before your scheduled time.'}
                {appointment.status === 'CANCELLED' && 'This appointment has been cancelled.'}
                {appointment.status === 'NO_SHOW' && 'This appointment was marked as no-show.'}
              </p>
            </div>
          </div>

          {/* Instructions */}
          {appointment.status !== 'CANCELLED' && appointment.status !== 'NO_SHOW' && (
            <div className="flex items-start gap-2 text-xs text-zinc-500 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>Please carry this page (screenshot or link) when you arrive. Mention your Ref. No. at reception.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-[10px] text-zinc-400">
            Powered by <strong className="text-zinc-600">noQ</strong> Virtual Queue Engine
          </p>
        </div>
      </div>
    </div>
  );
}
