'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDomainTerminology } from '@/lib/domain';

interface Token {
  id: string;
  token_number: number;
  customer_name: string;
  customer_phone: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
  access_channel: 'WALK_IN' | 'PHYSICAL_QR' | 'WEB_DIRECT' | 'LINK' | 'REMOTE' | string;
  created_at: string;
  reschedule_requested_date?: string;
  reschedule_requested_slot?: string;
  reschedule_status?: string;
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

  const [streamCategory, setStreamCategory] = useState<string>('');

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await fetch(`/api/queue/stream/${streamId}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setBusinessName(data.stream?.business_name || 'Business Venue');
        if (data.stream?.category) {
          setStreamCategory(data.stream.category);
        }
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

  const handleApproveReschedule = async (tokenId: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    setActionLoadingId(tokenId);
    try {
      const res = await fetch(`/api/token/${tokenId}/reschedule/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(action === 'APPROVE' ? `Approved! Issued new Token #${json.newToken?.token_number}` : 'Reschedule request updated and customer notified.');
        fetchQueueData();
      } else {
        alert(json.error || 'Action failed');
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const skippedTokens = tokens.filter((t) => t.status === 'SKIPPED');
  const pendingRescheduleTokens = tokens.filter((t) => t.reschedule_status === 'PENDING');
  const terms = getDomainTerminology(streamCategory);

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
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Dashboard</span>
            </Link>

            <Link
              href={streamId ? `/dashboard/waitlist?streamId=${streamId}` : '/dashboard/waitlist'}
              className="w-full bg-amber-500 text-black font-semibold text-sm px-4 py-3 rounded-2xl flex items-center justify-between transition shadow-lg shadow-amber-500/20"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Waitlist</span>
              </div>
              {skippedTokens.length > 0 && (
                <span className="bg-black/20 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {skippedTokens.length}
                </span>
              )}
            </Link>

            <Link
              href={streamId ? `/dashboard/analytics?streamId=${streamId}` : '/dashboard/analytics'}
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Analytics</span>
            </Link>

            <Link
              href={streamId ? `/display/${streamId}` : '/display'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>TV Display ↗</span>
            </Link>
          </nav>
        </div>

        {businessName && (
          <div className="bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Business Venue</p>
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
              <h1 className="text-2xl font-bold text-zinc-900">Skipped {terms.guestTermPlural} Waitlist</h1>
              <p className="text-xs text-zinc-500 mt-1">
                {terms.guestTermPlural} who were away when called. Re-inserting places them <strong>2 spots behind the currently serving token</strong> to preserve queue integrity.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                {skippedTokens.length} On Waitlist
              </span>
            </div>
          </div>

          {/* Pending Reschedule Requests Banner */}
          {pendingRescheduleTokens.length > 0 && (
            <div className="mb-8 bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📥</span>
                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                  Pending Future Reschedule Requests ({pendingRescheduleTokens.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {pendingRescheduleTokens.map((req) => (
                  <div key={req.id} className="bg-white border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-xs gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-zinc-900">
                          {req.customer_name || 'Guest'}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Token #{req.token_number}
                        </span>
                        {req.customer_phone && (
                          <span className="text-xs font-mono text-zinc-500">
                            ({req.customer_phone})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-700 font-semibold mt-1">
                        📅 Requested Slot: <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{req.reschedule_requested_date} at {req.reschedule_requested_slot}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveReschedule(req.id, 'APPROVE')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        ✓ APPROVE & ISSUE TOKEN
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Optional note to user (e.g. "Slot unavailable. Please pick a slot between 2 PM - 5 PM"):');
                          if (note !== null) {
                            handleApproveReschedule(req.id, 'REJECT', note);
                          }
                        }}
                        className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        💬 RECONSIDER / REJECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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