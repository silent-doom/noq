'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface PlatformMetrics {
  totalRevenue: number;
  totalTransactions: number;
  mrr: number;
  totalBusinesses: number;
  activeClients: number;
  graceClients: number;
  lockedClients: number;
  expiredClients: number;
  totalTokensIssued: number;
  totalStorageBytes: number;
  totalStorageFormatted: string;
}

interface ClientRecord {
  id: string;
  name: string;
  category: string;
  phone: string;
  createdAt: string;
  anchorDay: number;
  nextBillingDate: string;
  daysRemaining: number;
  daysOverdue: number;
  monthlyFee: number;
  subscriptionStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' | 'EXPIRED';
  streamCount: number;
  totalTokens: number;
  completedTokens: number;
  waitingTokens: number;
  feedbackCount: number;
  storageFootprint: {
    bytes: number;
    kb: number;
    formatted: string;
  };
}

export default function SuperAdminPage() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [businesses, setBusinesses] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Check saved admin key on load
  useEffect(() => {
    const saved = sessionStorage.getItem('noq_superadmin_key');
    if (saved) {
      setAdminKey(saved);
      setIsAuthenticated(true);
    }
  }, []);

  const fetchPlatformData = useCallback(async (keyToUse?: string) => {
    const key = keyToUse || adminKey;
    if (!key) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin', {
        headers: { 'x-superadmin-key': key },
        cache: 'no-store',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setMetrics(json.platformMetrics);
        setBusinesses(Array.isArray(json.businesses) ? json.businesses : []);
        setIsAuthenticated(true);
        sessionStorage.setItem('noq_superadmin_key', key);
      } else {
        setError(json.error || 'Authentication failed: Invalid Super Admin Master Key');
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error(err);
      setError('Connection error while fetching platform metrics');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchPlatformData();
      const interval = setInterval(() => fetchPlatformData(), 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, adminKey, fetchPlatformData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setAdminKey(keyInput.trim());
    fetchPlatformData(keyInput.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('noq_superadmin_key');
    setAdminKey('');
    setIsAuthenticated(false);
  };

  const handleExecuteAction = async (businessId: string, action: string, extensionDays?: number) => {
    if (!adminKey) return;
    setActionLoadingId(businessId + action);

    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-superadmin-key': adminKey,
        },
        body: JSON.stringify({
          action,
          businessId,
          extensionDays,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ ${json.message}`);
        await fetchPlatformData();
      } else {
        alert(json.error || 'Action failed');
      }
    } catch (e) {
      console.error(e);
      alert('Network error executing admin action');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRunCron = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/cron', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ Subscription & Purge Cron Executed!\nLocked: ${json.summary.locked}, Purged: ${json.summary.purgedBusinesses} (${json.summary.totalPurgedTokens} tokens)`);
        await fetchPlatformData();
      } else {
        alert(json.error || 'Cron run failed');
      }
    } catch (e) {
      alert('Network error executing cron');
    } finally {
      setLoading(false);
    }
  };

  // Filter businesses
  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery);

    const matchesStatus = statusFilter === 'ALL' || b.subscriptionStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-3xl font-black shadow-lg shadow-emerald-950/50">
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">noQ Platform Super Admin</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Enter Master Key for clientele oversight, billing lifecycle, and storage governance.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              required
              placeholder="Enter Super Admin Master Key..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-center text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Authenticating...' : 'Access Platform Dashboard ↗'}
            </button>
          </form>

          <p className="text-[10px] text-zinc-500 leading-tight">
            Protected Platform Gateway • Key configured in database and environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🛡️</span>
              <h1 className="text-2xl font-black tracking-tight text-white">noQ Super Admin Command Center</h1>
              <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Master View
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Clientele Portfolio, Monthly Billing Health, Grace/Lock Policies, and DB Storage Footprint.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunCron}
              disabled={loading}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Runs grace period check, locks overdue accounts, and purges expired token storage"
            >
              <span>🔄 Run Billing Cron</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-xs font-bold text-red-300 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Top Metric KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Revenue</p>
              <p className="text-xl font-black text-emerald-400 font-mono">₹{metrics.totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500">{metrics.totalTransactions} transactions</p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Monthly Run Rate (MRR)</p>
              <p className="text-xl font-black text-white font-mono">₹{metrics.mrr.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-400 font-semibold">{metrics.activeClients} Active Tenants</p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Businesses</p>
              <p className="text-xl font-black text-white font-mono">{metrics.totalBusinesses}</p>
              <p className="text-[10px] text-zinc-400">{metrics.activeClients} Active • {metrics.graceClients} Grace</p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Locked / Expired</p>
              <p className="text-xl font-black text-red-400 font-mono">{metrics.lockedClients + metrics.expiredClients}</p>
              <p className="text-[10px] text-red-400/80">{metrics.lockedClients} Locked • {metrics.expiredClients} Purged</p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Tokens Served</p>
              <p className="text-xl font-black text-sky-400 font-mono">{metrics.totalTokensIssued.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-400">System Throughput</p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">DB Storage Footprint</p>
              <p className="text-xl font-black text-amber-400 font-mono">{metrics.totalStorageFormatted}</p>
              <p className="text-[10px] text-zinc-400">PostgreSQL Consumption</p>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by business name, category, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 w-72 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'ACTIVE', 'GRACE_PERIOD', 'LOCKED', 'EXPIRED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-emerald-500 text-black shadow-xs'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Clientele Directory Table */}
        <div className="bg-zinc-950 border border-zinc-800/90 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white">Clientele Portfolio Directory</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Showing {filteredBusinesses.length} registered business accounts</p>
            </div>
            <span className="text-xs text-zinc-400 font-mono">🔒 PII Protected View</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">Business / Venue</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Anchor Day</th>
                  <th className="py-3.5 px-4">Status & Renewal</th>
                  <th className="py-3.5 px-4">Throughput</th>
                  <th className="py-3.5 px-4">DB Storage</th>
                  <th className="py-3.5 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                {filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500 font-medium">
                      No businesses matching current filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map((b) => {
                    const statusBadge =
                      b.subscriptionStatus === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : b.subscriptionStatus === 'GRACE_PERIOD'
                        ? 'bg-amber-950 text-amber-400 border-amber-800'
                        : b.subscriptionStatus === 'LOCKED'
                        ? 'bg-red-950 text-red-400 border-red-800'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800';

                    return (
                      <tr key={b.id} className="hover:bg-zinc-900/40 transition">
                        <td className="py-4 px-4">
                          <span className="font-bold text-white block text-sm">{b.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{b.phone}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {b.category}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono font-bold text-zinc-200">
                          Day {b.anchorDay}
                        </td>

                        <td className="py-4 px-4 space-y-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}`}>
                            {b.subscriptionStatus.replace('_', ' ')}
                          </span>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            Due: {b.nextBillingDate ? new Date(b.nextBillingDate).toLocaleDateString() : 'N/A'}
                            {b.daysOverdue > 0 ? (
                              <span className="text-red-400 font-bold ml-1">({b.daysOverdue}d overdue)</span>
                            ) : (
                              <span className="text-emerald-400 font-bold ml-1">({b.daysRemaining}d left)</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-bold text-white font-mono">{b.totalTokens} Tokens</span>
                          <span className="block text-[10px] text-zinc-400">
                            {b.completedTokens} Done • {b.waitingTokens} Wait
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-bold text-amber-400 font-mono">{b.storageFootprint.formatted}</span>
                          <span className="block text-[10px] text-zinc-400">{b.streamCount} Streams</span>
                        </td>

                        <td className="py-4 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleExecuteAction(b.id, 'MANUAL_RENEW')}
                            disabled={actionLoadingId === b.id + 'MANUAL_RENEW'}
                            className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            title="Mark paid and extend next billing by +1 month"
                          >
                            +1 Mo Paid
                          </button>

                          <button
                            onClick={() => handleExecuteAction(b.id, 'GRANT_EXTENSION', 7)}
                            disabled={actionLoadingId === b.id + 'GRANT_EXTENSION'}
                            className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            title="Grant +7 days grace extension"
                          >
                            +7d Grace
                          </button>

                          {b.subscriptionStatus === 'LOCKED' ? (
                            <button
                              onClick={() => handleExecuteAction(b.id, 'UNLOCK_TERMINAL')}
                              disabled={actionLoadingId === b.id + 'UNLOCK_TERMINAL'}
                              className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-800 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            >
                              Unlock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExecuteAction(b.id, 'LOCK_TERMINAL')}
                              disabled={actionLoadingId === b.id + 'LOCK_TERMINAL'}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            >
                              Lock
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (confirm(`Purge historical token storage for ${b.name} to free DB space?`)) {
                                handleExecuteAction(b.id, 'PURGE_DATA');
                              }
                            }}
                            disabled={actionLoadingId === b.id + 'PURGE_DATA'}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 rounded-lg font-bold text-[11px] transition cursor-pointer"
                            title="Clean up historical waiting and completed tokens"
                          >
                            🧹 Purge
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <footer className="text-center text-xs text-zinc-500 py-4 border-t border-zinc-900">
          noQ Enterprise Virtual Queue Engine — Super Admin Governance & Billing Platform.
        </footer>
      </div>
    </div>
  );
}
