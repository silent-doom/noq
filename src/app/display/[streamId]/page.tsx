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

  useEffect(() => {
    if (!streamId) return;

    const key = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY || process.env.ABLY_API_KEY;
    if (!key) return;

    let ably: any = null;
    try {
      ably = new Ably.Realtime({ key });
      const channel = ably.channels.get(`queue:${streamId}`);

      const onRealtimeEvent = () => {
        fetchDisplayData();
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
  }, [streamId, fetchDisplayData]);

  const terms = getDomainTerminology(streamInfo?.category);

  // Active serving token
  const currentServingToken = tokens.find((t) => t.status === 'SERVING');

  // Include both WAITING and SKIPPED tokens in the queue view
  const queueTokens = tokens.filter(
    (t) => t.status === 'WAITING' || t.status === 'SKIPPED'
  );

  return (
    <div className="min-h-screen bg-[#07080a] text-white p-8 flex flex-col font-sans select-none overflow-hidden">
      
      {/* TOP HEADER */}
      <header className="flex items-center justify-between pb-6 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black tracking-tight text-white">noQ</span>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE QUEUE DISPLAY
          </div>
        </div>

        <div className="text-right">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {streamInfo?.business_name || 'Business Venue'}
          </h1>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">
            {streamInfo?.stream_name || terms.queueTitle}
          </p>
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
          
          <span className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-6">
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

          <div className="text-2xl font-medium text-zinc-400 tracking-wide mt-4">
            {currentServingToken && currentServingToken.token_number > 0
              ? currentServingToken.customer_name
              : terms.atRestStatus}
          </div>
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