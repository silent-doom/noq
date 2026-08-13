'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDomainTerminology } from '@/lib/domain';

interface AnalyticsData {
  timeframe: string;
  stream: {
    id: string;
    business_name: string;
    category: string;
    stream_name: string;
    pace_per_patient_mins: number;
  };
  summary: {
    totalIssued: number;
    waiting: number;
    serving: number;
    completed: number;
    skipped: number;
    cancelled: number;
    completionRate: number;
    avgServiceTimeMins: number;
    satisfactionScore: number;
    totalFeedbackCount: number;
  };
  channelBreakdown: { channel: string; count: number }[];
  hourlyDistribution: { hour: number; label: string; count: number }[];
  recentFeedbacks: {
    id: string;
    rating: number;
    comment?: string;
    created_at: string;
    token_number: number;
    customer_name: string;
  }[];
  recentActivity: {
    id: string;
    token_number: number;
    customer_name: string;
    customer_phone?: string;
    status: string;
    access_channel: string;
    created_at: string;
  }[];
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const urlStreamId = searchParams.get('streamId');

  const [streamId, setStreamId] = useState<string | null>(urlStreamId);
  const [timeframe, setTimeframe] = useState<string>('week');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Resolve Active Stream if missing
  useEffect(() => {
    if (urlStreamId) {
      setStreamId(urlStreamId);
      return;
    }

    async function resolveStream() {
      try {
        const res = await fetch('/api/queue/stream', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.streams) && json.streams.length > 0) {
          setStreamId(json.streams[0].id || json.streams[0].stream_id);
        }
      } catch (err) {
        console.error('Failed to resolve stream for analytics:', err);
      }
    }
    resolveStream();
  }, [urlStreamId]);

  // 2. Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await fetch(`/api/queue/stream/${streamId}/analytics?timeframe=${timeframe}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.analytics) {
        setData(json.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, [streamId, timeframe]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const terms = getDomainTerminology(data?.stream?.category);
  const summary = data?.summary;
  const channelData = data?.channelBreakdown || [];
  const hourlyData = data?.hourlyDistribution || [];
  const feedbacks = data?.recentFeedbacks || [];
  const maxHourlyCount = Math.max(...hourlyData.map((h) => h.count), 1);

  return (
    <div className="flex h-screen bg-[#f4f5f7] font-sans text-zinc-900 overflow-hidden relative">
      {/* Dark Sidebar Navigation */}
      <aside className="w-64 bg-black text-zinc-400 flex flex-col justify-between p-5 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-8 px-2">
            <span className="text-2xl font-black text-white tracking-tight">noQ</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono font-medium px-2 py-0.5 rounded tracking-wide">
              ANALYTICS
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
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Waitlist</span>
              </div>
            </Link>

            <Link
              href={streamId ? `/dashboard/analytics?streamId=${streamId}` : '/dashboard/analytics'}
              className="w-full bg-emerald-500 text-white font-semibold text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition shadow-lg shadow-emerald-500/20"
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

        {data?.stream?.business_name && (
          <div className="bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Business Venue</p>
            <p className="text-xs font-semibold text-zinc-200 mt-0.5 truncate">
              {data.stream.business_name}
            </p>
          </div>
        )}
      </aside>

      {/* Main Analytics Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between border-b border-zinc-200/60 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Operations & Performance Analytics</h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-medium">Real-time throughput, satisfaction scores, & weekly admin reports.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeframe Selector */}
            <div className="bg-zinc-100 p-1 rounded-2xl border border-zinc-200 flex text-xs font-semibold">
              <button
                onClick={() => setTimeframe('today')}
                className={`px-3 py-1 rounded-xl transition ${timeframe === 'today' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1 rounded-xl transition ${timeframe === 'week' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                7-Day Weekly
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1 rounded-xl transition ${timeframe === 'month' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                30-Day
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="bg-black hover:bg-zinc-800 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <span>🖨️ Print Report</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-medium">
            Loading analytics metrics...
          </div>
        ) : (
          <div className="p-8 space-y-8 max-w-7xl">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">TOTAL ISSUED</span>
                <div className="text-3xl font-black text-zinc-900 mt-1">{summary?.totalIssued || 0}</div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">{terms.guestTermPlural} served / waiting</div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">COMPLETED SESSIONS</span>
                <div className="text-3xl font-black text-emerald-600 mt-1">{summary?.completed || 0}</div>
                <div className="text-xs text-emerald-700/70 mt-0.5 font-semibold">{summary?.completionRate}% completion rate</div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">AVG SERVICE PACE</span>
                <div className="text-3xl font-black text-zinc-900 mt-1">~{summary?.avgServiceTimeMins || 15}m</div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">per {terms.guestTerm.toLowerCase()}</div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">WAITLIST / SKIPPED</span>
                <div className="text-3xl font-black text-amber-600 mt-1">{summary?.skipped || 0}</div>
                <div className="text-xs text-amber-700/70 mt-0.5 font-semibold">{terms.guestTermPlural} on hold</div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">SATISFACTION RATING</span>
                <div className="text-3xl font-black text-purple-600 mt-1 flex items-center gap-1">
                  <span>{summary?.satisfactionScore?.toFixed(1) || '5.0'}</span>
                  <span className="text-amber-400 text-2xl">★</span>
                </div>
                <div className="text-xs text-purple-700/70 mt-0.5 font-semibold">{summary?.totalFeedbackCount || 0} ratings recorded</div>
              </div>
            </div>

            {/* Middle Section: Channel Breakdown & Hourly Traffic */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Channel Breakdown */}
              <div className="lg:col-span-5 bg-white border border-zinc-200/80 rounded-[2rem] p-7 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 mb-1">Access Channel Breakdown</h3>
                <p className="text-xs text-zinc-400 mb-6 font-medium">Distribution of {terms.guestTerm.toLowerCase()} check-in sources.</p>

                <div className="space-y-4">
                  {channelData.length === 0 ? (
                    <div className="text-xs text-zinc-400 font-medium py-8 text-center">No channel data recorded yet.</div>
                  ) : (
                    channelData.map((item) => {
                      const total = summary?.totalIssued || 1;
                      const percentage = Math.round((item.count / total) * 100);
                      const channelLabels: Record<string, string> = {
                        WALK_IN: 'Walk-in Entry',
                        PHYSICAL_QR: 'Physical QR Scan',
                        WEB_DIRECT: 'Web Direct',
                        LINK: 'Web Link',
                        REMOTE: 'Remote Booking',
                      };

                      return (
                        <div key={item.channel} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold text-zinc-700">
                            <span>{channelLabels[item.channel] || item.channel}</span>
                            <span>{item.count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Hourly Traffic Chart */}
              <div className="lg:col-span-7 bg-white border border-zinc-200/80 rounded-[2rem] p-7 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 mb-1">Hourly Volume Distribution</h3>
                  <p className="text-xs text-zinc-400 mb-6 font-medium">Peak check-in traffic across operating hours.</p>
                </div>

                <div className="h-44 flex items-end justify-between gap-3 pt-4 border-b border-zinc-100 px-2">
                  {hourlyData.length === 0 ? (
                    <div className="w-full text-center text-xs text-zinc-400 font-medium py-12">No hourly traffic data available.</div>
                  ) : (
                    hourlyData.map((h) => {
                      const barHeight = Math.max(12, Math.round((h.count / maxHourlyCount) * 100));
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center gap-2 group">
                          <span className="text-[10px] font-bold text-zinc-500 opacity-0 group-hover:opacity-100 transition">
                            {h.count}
                          </span>
                          <div className="w-full bg-emerald-100 group-hover:bg-emerald-500 rounded-t-lg transition-all" style={{ height: `${barHeight}%` }} />
                          <span className="text-[10px] font-semibold text-zinc-400 truncate">{h.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Customer Satisfaction Feedback Section */}
            {feedbacks.length > 0 && (
              <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-7 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 mb-1">Customer Satisfaction & Rating Feedback</h3>
                <p className="text-xs text-zinc-400 mb-5 font-medium">Direct reviews left by completed {terms.guestTermPlural.toLowerCase()}.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {feedbacks.map((f) => (
                    <div key={f.id} className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-900 text-xs">#{f.token_number} {f.customer_name}</span>
                        <div className="flex text-amber-400 text-xs">
                          {Array.from({ length: f.rating }).map((_, i) => (
                            <span key={i}>★</span>
                          ))}
                        </div>
                      </div>
                      {f.comment && <p className="text-xs text-zinc-600 italic">"{f.comment}"</p>}
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {new Date(f.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity Log */}
            <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-7 shadow-sm">
              <h3 className="text-base font-bold text-zinc-900 mb-1">Recent Activity Log</h3>
              <p className="text-xs text-zinc-400 mb-5 font-medium">Latest token operations and status updates.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="pb-3 px-3">Token</th>
                      <th className="pb-3 px-3">{terms.guestTerm} Name</th>
                      <th className="pb-3 px-3">Phone</th>
                      <th className="pb-3 px-3">Channel</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 text-zinc-800">
                    {data?.recentActivity?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-400">
                          No recent tokens found.
                        </td>
                      </tr>
                    ) : (
                      data?.recentActivity.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-50/60 transition">
                          <td className="py-3 px-3 font-bold text-zinc-900">#{t.token_number}</td>
                          <td className="py-3 px-3 font-semibold">{t.customer_name}</td>
                          <td className="py-3 px-3 text-zinc-500">{t.customer_phone || 'N/A'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                              {t.access_channel || 'WALK_IN'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : t.status === 'SERVING'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : t.status === 'SKIPPED'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-400 font-mono">
                            {t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400">Loading Analytics...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
