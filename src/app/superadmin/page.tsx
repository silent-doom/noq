'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface PlatformMetrics {
  totalRevenue: number;
  totalTransactions: number;
  payingBusinessesCount: number;
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
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'PENDING_PAYMENT' | 'GRACE_PERIOD' | 'LOCKED' | 'DEACTIVATED' | 'EXPIRED';
  totalPaidRevenue: number;
  paymentCount: number;
  streamCount: number;
  totalTokens: number;
  completedTokens: number;
  waitingTokens: number;
  feedbackCount: number;
  slotBookingEnabled: boolean;
  slotAddonNextBilling?: string;
  storageFootprint: {
    bytes: number;
    kb: number;
    formatted: string;
  };
}

interface IncidentRecord {
  id: number;
  level: string;
  category: string;
  message: string;
  stack?: string;
  path?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
}

interface SupportTicketRecord {
  id: number;
  ticket_number: string;
  source: string;
  business_id?: string;
  business_name?: string;
  stream_id?: string;
  token_id?: string;
  contact_name: string;
  contact_phone: string;
  category: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  created_at: string;
  updated_at: string;
}

export default function SuperAdminPage() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [businesses, setBusinesses] = useState<ClientRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'BUSINESSES' | 'INCIDENTS' | 'TICKETS'>('BUSINESSES');

  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState<string>('ALL');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [expandedIncidentId, setExpandedIncidentId] = useState<number | null>(null);

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
        setIncidents(Array.isArray(json.recentIncidents) ? json.recentIncidents : []);
        setSupportTickets(Array.isArray(json.supportTickets) ? json.supportTickets : []);
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
        body: JSON.stringify({ businessId, action, extensionDays }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`Action '${action}' executed successfully.`);
        fetchPlatformData();
      } else {
        alert(json.error || 'Failed to execute superadmin action');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while performing superadmin action');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: number, newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    if (!adminKey) return;
    setActionLoadingId(`TICKET_${ticketId}`);
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-superadmin-key': adminKey,
        },
        body: JSON.stringify({
          action: 'UPDATE_TICKET',
          ticketId,
          ticketStatus: newStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchPlatformData();
      } else {
        alert(json.error || 'Failed to update ticket status');
      }
    } catch {
      alert('Network error updating ticket status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRunCron = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/cron', {
        method: 'POST',
        headers: { 'x-superadmin-key': adminKey },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(`Billing Cron Completed!\n• Overdue Checked: ${json.summary?.overdueChecked || 0}\n• Accounts Locked: ${json.summary?.lockedAccounts || 0}\n• Tokens Purged: ${json.summary?.purgedTokensCount || 0}`);
        fetchPlatformData();
      } else {
        alert(json.error || 'Failed to trigger cron');
      }
    } catch {
      alert('Network error executing cron');
    } finally {
      setLoading(false);
    }
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PAID') return b.totalPaidRevenue > 0;
    return b.subscriptionStatus === statusFilter;
  });

  const filteredIncidents = incidents.filter((inc) => {
    const matchesCategory =
      incidentCategoryFilter === 'ALL' || inc.category === incidentCategoryFilter;
    const matchesSearch =
      searchQuery === '' ||
      inc.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.path && inc.path.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredTickets = supportTickets.filter((t) => {
    const matchesStatus = ticketStatusFilter === 'ALL' || t.status === ticketStatusFilter;
    const matchesSearch =
      searchQuery === '' ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.contact_phone.includes(searchQuery) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.business_name && t.business_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-xl">
              🛡️
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">noQ Super Admin Vault</h1>
            <p className="text-xs text-zinc-400">
              Master authorization required for enterprise platform metrics & billing governance.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/80 border border-red-800 text-red-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Master Super Admin Key
              </label>
              <input
                type="password"
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter SUPERADMIN_SECRET..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Unlock Super Admin'}
            </button>
          </form>

          <div className="pt-4 border-t border-zinc-900 text-center">
            <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              ← Return to Operator Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        
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
              Clientele Portfolio, Monthly Billing Health (₹1,499 Setup / ₹499 Renewal), Real-time Incident DB Logs, and Incoming Support Inquiries.
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
              <p className="text-[10px] text-emerald-500/90 font-medium">
                {metrics.totalTransactions} paid txn{metrics.totalTransactions === 1 ? '' : 's'} ({metrics.payingBusinessesCount || 0} clients)
              </p>
            </div>

            <div className="bg-zinc-950/90 border border-zinc-800/90 p-4 rounded-2xl space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Monthly Run Rate (MRR)</p>
              <p className="text-xl font-black text-white font-mono">₹{metrics.mrr.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-400 font-semibold">{metrics.activeClients} Active Tenants (₹499/mo)</p>
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 flex-wrap">
          <button
            onClick={() => setActiveTab('BUSINESSES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'BUSINESSES'
                ? 'bg-zinc-100 text-black shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🏢 Clientele Portfolio ({businesses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('TICKETS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'TICKETS'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🎫 Support Inquiries & Help Tickets ({supportTickets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('INCIDENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'INCIDENTS'
                ? 'bg-zinc-100 text-black shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🚨 Production DB Incident Logs ({incidents.length})</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={
                activeTab === 'BUSINESSES'
                  ? 'Search business name, category, phone...'
                  : activeTab === 'TICKETS'
                  ? 'Search tickets by number, name, phone, venue, subject...'
                  : 'Search incident logs, URL path, error message...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 w-80 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {activeTab === 'BUSINESSES' ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'PAID', 'ACTIVE', 'TRIAL', 'PENDING_PAYMENT', 'GRACE_PERIOD', 'LOCKED', 'DEACTIVATED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {st === 'PAID' ? '💳 PAID REVENUE' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          ) : activeTab === 'TICKETS' ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    ticketStatusFilter === st
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'PASS_GENERATION', 'AUDIO_TTS', 'PAYMENT', 'QUEUE_ADVANCE', 'DATABASE', 'CLIENT_EXCEPTION'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setIncidentCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    incidentCategoryFilter === cat
                      ? 'bg-red-500 text-white shadow-xs'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: Clientele Directory Table */}
        {activeTab === 'BUSINESSES' && (
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
                    <th className="py-3.5 px-4">Lifetime Revenue</th>
                    <th className="py-3.5 px-4">Throughput</th>
                    <th className="py-3.5 px-4">DB Storage</th>
                    <th className="py-3.5 px-4">📅 Slot Add-On</th>
                    <th className="py-3.5 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {filteredBusinesses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500 font-medium">
                        No businesses matching current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBusinesses.map((b) => {
                      const statusBadge =
                        b.subscriptionStatus === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : b.subscriptionStatus === 'TRIAL'
                          ? 'bg-sky-950 text-sky-400 border-sky-800'
                          : b.subscriptionStatus === 'PENDING_PAYMENT'
                          ? 'bg-purple-950 text-purple-400 border-purple-800'
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
                            {b.totalPaidRevenue > 0 ? (
                              <div className="space-y-0.5">
                                <span className="font-black text-emerald-400 font-mono text-sm block">
                                  ₹{b.totalPaidRevenue.toLocaleString()}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90 font-bold bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                                  <span>💳</span> {b.paymentCount} Paid Txn{b.paymentCount === 1 ? '' : 's'}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-zinc-500 text-xs">₹0</span>
                            )}
                          </td>

                          <td className="py-4 px-4 font-mono">
                            <div className="space-y-0.5">
                              <span className="text-white font-bold block">{b.totalTokens} tokens</span>
                              <span className="text-[10px] text-zinc-500 block">
                                {b.completedTokens} served • {b.waitingTokens} queue
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 font-mono text-xs">
                            <span className="text-amber-400 font-semibold">{b.storageFootprint.formatted}</span>
                          </td>

                          <td className="py-4 px-4">
                            {b.slotBookingEnabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-full text-[10px] font-bold">
                                📅 Active
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-[10px] font-medium">—</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleExecuteAction(b.id, 'EXTEND_GRACE', 7)}
                              disabled={actionLoadingId === b.id + 'EXTEND_GRACE'}
                              className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-400 border border-amber-800 rounded-lg font-bold text-[11px] transition cursor-pointer"
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
                              onClick={() => handleExecuteAction(b.id, b.slotBookingEnabled ? 'DISABLE_SLOT_ADDON' : 'ENABLE_SLOT_ADDON')}
                              disabled={actionLoadingId === b.id + (b.slotBookingEnabled ? 'DISABLE_SLOT_ADDON' : 'ENABLE_SLOT_ADDON')}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer border ${
                                b.slotBookingEnabled
                                  ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
                              }`}
                              title={b.slotBookingEnabled ? 'Disable Slot Booking Add-On' : 'Enable Slot Booking Add-On (₹299/mo)'}
                            >
                              {b.slotBookingEnabled ? '📅 Disable' : '📅 Enable'}
                            </button>

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
        )}

        {/* TAB 2: Incoming Support & Help Tickets */}
        {activeTab === 'TICKETS' && (
          <div className="bg-zinc-950 border border-zinc-800/90 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white">Incoming Support Tickets & Hotline Inquiries</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing {filteredTickets.length} issues submitted by business operators and visitors
                </p>
              </div>
              <button
                onClick={() => fetchPlatformData()}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 rounded-lg transition cursor-pointer"
              >
                🔄 Refresh Tickets
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">Ticket Ref</th>
                    <th className="py-3.5 px-4">Contact & Caller</th>
                    <th className="py-3.5 px-4">Venue / Business</th>
                    <th className="py-3.5 px-4">Category & Issue</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-medium">
                        ✨ No active support inquiries matching current filter. All tickets resolved.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t) => {
                      const statusBadge =
                        t.status === 'RESOLVED'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-sky-950 text-sky-400 border-sky-800'
                          : 'bg-amber-950 text-amber-400 border-amber-800 animate-pulse';

                      return (
                        <tr key={t.id} className="hover:bg-zinc-900/40 transition">
                          <td className="py-4 px-4 font-mono font-bold text-white">
                            <span className="block text-emerald-400">{t.ticket_number}</span>
                            <span className="text-[10px] text-zinc-500 font-normal">{new Date(t.created_at).toLocaleString()}</span>
                          </td>

                          <td className="py-4 px-4">
                            <span className="font-bold text-white block">{t.contact_name}</span>
                            <a
                              href={`tel:${t.contact_phone}`}
                              className="text-emerald-400 hover:underline font-mono text-[11px] block mt-0.5"
                            >
                              📞 {t.contact_phone}
                            </a>
                            <span className="text-[10px] text-zinc-500 uppercase">{t.source}</span>
                          </td>

                          <td className="py-4 px-4 text-zinc-300">
                            {t.business_name || 'N/A'}
                          </td>

                          <td className="py-4 px-4 max-w-xs">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 mb-1 inline-block">
                              {t.category}
                            </span>
                            <p className="font-bold text-white text-xs">{t.subject}</p>
                          </td>

                          <td className="py-4 px-4 max-w-sm text-zinc-400 text-[11px] leading-relaxed">
                            {t.description}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}`}>
                              {t.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right space-x-1.5">
                            {t.status !== 'RESOLVED' ? (
                              <button
                                onClick={() => handleUpdateTicketStatus(t.id, 'RESOLVED')}
                                disabled={actionLoadingId === `TICKET_${t.id}`}
                                className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Mark Resolved ✓
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateTicketStatus(t.id, 'OPEN')}
                                disabled={actionLoadingId === `TICKET_${t.id}`}
                                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                Re-open
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Production Issue Logs Table */}
        {activeTab === 'INCIDENTS' && (
          <div className="bg-zinc-950 border border-zinc-800/90 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white">Live Production Issue & Exception DB Logs</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing {filteredIncidents.length} recent runtime incidents recorded in PostgreSQL
                </p>
              </div>
              <button
                onClick={() => fetchPlatformData()}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 rounded-lg transition"
              >
                🔄 Refresh Logs
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">Level</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Message</th>
                    <th className="py-3.5 px-4">Path / Route</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 font-medium">
                        ✨ No incidents or errors recorded matching current criteria. Systems running optimally.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => {
                      const levelBadge =
                        inc.level === 'CRITICAL'
                          ? 'bg-red-950 text-red-300 border-red-700 font-black'
                          : inc.level === 'ERROR'
                          ? 'bg-red-950/80 text-red-400 border-red-900 font-bold'
                          : inc.level === 'WARN'
                          ? 'bg-amber-950 text-amber-400 border-amber-800 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 font-medium';

                      const isExpanded = expandedIncidentId === inc.id;

                      return (
                        <tr key={inc.id} className="hover:bg-zinc-900/40 transition">
                          <td className="py-4 px-4 align-top">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${levelBadge}`}>
                              {inc.level}
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top font-mono font-bold text-zinc-300">
                            {inc.category}
                          </td>

                          <td className="py-4 px-4 align-top max-w-md">
                            <p className="text-zinc-200 font-medium text-xs break-words">{inc.message}</p>
                            {isExpanded && (
                              <div className="mt-2.5 p-3 bg-black border border-zinc-800 rounded-xl space-y-2 font-mono text-[11px]">
                                {inc.stack && (
                                  <div>
                                    <p className="text-zinc-500 text-[10px] uppercase font-bold">Stack Trace:</p>
                                    <pre className="text-red-400 whitespace-pre-wrap max-h-40 overflow-y-auto mt-1">
                                      {inc.stack}
                                    </pre>
                                  </div>
                                )}
                                {inc.metadata && (
                                  <div>
                                    <p className="text-zinc-500 text-[10px] uppercase font-bold">Metadata:</p>
                                    <pre className="text-emerald-400 whitespace-pre-wrap mt-1">
                                      {JSON.stringify(inc.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {inc.user_agent && (
                                  <p className="text-[10px] text-zinc-600 truncate">
                                    UA: {inc.user_agent}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 align-top font-mono text-zinc-400 text-[11px]">
                            {inc.path || '—'}
                          </td>

                          <td className="py-4 px-4 align-top font-mono text-zinc-400 text-[11px]">
                            {new Date(inc.created_at).toLocaleString()}
                          </td>

                          <td className="py-4 px-4 align-top text-right">
                            <button
                              onClick={() => setExpandedIncidentId(isExpanded ? null : inc.id)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            >
                              {isExpanded ? 'Hide' : 'Inspect'}
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
        )}

        {/* Footer Note */}
        <footer className="text-center text-xs text-zinc-500 py-4 border-t border-zinc-900">
          noQ Enterprise Virtual Queue Engine — Super Admin Governance & Billing Platform.
        </footer>
      </div>
    </div>
  );
}
