'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Token {
  id: string;
  token_number: number;
  customer_name: string;
  customer_phone: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
  access_channel: 'WALK_IN' | 'PHYSICAL_QR' | 'WEB_DIRECT' | 'LINK' | 'REMOTE' | string;
  created_at: string;
}

// Channel Badge Component
function AccessChannelBadge({ channel }: { channel: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    WALK_IN: {
      label: 'Walk-in',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    PHYSICAL_QR: {
      label: 'QR Scan',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    WEB_DIRECT: {
      label: 'Web Direct',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    LINK: {
      label: 'Web Link',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    REMOTE: {
      label: 'Remote',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  };

  const config = configs[channel] || {
    label: channel || 'N/A',
    className: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.className}`}>
      {config.label}
    </span>
  );
}

function WaitlistContent() {
  const searchParams = useSearchParams();
  const streamId = searchParams.get('streamId') || '';

  const [tokens, setTokens] = useState<Token[]>([]);
  const [businessName, setBusinessName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await fetch(`/api/queue/stream/${streamId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setBusinessName(data.stream?.business_name || 'Clinic Queue');
      }
    } catch (err) {
      console.error('Failed to load waitlist data:', err);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    fetchQueueData();
    // Auto-poll queue status every 4 seconds
    const interval = setInterval(fetchQueueData, 4000);
    return () => clearInterval(interval);
  }, [fetchQueueData]);

  // Re-insert guest using Fair Priority Algorithm
  const handleRequeueFairly = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    try {
      const res = await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'WAITING',
          fair_priority: true, // Triggers midpoint timestamp recalculation
        }),
      });

      if (res.ok) {
        await fetchQueueData();
      } else {
        alert('Failed to re-insert guest into active queue.');
      }
    } catch (err) {
      console.error('Error re-queueing token:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanently cancel a skipped token
  const handleCancelToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to cancel this ticket entirely?')) return;
    setActionLoadingId(tokenId);
    try {
      await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      await fetchQueueData();
    } catch (err) {
      console.error('Error cancelling token:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const skippedTokens = tokens.filter((t) => t.status === 'SKIPPED');
  const waitingCount = tokens.filter((t) => t.status === 'WAITING').length;

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-sans text-zinc-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-black text-zinc-400 flex flex-col justify-between p-5 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-8 px-2">
            <span className="text-2xl font-black text-white tracking-tight">noQ</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-300 font-mono font-medium px-2 py-0.5 rounded tracking-wide">
              ADMIN
            </span>
          </div>

          <nav className="space-y-1.5">
            <Link
              href={streamId ? `/dashboard?streamId=${streamId}` : '/dashboard'}
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center justify-between transition"
            >
              <span>Main Queue</span>
              {waitingCount > 0 && (
                <span className="bg-zinc-800 text-zinc-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {waitingCount}
                </span>
              )}
            </Link>

            <Link
              href={streamId ? `/dashboard/waitlist?streamId=${streamId}` : '/dashboard/waitlist'}
              className="w-full bg-emerald-500 text-white font-semibold text-sm px-4 py-3 rounded-2xl flex items-center justify-between transition shadow-lg shadow-emerald-500/20"
            >
              <span>Skipped Waitlist</span>
              {skippedTokens.length > 0 && (
                <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {skippedTokens.length}
                </span>
              )}
            </Link>

            <Link
              href={streamId ? `/dashboard/analytics?streamId=${streamId}` : '/dashboard/analytics'}
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition"
            >
              <span>Analytics</span>
            </Link>

            <Link
              href={streamId ? `/display/${streamId}` : '/display'}
              target="_blank"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-2 transition"
            >
              <span>Live TV View ↗</span>
            </Link>
          </nav>
        </div>

        {businessName && (
          <div className="bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800/80">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Location</p>
            <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">{businessName}</p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Skipped Guests Waitlist</h1>
              <p className="text-xs text-zinc-500 mt-1">
                Patients who were away when called. Re-inserting places them <strong>2 spots behind the currently serving token</strong> to preserve queue integrity.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                {skippedTokens.length} On Waitlist
              </span>
            </div>
          </div>

          {/* Waitlist Table Container */}
          <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-6 shadow-sm min-h-[450px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-medium">Syncing waitlist...</p>
              </div>
            ) : skippedTokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 text-lg font-bold">
                  ✓
                </div>
                <h3 className="text-sm font-bold text-zinc-800">No Skipped Guests</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  Everyone called from the main queue has responded or completed their appointment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {skippedTokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200/60 bg-zinc-50/50 hover:bg-white hover:border-zinc-300 transition-all shadow-2xs"
                  >
                    {/* Guest Information */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                        #{token.token_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <p className="font-bold text-zinc-900 text-sm">{token.customer_name}</p>
                          <AccessChannelBadge channel={token.access_channel} />
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                          Phone: {token.customer_phone || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCancelToken(token.id)}
                        disabled={actionLoadingId === token.id}
                        className="px-3.5 py-2 text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        Cancel Ticket
                      </button>

                      <button
                        onClick={() => handleRequeueFairly(token.id)}
                        disabled={actionLoadingId === token.id}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
                      >
                        {actionLoadingId === token.id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Re-inserting...
                          </>
                        ) : (
                          'Re-insert Fairly (+2 Spots)'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400">Loading waitlist interface...</div>}>
      <WaitlistContent />
    </Suspense>
  );
}