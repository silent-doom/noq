'use client';

import { useState, useEffect, useCallback } from 'react';
import Ably from 'ably';
import { getDomainTerminology } from '@/lib/domain';

interface Token {
  id: string;
  token_number: number;
  customer_name?: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
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
    const interval = setInterval(fetchDisplayData, 10000);
    return () => clearInterval(interval);
  }, [fetchDisplayData]);

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [servingCounter, setServingCounter] = useState<string>('Counter 1');

  const speakAnnouncement = (tokenNum: number, counter: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `Attention please. Token number ${tokenNum}, please proceed to ${counter}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  };

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
        if (msg?.name === 'TOKEN_CALLED' && msg?.data?.serving_token && ttsEnabled) {
          const st = msg.data.serving_token;
          const counter = st.counter_name || 'Counter 1';
          setServingCounter(counter);
          speakAnnouncement(st.token_number, counter);
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

  // Active serving token
  const currentServingToken = tokens.find((t) => t.status === 'SERVING');

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

        <div className="flex items-center gap-4">
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
            <span>{ttsEnabled ? '🔊 VOICE ANNOUNCEMENTS ON' : '🔇 VOICE MUTED'}</span>
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
        
        {/* LEFT COLUMN: NOW SERVING HERO BOX */}
        <div className="col-span-7 bg-[#0d0e12] border-2 border-emerald-500/60 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center relative shadow-[0_0_60px_rgba(16,185,129,0.08)]">
          
          <span className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-4">
            {currentServingToken && currentServingToken.token_number > 0
              ? 'NOW SERVING / CURRENT TURN'
              : 'COUNTER AT REST'}
          </span>

          {/* Displays token number or "--" if none active */}
          <div className="text-[11rem] leading-none font-black text-white tracking-tighter my-2">
            {currentServingToken && currentServingToken.token_number > 0
              ? `#${currentServingToken.token_number}`
              : '--'}
          </div>

          <div className="text-2xl font-medium text-zinc-300 tracking-wide mt-2">
            {currentServingToken && currentServingToken.token_number > 0
              ? currentServingToken.customer_name
              : terms.atRestStatus}
          </div>

          {currentServingToken && (
            <div className="mt-6 px-6 py-2 bg-emerald-500 text-black font-extrabold text-lg rounded-full tracking-wider uppercase shadow-lg shadow-emerald-500/20 animate-pulse">
              ➔ PROCEED TO {servingCounter.toUpperCase()}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: UP NEXT & WAITLIST */}
        <div className="col-span-5 bg-[#0d0e12] border border-zinc-800/80 rounded-[2.5rem] p-8 flex flex-col">
          
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