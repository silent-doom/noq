'use client';

import { useState, useEffect, useCallback } from 'react';
import Ably from 'ably';
import { getDomainTerminology } from '@/lib/domain';

interface Token {
  id: string;
  token_number: number;
  customer_name?: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
  assigned_station?: string;
  access_channel?: string;
}

interface StreamInfo {
  stream_id: string;
  business_name: string;
  stream_name: string;
  status: string;
  category?: string;
  broadcast_message?: string;
  current_serving_token: number;
}

import { playChimeAndAnnounce, playTestAnnouncement, VoiceLanguage } from '@/lib/audioAnnouncement';

export default function DisplayPage({ params }: { params: { streamId: string } }) {
  const streamId = params.streamId;

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);

  // Fetch Stream & Queue Data
  const fetchDisplayData = useCallback(async () => {
    if (!streamId) return;

    try {
      const res = await fetch(`/api/queue/stream/${streamId}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        if (data.stream) {
          setStreamInfo(data.stream);
        }
      }
    } catch (err) {
      console.error('TV Display fetch error:', err);
    }
  }, [streamId]);

  // Real-time updates via Ably Pub/Sub & 10s fallback polling
  useEffect(() => {
    fetchDisplayData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchDisplayData();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDisplayData]);

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>('hi');
  const [servingCounter, setServingCounter] = useState<string>('Counter 1');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('noq_voice_lang') as VoiceLanguage;
      if (saved) setVoiceLang(saved);
    }
  }, []);

  const handleSetVoiceLang = (lang: VoiceLanguage, shouldPreview: boolean = true) => {
    setVoiceLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('noq_voice_lang', lang);
    }
    if (shouldPreview && ttsEnabled) {
      playTestAnnouncement(lang, servingCounter);
    }
  };

  const [emergencyAlert, setEmergencyAlert] = useState<{
    active: boolean;
    stationName: string;
    patientName: string;
    triggeredAt: string;
  } | null>(null);

  useEffect(() => {
    if (!streamId) return;

    const key = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY || process.env.ABLY_API_KEY;
    if (!key) return;

    let ably: any = null;
    try {
      ably = new Ably.Realtime({ key });
      const channel = ably.channels.get(`queue:${streamId}`);

      const onRealtimeEvent = (msg: any) => {
        fetchDisplayData();
        if (msg?.name === 'EMERGENCY_CALL') {
          const data = msg.data;
          const station = data?.stationName || 'Doctor Room 1';
          setEmergencyAlert({
            active: true,
            stationName: station,
            patientName: data?.patientName || 'Emergency Patient',
            triggeredAt: new Date().toLocaleTimeString(),
          });

          // Play immediate emergency TTS announcement
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel();
              const text =
                voiceLang === 'hi'
                  ? `कृपया ध्यान दें। ${station} में आपातकालीन डॉक्टर परामर्श की आवश्यकता है। रास्ता साफ़ करें।`
                  : `Attention please. Emergency clinical consultation required immediately in ${station}. Please clear the way.`;
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.rate = 0.92;
              utterance.pitch = 1.1;
              utterance.lang = voiceLang === 'hi' ? 'hi-IN' : 'en-US';
              window.speechSynthesis.speak(utterance);
            } catch (ttsErr) {
              console.error('Emergency TTS error:', ttsErr);
            }
          }

          // Auto-dismiss emergency modal after 30 seconds
          setTimeout(() => {
            setEmergencyAlert((prev) => (prev ? { ...prev, active: false } : null));
          }, 30000);
        } else if (msg?.name === 'TOKEN_CALLED' && msg?.data?.serving_token) {
          const st = msg.data.serving_token;
          const counter = st.assigned_station || st.counter_name || 'Counter 1';
          setServingCounter(counter);
          if (ttsEnabled) {
            playChimeAndAnnounce(st.token_number, counter, { language: voiceLang });
          }
        }
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
      console.error('Ably connection error on TV Display:', err);
    }
  }, [streamId, fetchDisplayData, ttsEnabled]);

  const terms = getDomainTerminology(streamInfo?.category);

  // Active serving tokens (support parallel multi-doctor/station serving)
  const servingTokens = tokens.filter((t) => t.status === 'SERVING');
  const currentServingToken = servingTokens[0];

  // Include both WAITING and SKIPPED tokens in the queue view
  const queueTokens = tokens.filter(
    (t) => t.status === 'WAITING' || t.status === 'SKIPPED'
  );

  const [userInteracted, setUserInteracted] = useState<boolean>(false);

  const unlockAudio = () => {
    setUserInteracted(true);
    setTtsEnabled(true);
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const testUtterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(testUtterance);
      }
    } catch (e) {}
  };

  return (
    <div
      onClick={() => !userInteracted && unlockAudio()}
      className="min-h-screen bg-[#090a0f] text-white p-8 font-sans flex flex-col justify-between overflow-hidden relative selection:bg-emerald-500/30"
    >
      {/* AUDIO UNMUTE OVERLAY BANNER */}
      {!userInteracted && (
        <div
          onClick={unlockAudio}
          className="bg-emerald-500 hover:bg-emerald-400 text-black py-3 px-6 rounded-2xl flex items-center justify-between text-xs font-black tracking-wider uppercase cursor-pointer shadow-lg animate-bounce mb-4"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🔊</span>
            <span>TV VOICE ANNOUNCEMENTS MUTED — TAP ANYWHERE TO UNMUTE AUDIO</span>
          </div>
          <span className="bg-black text-white px-3 py-1 rounded-xl text-[10px] font-extrabold">ENABLE AUDIO</span>
        </div>
      )}

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white tracking-tight">noQ</span>
          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            LOUNGE TV DISPLAY
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector Pills */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-full p-1 text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSetVoiceLang('hi');
              }}
              className={`px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                voiceLang === 'hi'
                  ? 'bg-emerald-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Regional Hindi Female Voice"
            >
              🇮🇳 हिन्दी
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSetVoiceLang('bilingual');
              }}
              className={`px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                voiceLang === 'bilingual'
                  ? 'bg-emerald-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Bilingual: English followed by Hindi announcement"
            >
              🌐 EN + HI
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSetVoiceLang('en');
              }}
              className={`px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                voiceLang === 'en'
                  ? 'bg-emerald-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="English Female Voice"
            >
              🇬🇧 English
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
              setTtsEnabled(!ttsEnabled);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              ttsEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}
          >
            <span>{ttsEnabled ? '🔊 VOICE ON' : '🔇 MUTED'}</span>
          </button>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {streamInfo?.business_name || 'Business Venue'}
            </h1>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              {streamInfo?.stream_name || terms.queueTitle}
            </p>
          </div>
        </div>
      </header>

      {/* LIVE BROADCAST TICKER */}
      {streamInfo?.broadcast_message && (
        <div className="mt-4 bg-amber-500 text-black py-2.5 px-6 rounded-2xl flex items-center gap-3 font-extrabold text-sm shadow-lg animate-pulse">
          <span>📢 BROADCAST:</span>
          <span className="font-semibold text-xs leading-tight">{streamInfo.broadcast_message}</span>
        </div>
      )}

      {/* MAIN DISPLAY CONTENT */}
      <main className="grid grid-cols-12 gap-8 flex-1 mt-6 items-stretch">
        
        {/* LEFT COLUMN: NOW SERVING HERO BOX (MULTI-STATION SUPPORT) */}
        <div
          role="region"
          aria-label="Now Serving Section"
          aria-live="assertive"
          className="col-span-7 bg-[#0d0e12] border-2 border-emerald-500/60 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center relative shadow-[0_0_60px_rgba(16,185,129,0.08)]"
        >
          
          <span className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-4">
            {servingTokens.length > 0
              ? `NOW SERVING (${servingTokens.length} ACTIVE STATION${servingTokens.length > 1 ? 'S' : ''})`
              : 'COUNTER AT REST'}
          </span>

          {servingTokens.length === 0 ? (
            <div className="my-auto space-y-4">
              <div className="text-7xl font-black text-zinc-700">--</div>
              <div className="text-xl font-medium text-zinc-400">{terms.atRestStatus}</div>
            </div>
          ) : servingTokens.length === 1 ? (
            <div className="my-auto flex flex-col items-center">
              <div className="text-[10rem] leading-none font-black text-white tracking-tighter my-1">
                #{servingTokens[0].token_number}
              </div>
              <div className="text-2xl font-medium text-zinc-300 tracking-wide mt-2">
                {servingTokens[0].customer_name || `Anonymous ${terms.guestTerm}`}
              </div>
              <div className="mt-6 px-6 py-2.5 bg-emerald-500 text-black font-extrabold text-lg rounded-full tracking-wider uppercase shadow-lg shadow-emerald-500/20 animate-pulse">
                ➔ PROCEED TO {(servingTokens[0].assigned_station || servingCounter).toUpperCase()}
              </div>
            </div>
          ) : (
            /* Parallel Multi-Station Active Grid */
            <div className="w-full grid grid-cols-2 gap-4 my-auto">
              {servingTokens.map((st) => (
                <div
                  key={st.id}
                  className="bg-zinc-950/80 border border-emerald-500/40 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg"
                >
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {st.assigned_station || 'Station'}
                  </span>
                  <div className="text-5xl font-black text-white tracking-tight my-2">
                    #{st.token_number}
                  </div>
                  <div className="text-xs font-semibold text-zinc-300 truncate max-w-full">
                    {st.customer_name || `Anonymous ${terms.guestTerm}`}
                  </div>
                  <div className="mt-3 px-3 py-1 bg-emerald-500 text-black font-bold text-xs rounded-full uppercase tracking-wider">
                    PROCEED NOW ➔
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: UP NEXT & WAITLIST */}
        <div
          role="region"
          aria-label="Upcoming Queue Waitlist"
          aria-live="polite"
          className="col-span-5 bg-[#0d0e12] border border-zinc-800/80 rounded-[2.5rem] p-8 flex flex-col"
        >
          
          <div className="flex items-center justify-between pb-5 border-b border-zinc-800/80">
            <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
              UP NEXT & WAITLIST
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              {queueTokens.length} Pending
            </span>
          </div>

          {/* QUEUE LIST */}
          <div className="mt-6 space-y-3.5 flex-1 overflow-y-auto">
            {queueTokens.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 font-medium text-sm">
                No upcoming {terms.guestTermPlural.toLowerCase()} in queue
              </div>
            ) : (
              queueTokens.slice(0, 7).map((token) => (
                <div
                  key={token.id}
                  className={`border rounded-2xl px-6 py-4 flex items-center justify-between transition-all ${
                    token.status === 'SKIPPED'
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-[#14161d] border-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-white tracking-tight min-w-[60px]">
                      #{token.token_number}
                    </span>

                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-zinc-300 truncate max-w-[180px]">
                        {token.customer_name || `Anonymous ${terms.guestTerm}`}
                      </span>
                      {token.status === 'SKIPPED' && (
                        <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase mt-0.5">
                          Skipped / Waitlisted
                        </span>
                      )}
                    </div>
                  </div>

                  <ChannelBadge channel={token.access_channel} isSkipped={token.status === 'SKIPPED'} />
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* EMERGENCY STAT FLASHING OVERLAY */}
      {emergencyAlert?.active && (
        <div className="fixed inset-0 z-50 bg-red-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-24 h-24 rounded-full bg-red-600/30 border-4 border-red-500 flex items-center justify-center text-5xl animate-bounce mb-6 shadow-2xl shadow-red-500/50">
            🚨
          </div>
          <span className="px-5 py-1.5 rounded-full bg-red-900 border border-red-500 text-red-200 text-xs font-black uppercase tracking-widest mb-4 animate-pulse">
            CRITICAL CLINICAL PRIORITY
          </span>
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase max-w-4xl leading-tight">
            EMERGENCY CONSULTATION IN PROGRESS
          </h2>
          <div className="mt-6 p-6 rounded-3xl bg-black/60 border border-red-500/50 max-w-xl w-full text-center space-y-2">
            <span className="text-xs text-red-400 uppercase font-mono tracking-widest font-bold block">Assigned Station</span>
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-300 block">{emergencyAlert.stationName}</span>
            <p className="text-xs text-zinc-400 mt-2">Please clear the waiting lounge corridors immediately. Normal queue sequence will resume shortly.</p>
          </div>
          <button
            onClick={() => setEmergencyAlert(null)}
            className="mt-8 px-6 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full text-xs font-bold border border-zinc-700 transition cursor-pointer"
          >
            Dismiss Alert Overlay ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ChannelBadge({ channel, isSkipped }: { channel?: string; isSkipped?: boolean }) {
  if (isSkipped) {
    return (
      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-900/40 text-amber-300 border border-amber-500/40">
        On Hold
      </span>
    );
  }

  const normalized = (channel || '').toLowerCase();
  if (normalized.includes('walk')) {
    return (
      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-sky-950/80 text-sky-300 border border-sky-500/30">
        Walk-in
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/30">
      QR Scan
    </span>
  );
}