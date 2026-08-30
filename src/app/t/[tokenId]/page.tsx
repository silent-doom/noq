'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Ably from 'ably';
import { getDomainTerminology, formatWaitTime, generateAvailableTimeSlots, isValidPhoneNumber, formatPhoneNumberE164 } from '@/lib/domain';

interface TokenData {
  id: string;
  token_number: number;
  customer_name: string;
  customer_phone?: string;
  sms_opt_in?: boolean;
  status: string;
  assigned_station?: string;
  stream_id: string;
  business_name: string;
  category?: string;
  broadcast_message?: string;
  current_serving_token: number;
  spots_ahead: number;
  est_wait_mins: number;
  pace_per_patient_mins: number;
  delay_status: 'ON_TIME' | 'DELAYED';
  delay_mins: number;
  waitlist_position?: number;
  reschedule_requested_date?: string;
  reschedule_requested_slot?: string;
  reschedule_status?: string;
  opening_time?: string;
  closing_time?: string;
  google_maps_url?: string | null;
}

export default function TokenPassPage() {
  const params = useParams();
  const tokenId = params?.tokenId as string;

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReinsertedBanner, setShowReinsertedBanner] = useState(false);

  // Feedback State
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  const [returnedMapsUrl, setReturnedMapsUrl] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);

  // Reschedule State
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('10:00 AM');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Share & PWA State
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined') {
      const text = encodeURIComponent(`Track my live queue pass at ${tokenData?.business_name}: ${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  // SMS Opt-In State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsPhoneInput, setSmsPhoneInput] = useState('');
  const [smsPhoneError, setSmsPhoneError] = useState<string | null>(null);
  const [smsOptInSubmitting, setSmsOptInSubmitting] = useState(false);

  const handleSmsOptInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsPhoneError(null);

    const formatted = formatPhoneNumberE164(smsPhoneInput);
    if (!isValidPhoneNumber(formatted)) {
      setSmsPhoneError('Please enter a valid 10 to 15-digit mobile phone number.');
      return;
    }

    setSmsOptInSubmitting(true);
    try {
      const res = await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: formatted,
          smsOptIn: true,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ SMS Turn Alerts Enabled for ${formatted}!`);
        setIsSmsModalOpen(false);
        fetchTokenStatus();
      } else {
        setSmsPhoneError(json.error || 'Failed to enable SMS alerts.');
      }
    } catch (err) {
      console.error(err);
      setSmsPhoneError('Network error. Please try again.');
    } finally {
      setSmsOptInSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rescheduleSubmitting) return;
    setRescheduleSubmitting(true);
    try {
      const res = await fetch(`/api/token/${tokenId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedDate: rescheduleDate,
          requestedSlot: rescheduleSlot,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('Reschedule request submitted successfully! Pending admin approval.');
        setIsRescheduleOpen(false);
        fetchTokenStatus();
      } else {
        alert(json.error || 'Failed to submit reschedule request.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Synthesize Web Audio Chime (Ding-Dong double tone)
  const playServingChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // High Bell Tone (G5 - 783.99 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain1.gain.setValueAtTime(0.5, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.5);

      // Chime Tone (C6 - 1046.50 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.25);
      gain2.gain.setValueAtTime(0.6, ctx.currentTime + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (err) {
      console.error('Audio chime error:', err);
    }
  };

  const triggerServingAlert = (tokenNumber: number, businessName: string) => {
    playServingChime();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`🔔 YOUR TURN NOW! Token #${tokenNumber}`, {
          body: `Please proceed to counter at ${businessName} immediately!`,
        });
      }
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const requestAlertPermissions = async () => {
    playServingChime();
    setAudioEnabled(true);

    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (vapidPublicKey && tokenId) {
            const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey,
            });

            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tokenId, subscription }),
            });
          }
        }
      }
    } catch (err) {
      console.error('Error subscribing to Web Push notifications:', err);
    }
  };

  const fetchTokenStatus = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const res = await fetch(`/api/token/${tokenId}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to fetch token details');
        return;
      }

      setTokenData((prev) => {
        if (prev) {
          if (prev.status === 'SKIPPED' && json.data.status === 'WAITING') {
            setShowReinsertedBanner(true);
          }

          const wasServing = prev.current_serving_token === prev.token_number || prev.status === 'SERVING';
          const isNowServing = json.data.current_serving_token === json.data.token_number || json.data.status === 'SERVING';

          if (!wasServing && isNowServing) {
            triggerServingAlert(json.data.token_number, json.data.business_name || 'the venue');
          }
        }
        return json.data;
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch token status:', err);
      setError('Network error. Trying to reconnect...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tokenId) return;

    fetchTokenStatus(true);

    // Fallback polling interval (10s)
    const interval = setInterval(() => {
      fetchTokenStatus(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [tokenId]);

  // Ably Real-Time Subscription
  useEffect(() => {
    if (!tokenData?.stream_id) return;

    const key = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY || process.env.ABLY_API_KEY;
    if (!key) return;

    let ably: any = null;
    try {
      ably = new Ably.Realtime({ key });
      const channel = ably.channels.get(`queue:${tokenData.stream_id}`);

      const onRealtimeEvent = () => {
        fetchTokenStatus(false);
      };

      channel.subscribe(onRealtimeEvent);

      return () => {
        try {
          channel.unsubscribe(onRealtimeEvent);
          ably.close();
        } catch (e) {
          // ignore cleanup error
        }
      };
    } catch (err) {
      console.error('Ably client connection error:', err);
    }
  }, [tokenData?.stream_id]);

  const handleLeaveQueue = async () => {
    if (!confirm('Are you sure you want to leave the queue?')) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const json = await res.json();
      if (json.success) {
        setTokenData((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      } else {
        alert(json.error || 'Failed to cancel token');
      }
    } catch (err) {
      console.error('Error leaving queue:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || feedbackSubmitting) return;

    setFeedbackSubmitting(true);
    try {
      const res = await fetch(`/api/token/${tokenId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setFeedbackSubmitted(true);
        const mapsUrl = json.googleMapsUrl || tokenData?.google_maps_url;
        if (mapsUrl) {
          setReturnedMapsUrl(mapsUrl);
          // Directly open in a new tab upon customer submission
          try {
            window.open(mapsUrl, '_blank', 'noopener,noreferrer');
          } catch (e) {
            // Popup blocker fallback handled by UI button
          }
        }
      } else {
        alert(json.error || 'Could not save feedback. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loading Pass...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm max-w-sm w-full text-center border border-gray-200">
          <div className="text-red-500 text-3xl mb-2">⚠️</div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Pass Unavailable</h2>
          <p className="text-xs text-gray-500 mb-4">{error || 'Token not found.'}</p>
          <button
            onClick={() => fetchTokenStatus(true)}
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded-full hover:bg-gray-800 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const terms = getDomainTerminology(tokenData.category);
  const isServing = tokenData.current_serving_token === tokenData.token_number;
  const isCompleted = tokenData.status === 'COMPLETED' || tokenData.status === 'SERVED';
  const isCancelled = tokenData.status === 'CANCELLED';
  const isSkipped = tokenData.status === 'SKIPPED';

  return (
    <div className="min-h-screen bg-[#f3f4f6] py-12 px-4 flex flex-col items-center justify-center font-sans antialiased">
      
      {/* Live Announcement Broadcast Banner */}
      {tokenData.broadcast_message && (
        <div className="mb-4 max-w-[390px] w-full bg-amber-500 text-black px-4.5 py-3 rounded-2xl text-[13px] shadow-sm animate-pulse">
          <div className="font-extrabold flex items-center gap-1.5 mb-0.5">
            <span>📢 OPERATOR ANNOUNCEMENT</span>
          </div>
          <p className="font-semibold text-xs leading-relaxed">{tokenData.broadcast_message}</p>
        </div>
      )}

      {/* Re-inserted Alert Banner */}
      {showReinsertedBanner && (
        <div className="mb-4 max-w-[390px] w-full bg-emerald-50 border border-emerald-200 text-emerald-950 px-4.5 py-3 rounded-2xl text-[13px] flex justify-between items-center shadow-xs animate-bounce">
          <span className="font-semibold">🎉 You are back in line! Your token has been re-inserted.</span>
          <button onClick={() => setShowReinsertedBanner(false)} className="font-bold text-emerald-700 hover:text-emerald-900 ml-2">✕</button>
        </div>
      )}
      
      {/* Card Container */}
      <div className="max-w-[390px] w-full bg-white rounded-[28px] shadow-xl shadow-gray-200/60 overflow-hidden relative border border-gray-100">
        
        {/* Header Bar */}
        <div className="bg-[#0b0b0b] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold tracking-tight text-xl">noQ</span>
            <button
              onClick={requestAlertPermissions}
              className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase transition ${
                audioEnabled
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse cursor-pointer'
              }`}
              title="Click to test & enable audio chime and phone alerts"
            >
              {audioEnabled ? '🔔 ALERTS ON' : '🔊 ENABLE SOUND'}
            </button>
          </div>

          <div className="bg-[#042115] border border-[#0d472a] text-[#22c55e] text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
            LIVE SYNC
          </div>
        </div>

        {/* Location Header */}
        <div className="p-6 border-b border-gray-100">
          <p className="text-[11px] font-bold text-[#a1a1aa] tracking-wider uppercase mb-1">
            LOCATION & VENUE
          </p>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
            {tokenData.business_name}
          </h1>
          <p className="text-sm font-medium text-[#666666] mt-1">
            {terms.guestTerm}: {tokenData.customer_name}
          </p>
        </div>

        {/* Assigned Token Section */}
        <div
          role="region"
          aria-label="Queue Position and Status"
          aria-live="polite"
          className="p-6 text-center"
        >
          <p className="text-[11px] font-bold text-[#a1a1aa] tracking-widest uppercase">
            YOUR ASSIGNED TOKEN
          </p>

          <div className="text-7xl font-black text-[#111111] tracking-tighter my-4">
            #{tokenData.token_number}
          </div>

          {/* Status Indicators */}
          <div>
            {isCompleted ? (
              <div className="space-y-4">
                <div className="bg-[#f4f4f5] text-[#52525b] font-bold text-xs rounded-2xl py-3.5 px-4 uppercase tracking-wider text-center">
                  SERVICE SESSION COMPLETED
                </div>

                {/* POST-SERVICE RATING & FEEDBACK FORM */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-5 text-left shadow-2xs">
                  {feedbackSubmitted ? (
                    <div className="text-center py-2 space-y-2.5">
                      <div className="text-3xl animate-bounce">🌟</div>
                      <div>
                        <p className="text-sm font-extrabold text-emerald-950">Thank you for your rating!</p>
                        <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                          Your feedback helps us provide an exceptional experience.
                        </p>
                      </div>

                      {(returnedMapsUrl || tokenData.google_maps_url) && (
                        <div className="pt-2">
                          <a
                            href={returnedMapsUrl || tokenData.google_maps_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                          >
                            <span>⭐ Share Review on Google Maps ↗</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Rate Your Experience
                        </p>
                        {tokenData.google_maps_url && (
                          <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                            Help others by leaving a quick review
                          </p>
                        )}
                      </div>
                      
                      {/* Star Rating Widget */}
                      <div className="flex justify-center gap-2 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-2xl transition-transform hover:scale-110 cursor-pointer focus:outline-none"
                          >
                            <span className={(hoverRating || rating) >= star ? 'text-amber-400' : 'text-zinc-300'}>
                              ★
                            </span>
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Leave a short comment (optional)..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-white border border-emerald-200 rounded-xl p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />

                      <button
                        type="submit"
                        disabled={rating < 1 || feedbackSubmitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-2xs"
                      >
                        {feedbackSubmitting ? 'Submitting...' : tokenData.google_maps_url ? 'Submit & Review on Google Maps ↗' : 'Submit Feedback'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : isCancelled ? (
              <div className="bg-red-50 text-red-600 font-bold text-xs rounded-2xl py-3.5 px-4 uppercase tracking-wider text-center">
                TOKEN CANCELLED
              </div>
            ) : isServing ? (
              <div className="bg-emerald-500 text-white font-bold text-xs rounded-2xl py-3.5 px-4 uppercase tracking-wider text-center shadow-sm animate-pulse">
                NOW SERVING — PROCEED TO {tokenData.assigned_station ? tokenData.assigned_station.toUpperCase() : 'YOUR ASSIGNED ROOM / TABLE'}
              </div>
            ) : isSkipped ? (
              <div className="space-y-3">
                <div className="bg-amber-500 text-white font-bold text-xs rounded-2xl py-3.5 px-4 uppercase tracking-wider text-center shadow-sm">
                  On Hold / Waitlisted
                </div>
                <div className="bg-amber-50/80 border border-amber-200/50 py-4 px-4 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                    Waitlist Position
                  </p>
                  <p className="text-xl font-black text-amber-950">
                    #{tokenData.waitlist_position || 1}
                  </p>
                  <p className="text-xs text-amber-800/80 mt-1 font-medium leading-relaxed">
                    You were away when called. The operator has placed you on hold. Please check with reception to get back in line.
                  </p>
                </div>
              </div>
            ) : (
              /* Two Separated Cards */
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f4f4f5] py-3.5 px-3 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-1">
                    Ahead in Queue
                  </p>
                  <p className="text-sm font-extrabold text-[#111111]">
                    {tokenData.spots_ahead} {tokenData.spots_ahead === 1 ? terms.guestTerm : terms.guestTermPlural}
                  </p>
                </div>

                <div className="bg-[#f4f4f5] py-3.5 px-3 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-1">
                    Est. Wait Time
                  </p>
                  <p className="text-sm font-extrabold text-[#111111]">
                    ~{formatWaitTime(tokenData.est_wait_mins)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Perforated Boarding Pass Stub Tear Line */}
        <div className="relative flex items-center justify-center my-1 px-4">
          <div className="w-full border-t-2 border-dashed border-zinc-200" />
          <div className="absolute -left-3 w-6 h-6 bg-[#f3f4f6] rounded-full border-r border-zinc-200" />
          <div className="absolute -right-3 w-6 h-6 bg-[#f3f4f6] rounded-full border-l border-zinc-200" />
        </div>

        {/* Boarding Pass Ticket Stub / Utilities Section */}
        <div className="p-5 bg-zinc-50/60 space-y-3">
          
          {/* Quick Action Share & App Buttons (Clean Compact Row) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
            >
              <span>{copiedLink ? '✓ Copied' : '📋 Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
            >
              <span>💬 Share</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPwaPrompt(!showPwaPrompt)}
              className="bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
            >
              <span>📱 App</span>
            </button>
          </div>

          {/* Add to Home Screen PWA Instructions Box (Expandable) */}
          {showPwaPrompt && (
            <div className="bg-white border border-zinc-200 p-3 rounded-2xl text-xs text-zinc-700 space-y-1.5 animate-fade-in text-left shadow-xs">
              <div className="flex items-center justify-between font-bold text-zinc-900">
                <span>📲 Add Pass to Home Screen</span>
                <button onClick={() => setShowPwaPrompt(false)} className="text-zinc-400 font-black">✕</button>
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                <strong>iPhone (Safari):</strong> Tap Share <span className="font-bold">⎋</span> ➔ Tap <strong>"Add to Home Screen"</strong>.
              </p>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                <strong>Android (Chrome):</strong> Tap 3 dots <span className="font-bold">⋮</span> ➔ Tap <strong>"Add to Home Screen"</strong>.
              </p>
            </div>
          )}

          {/* SMS Opt-In Banner */}
          {!isCompleted && !isCancelled && (
            <div>
              {tokenData.sms_opt_in && isValidPhoneNumber(tokenData.customer_phone) ? (
                <div className="bg-emerald-50/90 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">🔔</span>
                    <span className="text-[11px] font-bold text-emerald-900 font-mono">
                      SMS Active: {tokenData.customer_phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSmsPhoneInput(tokenData.customer_phone || '');
                      setIsSmsModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSmsPhoneInput(tokenData.customer_phone || '');
                    setIsSmsModalOpen(true);
                  }}
                  className="w-full bg-white hover:bg-zinc-50 border border-emerald-300 text-emerald-900 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <span>🔔 Inform Me via SMS When Turn Approaches</span>
                </button>
              )}
            </div>
          )}

          {/* Future Reschedule Request Section */}
          {!isCompleted && !isCancelled && (
            <div>
              {tokenData.reschedule_status === 'PENDING' ? (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Reschedule Status</span>
                  <p className="text-[11px] font-bold text-amber-900 mt-0.5">
                    ⏳ Pending Approval: {tokenData.reschedule_requested_date} ({tokenData.reschedule_requested_slot})
                  </p>
                </div>
              ) : tokenData.reschedule_status === 'APPROVED' ? (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Reschedule Status</span>
                  <p className="text-[11px] font-bold text-emerald-900 mt-0.5">
                    ✅ Appointment Approved for Future Date! Check SMS for new pass.
                  </p>
                </div>
              ) : tokenData.reschedule_status === 'REJECTED' ? (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-950 font-extrabold text-[11px] uppercase tracking-wide">
                    <span>⚠️ Slot Unavailable — Please Reconsider</span>
                  </div>
                  <p className="text-[11px] font-medium text-amber-900 leading-relaxed">
                    Requested slot ({tokenData.reschedule_requested_date} at {tokenData.reschedule_requested_slot}) was not approved. Please pick another slot.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRescheduleOpen(true)}
                    className="w-full mt-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer"
                  >
                    📅 Pick Another Date/Slot
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRescheduleOpen(true)}
                  className="w-full bg-zinc-900 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>📅 Request Future Reschedule</span>
                </button>
              )}
            </div>
          )}
        </div>

          {/* Reschedule Modal */}
          {isRescheduleOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-zinc-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold tracking-tight">Request Future Reschedule</h3>
                  <button onClick={() => setIsRescheduleOpen(false)} className="text-zinc-400 hover:text-zinc-600 font-black text-lg">✕</button>
                </div>

                <p className="text-xs text-zinc-500">
                  Can't make it right now? Pick a date and time slot within operating hours. The admin will review and issue your new pass.
                </p>

                <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Target Date</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Target Time Slot</label>
                    <select
                      value={rescheduleSlot}
                      onChange={(e) => setRescheduleSlot(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-emerald-500"
                    >
                      {generateAvailableTimeSlots(tokenData.opening_time, tokenData.closing_time).map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRescheduleOpen(false)}
                      className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={rescheduleSubmitting}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition"
                    >
                      {rescheduleSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Overrun Delay Alert */}
          {tokenData.delay_status === 'DELAYED' && !isServing && !isCompleted && !isCancelled && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200/60 rounded-2xl text-amber-900 text-xs text-left font-medium">
              ⚠️ Session is running slightly over time (+{tokenData.delay_mins}m).
            </div>
          )}

        {/* Bottom Footer Bar */}
        <div className="bg-[#0b0b0b] px-6 py-4 flex items-center justify-between text-xs font-medium text-[#888888]">
          <span>No app installation required</span>
          <a
            href="https://noq-serve.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline flex items-center gap-0.5"
          >
            noq-serve.vercel.app <span className="text-xs">↗</span>
          </a>
        </div>

      </div>

      {/* Leave Queue Option */}
      {!isCancelled && !isCompleted && !isSkipped && (
        <button
          onClick={handleLeaveQueue}
          disabled={isUpdating}
          className="mt-6 text-xs font-semibold text-gray-400 hover:text-red-500 transition uppercase tracking-wider disabled:opacity-50"
        >
          {isUpdating ? 'Cancelling...' : 'Cancel Token'}
        </button>
      )}

    </div>
  );
}