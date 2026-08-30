'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Ably from 'ably';
import { AccessChannelBadge } from '@/components/AccessChannelBadge';
import { NumberSlider } from '@/components/NumberSlider';
import { getDomainTerminology, formatWaitTime, generateDomainStations } from '@/lib/domain';

interface Token {
  id: string;
  token_number: number;
  customer_name?: string;
  customer_phone?: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED';
  assigned_station?: string;
  access_channel?: string;
  created_at?: string;
  reschedule_requested_date?: string;
  reschedule_requested_slot?: string;
  reschedule_status?: string;
}

interface StreamInfo {
  id: string;
  business_name: string;
  category?: string;
  stream_name: string;
  broadcast_message?: string;
  current_serving_token: number;
  current_effective_time_mins: number;
  pace_per_patient_mins?: number;
  stations?: string[];
  opening_time?: string;
  closing_time?: string;
  operating_days?: string[];
  queue_structure?: string;
}

interface LinkedBranch {
  stream_id: string;
  business_name: string;
  stream_name: string;
  category?: string;
  phone?: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlStreamId = searchParams.get('streamId');

  const [streamId, setStreamId] = useState<string | null>(urlStreamId);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Admin PIN Protection State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Multi-Branch Network State
  const [linkedBranches, setLinkedBranches] = useState<LinkedBranch[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [linkTargetStreamId, setLinkTargetStreamId] = useState<string>('');
  const [linkTargetPasscode, setLinkTargetPasscode] = useState<string>('');
  const [linkLoading, setLinkLoading] = useState<boolean>(false);

  // Patient Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferToken, setTransferToken] = useState<Token | null>(null);
  const [transferTargetStreamId, setTransferTargetStreamId] = useState<string>('');
  const [transferLoading, setTransferLoading] = useState<boolean>(false);

  // Accessibility State
  const [isA11yOpen, setIsA11yOpen] = useState<boolean>(false);
  const [a11yHighContrast, setA11yHighContrast] = useState<boolean>(false);
  const [a11yLargeText, setA11yLargeText] = useState<boolean>(false);

  // Modal States
  const [isWalkInOpen, setIsWalkInOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [customPace, setCustomPace] = useState<number>(15);
  const [broadcastMsg, setBroadcastMsg] = useState<string>('');
  const [editOpenTime, setEditOpenTime] = useState<string>('09:00');
  const [editCloseTime, setEditCloseTime] = useState<string>('20:00');
  const [editOpDays, setEditOpDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [editQueueStruct, setEditQueueStruct] = useState<string>('UNIFIED_PARALLEL');
  const [editGoogleMapsUrl, setEditGoogleMapsUrl] = useState<string>('');

  // Subscription State
  const [subscription, setSubscription] = useState<any>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState<boolean>(false);
  const [renewLoading, setRenewLoading] = useState<boolean>(false);

  const terms = getDomainTerminology(streamInfo?.category);

  // Check saved session PIN authentication
  useEffect(() => {
    if (!streamId) return;
    const sessionAuth = sessionStorage.getItem(`noq_auth_${streamId}`);
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, [streamId]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamId || !pinInput.trim()) return;

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, passcode: pinInput }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem(`noq_auth_${streamId}`, 'true');
        if (json.sessionToken) {
          sessionStorage.setItem(`noq_token_${streamId}`, json.sessionToken);
        }
        setPinError(null);
        setPinInput('');
      } else {
        setPinError(json.error || 'Incorrect Admin PIN');
      }
    } catch (err) {
      setPinError('Connection error. Please try again.');
    }
  };

  // 1. Dynamic Stream Resolution
  useEffect(() => {
    if (urlStreamId) {
      setStreamId(urlStreamId);
      return;
    }

    async function resolveActiveStream() {
      try {
        const res = await fetch('/api/queue/stream', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        if (data.success && Array.isArray(data.streams) && data.streams.length > 0) {
          setStreamId(data.streams[0].id || data.streams[0].stream_id);
        }
      } catch (err) {
        console.error('Failed to resolve active queue stream:', err);
      }
    }

    resolveActiveStream();
  }, [urlStreamId]);

  // 2. Fetch Queue & Stream Data
  const fetchQueueData = useCallback(async () => {
    if (!streamId) return;

    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem(`noq_token_${streamId}`) : null;
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers['x-admin-token'] = adminToken;
      }

      const res = await fetch(`/api/queue/stream/${streamId}`, {
        headers,
        cache: 'no-store',
      });

      if (!res.ok) throw new Error('Failed to fetch dashboard data');

      const data = await res.json();

      if (data.success) {
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        if (data.subscription) {
          setSubscription(data.subscription);
        }
        if (data.stream) {
          setStreamInfo(data.stream);
          const activePace =
            data.stream.pace_per_patient_mins ??
            data.stream.current_effective_time_mins ??
            15;
          setCustomPace(activePace);
          if (data.stream.broadcast_message !== undefined) {
            setBroadcastMsg(data.stream.broadcast_message || '');
          }
          if (data.stream.opening_time) setEditOpenTime(data.stream.opening_time);
          if (data.stream.closing_time) setEditCloseTime(data.stream.closing_time);
          if (Array.isArray(data.stream.operating_days)) setEditOpDays(data.stream.operating_days);
          if (data.stream.queue_structure) setEditQueueStruct(data.stream.queue_structure);
          if (data.stream.google_maps_url !== undefined) setEditGoogleMapsUrl(data.stream.google_maps_url || '');
        }
      }
    } catch (error) {
      console.error('Error fetching operator dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  const handleRenewSubscription = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!streamId || renewLoading) return;

    setRenewLoading(true);
    try {
      const res = await fetch('/api/subscription/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          amount: subscription?.monthlyFee || 999,
          paymentMethod: 'ONLINE_CARD_UPI',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert('✅ Subscription renewed successfully! Your terminal is active.');
        setIsRenewModalOpen(false);
        await fetchQueueData();
      } else {
        alert(json.error || 'Payment failed. Please try again.');
      }
    } catch (err) {
      console.error('Error renewing subscription:', err);
      alert('Network error during renewal. Please try again.');
    } finally {
      setRenewLoading(false);
    }
  };

  // Fetch Linked Branches
  const fetchLinkedBranches = useCallback(async () => {
    if (!streamId) return;
    try {
      const res = await fetch(`/api/branch/link?streamId=${streamId}`);
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.branches)) {
        setLinkedBranches(json.branches);
      }
    } catch (err) {
      console.error('Failed to fetch linked branches:', err);
    }
  }, [streamId]);

  useEffect(() => {
    fetchLinkedBranches();
  }, [fetchLinkedBranches]);

  const handleLinkBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamId || !linkTargetStreamId.trim() || !linkTargetPasscode.trim()) return;

    setLinkLoading(true);
    try {
      const res = await fetch('/api/branch/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceStreamId: streamId,
          targetStreamId: linkTargetStreamId.trim(),
          targetPasscode: linkTargetPasscode.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ ${json.message}`);
        setLinkTargetStreamId('');
        setLinkTargetPasscode('');
        setIsLinkModalOpen(false);
        fetchLinkedBranches();
      } else {
        alert(json.error || 'Failed to link clinic branch.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while linking branch.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleTransferPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferToken || !transferTargetStreamId) return;

    setTransferLoading(true);
    try {
      const res = await fetch('/api/branch/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: transferToken.id,
          targetStreamId: transferTargetStreamId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ ${json.message}`);
        setIsTransferModalOpen(false);
        setTransferToken(null);
        setTransferTargetStreamId('');
        fetchQueueData();
      } else {
        alert(json.error || 'Failed to transfer patient.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during patient transfer.');
    } finally {
      setTransferLoading(false);
    }
  };

  // 3. Real-time updates via Ably Pub/Sub & 10s fallback polling
  useEffect(() => {
    if (!streamId) return;

    fetchQueueData();
    const interval = setInterval(fetchQueueData, 10000);

    return () => clearInterval(interval);
  }, [streamId, fetchQueueData]);

  useEffect(() => {
    if (!streamId) return;

    const key = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY || process.env.ABLY_API_KEY;
    if (!key) return;

    let ably: any = null;
    try {
      ably = new Ably.Realtime({ key });
      const channel = ably.channels.get(`queue:${streamId}`);

      const onRealtimeEvent = () => {
        fetchQueueData();
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
      console.error('Ably client connection error in Dashboard:', err);
    }
  }, [streamId, fetchQueueData]);

  // 4. Update Token Status Action
  const handleUpdateStatus = async (
    tokenId: string,
    status: 'COMPLETED' | 'CANCELLED' | 'SERVING'
  ) => {
    setActionLoading(true);
    try {
      await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchQueueData();
    } catch (err) {
      console.error(`Failed to update token status:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaitlist = async (tokenId: string) => {
    if (!streamId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId, tokenId }),
      });
      if (!res.ok) {
        throw new Error('Failed to waitlist token');
      }
      await fetchQueueData();
    } catch (err) {
      console.error('Failed to waitlist token:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const [activeCounter, setActiveCounter] = useState<string>('Counter 1');

  // 5. CALL NEXT Action
  const handleNextToken = async () => {
    if (!streamId || actionLoading) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/queue/stream/${streamId}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_name: activeCounter }),
      });

      if (!res.ok) {
        const activeServing = tokens.find((t) => t.status === 'SERVING');
        const nextWaiting = tokens.find((t) => t.status === 'WAITING');

        if (activeServing) {
          await fetch(`/api/token/${activeServing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'COMPLETED' }),
          });
        }

        if (nextWaiting) {
          await fetch(`/api/token/${nextWaiting.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SERVING' }),
          });
        }
      }

      await fetchQueueData();
    } catch (err) {
      console.error('Failed to call next token:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Submit New Walk-in Entry
  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamId || !walkInName.trim() || !walkInPhone.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/queue/stream/${streamId}/walkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: walkInName, customer_phone: walkInPhone }),
      });

      if (!res.ok) {
        throw new Error('Walk-in API request failed');
      }

      setWalkInName('');
      setWalkInPhone('');
      setIsWalkInOpen(false);
      await fetchQueueData();
    } catch (err) {
      console.error('Failed to add walk-in entry:', err);
      alert('Could not add walk-in guest. Check console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Update Pace & Broadcast Announcement in Stream Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamId) return;

    setActionLoading(true);
    try {
      await fetch(`/api/queue/stream/${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pace_per_patient_mins: Number(customPace),
          broadcast_message: broadcastMsg,
          opening_time: editOpenTime,
          closing_time: editCloseTime,
          operating_days: editOpDays,
          queue_structure: editQueueStruct,
          google_maps_url: editGoogleMapsUrl.trim(),
        }),
      });
      setIsSettingsOpen(false);
      await fetchQueueData();
    } catch (err) {
      console.error('Failed to update queue settings:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Pace Calculation
  const paceMins =
    streamInfo?.pace_per_patient_mins ??
    streamInfo?.current_effective_time_mins ??
    customPace ??
    15;

  const safeTokens = Array.isArray(tokens) ? tokens : [];
  const allWaitingTokens = safeTokens.filter((t) => t?.status === 'WAITING');
  const currentServingTokenObj = safeTokens.find((t) => t?.status === 'SERVING');

  const displayedWaitingTokens = allWaitingTokens.filter(
    (t) =>
      (t?.customer_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      t?.token_number?.toString().includes(searchQuery)
  );

  const handleExtendPace = async () => {
    if (!streamId || actionLoading) return;
    setActionLoading(true);
    try {
      const currentPace = streamInfo?.current_effective_time_mins || 15;
      const newPace = currentPace + 5;
      const res = await fetch(`/api/queue/stream/${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pace_per_patient_mins: newPace, current_effective_time_mins: newPace }),
      });
      if (res.ok) {
        alert(`⏱️ Added +5 mins extra service time! Dynamic ETAs updated.`);
        fetchQueueData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveReschedule = async (tokenId: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
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
    }
  };

  return (
    <div className="flex h-screen bg-[#f4f5f7] font-sans text-zinc-900 overflow-hidden relative">
      {/* Dark Left Sidebar */}
      <aside className="w-64 bg-black text-zinc-400 flex flex-col justify-between p-5 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-8 px-2">
            <span className="text-2xl font-black text-white tracking-tight">noQ</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono font-medium px-2 py-0.5 rounded tracking-wide">
              OPERATOR
            </span>
          </div>

          <nav className="space-y-1.5">
            <Link
              href={streamId ? `/dashboard?streamId=${streamId}` : '/dashboard'}
              className="w-full bg-emerald-500 text-white font-semibold text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition shadow-lg shadow-emerald-500/20"
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
              {safeTokens.filter((t) => t?.status === 'SKIPPED').length > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {safeTokens.filter((t) => t?.status === 'SKIPPED').length}
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
              href={streamId ? `/dashboard/poster?streamId=${streamId}` : '/dashboard/poster'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 font-medium text-sm px-4 py-3 rounded-2xl flex items-center gap-3 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print QR Poster ↗</span>
            </Link>

            {/* DYNAMIC TV DISPLAY LINK */}
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

        {/* Action Button: Open Walk-in Modal */}
        <button
          onClick={() => setIsWalkInOpen(true)}
          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-medium text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span className="text-base font-bold">+</span>
          <span>New Walk-in {terms.guestTerm}</span>
        </button>
      </aside>

      {/* Main Screen Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-4 flex items-center justify-between border-b border-zinc-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-900">
              {streamInfo?.business_name || 'Business Venue'}
            </h1>
            <span className="text-xs bg-zinc-100 text-zinc-600 font-semibold px-3 py-1 rounded-full border border-zinc-200">
              {streamInfo?.stream_name || terms.queueTitle}
            </span>

            {/* Linked Branch Switcher */}
            {linkedBranches.length > 0 ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs text-emerald-950 font-bold">
                <span className="text-[10px] text-emerald-700 uppercase tracking-wider">BRANCH:</span>
                <select
                  value={streamId || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId && newId !== streamId) {
                      window.location.href = `/dashboard?streamId=${newId}`;
                    }
                  }}
                  className="bg-transparent text-emerald-900 font-bold focus:outline-none cursor-pointer"
                >
                  <option value={streamId || ''}>📍 {streamInfo?.business_name || 'Current'} (Active)</option>
                  {linkedBranches.map((b) => (
                    <option key={b.stream_id} value={b.stream_id}>
                      ➔ {b.business_name} ({b.stream_name})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(true)}
                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full transition flex items-center gap-1 cursor-pointer"
                title="Connect another clinic/branch of this doctor"
              >
                <span>+ Link Branch</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Multi-Counter / Station Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-white">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">STATION:</span>
              <select
                value={activeCounter}
                onChange={(e) => setActiveCounter(e.target.value)}
                className="bg-transparent font-bold text-emerald-400 focus:outline-none cursor-pointer"
              >
                {(Array.isArray(streamInfo?.stations) && streamInfo.stations.length > 0
                  ? streamInfo.stations
                  : generateDomainStations(streamInfo?.category)
                ).map((st) => (
                  <option key={st} value={st} className="bg-zinc-900 text-white">
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={`Search ${terms.guestTerm.toLowerCase()} or token...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 pl-9 pr-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition shadow-xs"
              />
            </div>

            {/* Accessibility Button */}
            <button
              onClick={() => setIsA11yOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition cursor-pointer flex items-center gap-1"
              title="Accessibility Settings (Contrast, Text Size)"
              aria-label="Accessibility Options"
            >
              <span>👓 A11y</span>
            </button>

            {/* Lock / Unlock Status Indicator */}
            <button
              onClick={() => {
                if (isAuthenticated) {
                  if (confirm('Lock Admin Terminal session?')) {
                    setIsAuthenticated(false);
                    if (streamId) {
                      sessionStorage.removeItem(`noq_auth_${streamId}`);
                      sessionStorage.removeItem(`noq_token_${streamId}`);
                    }
                  }
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
                isAuthenticated
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span>{isAuthenticated ? '🔒 Admin Unlocked' : '🔑 Lock Active'}</span>
            </button>

            {/* Settings Gear Icon Modal Toggle */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 shadow-xs transition cursor-pointer"
              title="Queue Settings & Broadcast"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* GRACE PERIOD SUBSCRIPTION WARNING BANNER */}
        {subscription?.isGracePeriod && !subscription?.isLocked && (
          <div className="mx-8 mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <div>
                <span className="font-extrabold text-amber-950">Subscription Renewal Due: </span>
                <span className="text-amber-800">{subscription.message}</span>
              </div>
            </div>
            <button
              onClick={() => setIsRenewModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-2xs"
            >
              Pay Now (₹{subscription.monthlyFee || 999}) ↗
            </button>
          </div>
        )}

        {/* SUBSCRIPTION OVERDUE LOCK OVERLAY */}
        {subscription?.isLocked && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-red-900/60 rounded-3xl max-w-md w-full p-8 text-center text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-red-950/80 border border-red-800 text-red-400 rounded-3xl flex items-center justify-center mx-auto text-3xl font-black">
                🔒
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">Terminal Temporarily Locked</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {subscription.message || 'Your monthly subscription payment is overdue. Please renew to continue calling tokens.'}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Monthly Renewal Fee</span>
                  <span className="font-bold text-white font-mono">₹{subscription.monthlyFee || 999}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Billing Anchor Day</span>
                  <span className="font-bold text-white font-mono">Day {subscription.billingAnchorDay || 'X'}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Days Overdue</span>
                  <span className="font-bold text-red-400 font-mono">{subscription.daysOverdue || 4} Days</span>
                </div>
              </div>

              <button
                onClick={() => setIsRenewModalOpen(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Renew Subscription & Unlock Now (₹{subscription.monthlyFee || 999}) ↗
              </button>
            </div>
          </div>
        )}

        {/* ADMIN AUTHENTICATION LOCK OVERLAY */}
        {!isAuthenticated && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full text-center text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
                🔒
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Admin Terminal Locked</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter Admin Security PIN to access controls for {streamInfo?.business_name || 'Venue'}.
                </p>
              </div>

              <form onSubmit={handleVerifyPin} className="space-y-4">
                <input
                  type="password"
                  required
                  maxLength={10}
                  placeholder="Enter Admin PIN (Default: 123456)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                />

                {pinError && (
                  <p className="text-xs text-red-400 font-semibold bg-red-950/60 border border-red-800/60 py-2 rounded-xl">
                    {pinError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  UNLOCK TERMINAL
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Live Broadcast Announcement Banner if Active */}
        {streamInfo?.broadcast_message && (
          <div className="bg-amber-500 text-black px-8 py-2.5 flex items-center justify-between text-xs font-bold shadow-xs">
            <div className="flex items-center gap-2">
              <span>📢 LIVE BROADCAST ANNOUNCEMENT:</span>
              <span className="font-semibold">{streamInfo.broadcast_message}</span>
            </div>
            <button
              onClick={() => {
                setBroadcastMsg('');
                fetch(`/api/queue/stream/${streamId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ broadcast_message: '' }),
                }).then(() => fetchQueueData());
              }}
              className="text-xs font-black underline hover:opacity-80"
            >
              Clear Broadcast
            </button>
          </div>
        )}

        {/* Pending Reschedule Requests Alert Banner */}
        {safeTokens.filter((t) => t?.reschedule_status === 'PENDING').length > 0 && (
          <div className="mx-8 mt-6 bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📥</span>
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                Pending Future Reschedule Requests ({safeTokens.filter((t) => t?.reschedule_status === 'PENDING').length})
              </h3>
            </div>
            <div className="space-y-2.5">
              {safeTokens
                .filter((t) => t?.reschedule_status === 'PENDING')
                .map((req) => (
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

        {/* Layout Grid */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-black text-white rounded-[2rem] p-7 flex flex-col items-center text-center relative shadow-xl">
              <div className="w-full flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 ${currentServingTokenObj ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'} border text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${currentServingTokenObj ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {currentServingTokenObj ? 'SERVING NOW' : 'COUNTER AT REST'}
                </span>
              </div>

              <span className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mt-6">
                CURRENT TOKEN
              </span>

              {/* Displays token number or "--" if none serving / marked done */}
              <div className="text-7xl font-black text-white tracking-tight my-2">
                {currentServingTokenObj && currentServingTokenObj.token_number > 0
                  ? `#${currentServingTokenObj.token_number}`
                  : '--'}
              </div>

              {/* Customer Name or "Service Counter at Rest — Ready for Next Guest" */}
              <div className="text-zinc-300 font-medium text-sm mb-6 max-w-xs leading-relaxed">
                {currentServingTokenObj && currentServingTokenObj.token_number > 0
                  ? currentServingTokenObj.customer_name
                  : terms.atRestStatus}
              </div>

              {/* CALL NEXT GUEST Button */}
              <button
                onClick={handleNextToken}
                disabled={actionLoading || allWaitingTokens.length === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{actionLoading ? 'Updating...' : `CALL NEXT ${terms.guestTerm.toUpperCase()}`}</span>
              </button>

              <div className="mt-3 w-full flex gap-2">
                <button
                  onClick={() =>
                    currentServingTokenObj &&
                    handleUpdateStatus(currentServingTokenObj.id, 'COMPLETED')
                  }
                  disabled={!currentServingTokenObj || actionLoading}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-emerald-400 rounded-xl transition border border-zinc-800 cursor-pointer"
                >
                  Mark Done
                </button>

                <button
                  onClick={handleExtendPace}
                  disabled={actionLoading}
                  className="py-3 px-3.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-bold text-amber-400 rounded-xl transition border border-zinc-800 cursor-pointer"
                  title="Add +5 mins extra service duration"
                >
                  ⏱️ +5m
                </button>

                <button
                  onClick={() =>
                    currentServingTokenObj &&
                    handleWaitlist(currentServingTokenObj.id)
                  }
                  disabled={!currentServingTokenObj || actionLoading}
                  className="py-3 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-zinc-400 rounded-xl transition border border-zinc-800 cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Metrics Card */}
            <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-6 grid grid-cols-2 gap-4 shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  IN LINE
                </span>
                <div className="text-3xl font-black text-zinc-900 mt-1">
                  {allWaitingTokens.length}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">waiting {terms.guestTermPlural.toLowerCase()}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  PACE
                </span>
                <div className="text-3xl font-black text-zinc-900 mt-1">
                  ~{paceMins}m
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">per token</div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-7 shadow-sm min-h-[480px] flex flex-col">
              <div className="flex items-center justify-between pb-6">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Waiting List</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                    Manage upcoming {terms.guestTermPlural.toLowerCase()} in real-time.
                  </p>
                </div>

                <span className="bg-zinc-100 text-zinc-600 text-xs font-bold px-3 py-1 rounded-full border border-zinc-200">
                  {allWaitingTokens.length} Pending
                </span>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-medium">
                  Loading list...
                </div>
              ) : displayedWaitingTokens.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-medium">
                  {searchQuery ? `No matching ${terms.guestTermPlural.toLowerCase()} found.` : `No upcoming ${terms.guestTermPlural.toLowerCase()} waiting in line.`}
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {displayedWaitingTokens.map((token) => {
                    const globalIndex = allWaitingTokens.findIndex((t) => t.id === token.id);
                    const spotsAheadCount = (globalIndex >= 0 ? globalIndex : 0) + (currentServingTokenObj ? 1 : 0);
                    const estWaitMins = spotsAheadCount * paceMins;

                    return (
                      <div
                        key={token.id || token.token_number}
                        className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center font-black text-base shadow-sm">
                            #{token.token_number}
                          </div>

                          <div>
                            <p className="font-bold text-zinc-900 text-sm">
                              {token.customer_name || `Anonymous ${terms.guestTerm}`}
                            </p>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <AccessChannelBadge channel={token.access_channel} />
                              <span>•</span>
                              <span>Est. Wait ~{formatWaitTime(estWaitMins)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateStatus(token.id, 'SERVING')}
                            disabled={actionLoading}
                            className="border border-emerald-500/40 text-emerald-600 bg-emerald-50/60 hover:bg-emerald-100/80 text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer"
                          >
                            Call
                          </button>
                          <button
                            onClick={() => handleWaitlist(token.id)}
                            disabled={actionLoading}
                            className="border border-amber-500/40 text-amber-600 bg-amber-50/60 hover:bg-amber-100/80 text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer"
                          >
                            Waitlist
                          </button>
                          {linkedBranches.length > 0 && (
                            <button
                              onClick={() => {
                                setTransferToken(token);
                                setTransferTargetStreamId(linkedBranches[0]?.stream_id || '');
                                setIsTransferModalOpen(true);
                              }}
                              disabled={actionLoading}
                              className="border border-sky-500/40 text-sky-600 bg-sky-50/60 hover:bg-sky-100/80 text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1"
                              title="Transfer patient to another linked branch"
                            >
                              <span>🔄 Transfer</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(token.id, 'CANCELLED')}
                            disabled={actionLoading}
                            className="text-zinc-400 hover:text-red-600 text-xs font-medium px-2 py-1.5 transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* NEW WALK-IN ENTRY MODAL */}
      {isWalkInOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-zinc-900">New Walk-in {terms.guestTerm}</h3>
              <button
                onClick={() => setIsWalkInOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  {terms.guestTerm} Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 234 567 890"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWalkInOpen(false)}
                  className="flex-1 py-3 border border-zinc-200 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition"
                >
                  {actionLoading ? 'Adding...' : `Add ${terms.guestTerm}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUEUE SETTINGS & BROADCAST MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-zinc-900">Queue Settings & Network</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Consultation Pace Tactile NumberSlider */}
              <NumberSlider
                label={terms.paceTerm}
                description="Average time allocated per session"
                value={customPace}
                min={2}
                max={120}
                unit="Min"
                presets={[5, 10, 15, 20, 30, 45]}
                onChange={setCustomPace}
                accentColor="emerald"
              />

              {/* Multi-Branch Clinic Network Manager */}
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🏥</span>
                    <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                      Multi-Branch Clinic Network ({linkedBranches.length})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsLinkModalOpen(true);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                  >
                    + Link Branch
                  </button>
                </div>

                {linkedBranches.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No other clinic branches connected. Connect other clinics (e.g., Mumbai, Navi Mumbai) to seamlessly transfer patients and switch terminals.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedBranches.map((b) => (
                      <div key={b.stream_id} className="bg-white border border-zinc-200 px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-zinc-900 block">{b.business_name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{b.stream_name}</span>
                        </div>
                        <Link
                          href={`/dashboard?streamId=${b.stream_id}`}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg font-bold text-[11px]"
                        >
                          Switch ➔
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Working Hours & Schedule Settings */}
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl space-y-3">
                <p className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                  Fixed Working Hours & Days
                </p>

                <div>
                  <span className="block text-[11px] font-medium text-zinc-500 mb-1.5">Operating Days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const isSelected = editOpDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setEditOpDays((prev) =>
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                            )
                          }
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-zinc-500 border border-zinc-200 hover:text-zinc-900'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={editOpenTime}
                      onChange={(e) => setEditOpenTime(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={editCloseTime}
                      onChange={(e) => setEditCloseTime(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Queue Flow / Structure */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Queue Structure
                </label>
                <select
                  value={editQueueStruct}
                  onChange={(e) => setEditQueueStruct(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="UNIFIED_PARALLEL">⚡ Parallel Unified Queue (Single line, parallel multi-doctor calling)</option>
                  <option value="DEDICATED_STREAMS">🩺 Dedicated Provider Queues (Separate queue per doctor/specialist)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700">
                    ⭐ Google Maps Review / Profile Link
                  </label>
                  <span className="text-[10px] text-emerald-600 font-bold">Optional</span>
                </div>
                <input
                  type="url"
                  placeholder="e.g. https://maps.app.goo.gl/... or https://g.page/r/..."
                  value={editGoogleMapsUrl}
                  onChange={(e) => setEditGoogleMapsUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  After service completion, customers who submit 5-star ratings will be automatically redirected to your Google Maps review page.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  📢 Live Announcement Broadcast (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Running 15 mins behind schedule due to high volume."
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Broadcasts immediately to Dashboard, Customer Passes, Remote Booking, and TV Displays.
                </p>
              </div>

              {/* Subscription & Billing Status Card in Settings */}
              {subscription && (
                <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      💳 Subscription Status: <span className="uppercase text-emerald-700 font-extrabold">{subscription.status}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsRenewModalOpen(true);
                      }}
                      className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      Renew / Pay
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-800 flex justify-between">
                    <span>Anchor Day: Day {subscription.billingAnchorDay}</span>
                    <span>Fee: ₹{subscription.monthlyFee || 999}/mo</span>
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    {subscription.message}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 py-3 border border-zinc-200 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition"
                >
                  {actionLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEWAL CHECKOUT MODAL */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Monthly Renewal Checkout</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Secure payment via Card, UPI, or Net Banking</p>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="text-zinc-500 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>noQ Unlimited Virtual Queue Plan (1 Month)</span>
                <span className="font-bold font-mono text-emerald-400">₹{subscription?.monthlyFee || 999}</span>
              </div>
              <div className="flex justify-between text-zinc-500 text-[11px] border-t border-zinc-800 pt-2">
                <span>Billing Anchor Day</span>
                <span>Day {subscription?.billingAnchorDay || 'X'}</span>
              </div>
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>Next Extended Period</span>
                <span>+30 Days</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRenewSubscription}
              disabled={renewLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {renewLoading ? 'Processing Renewal...' : `Pay ₹${subscription?.monthlyFee || 999} & Activate ↗`}
            </button>
          </div>
        </div>
      )}

      {/* LINK ANOTHER CLINIC / BRANCH MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Link Another Clinic Branch</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Connect two clinics of the same doctor.</p>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-950 space-y-1">
              <span className="font-bold block">📍 Your Current Clinic Stream ID:</span>
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-300 block select-all">
                {streamId}
              </span>
              <span className="text-[10px] text-emerald-800">
                Share this ID with your other branch terminal to connect.
              </span>
            </div>

            <form onSubmit={handleLinkBranch} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Target Branch Stream ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste destination Stream ID (UUID)"
                  value={linkTargetStreamId}
                  onChange={(e) => setLinkTargetStreamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Target Branch Admin PIN *
                </label>
                <input
                  type="password"
                  required
                  maxLength={10}
                  placeholder="Enter target branch PIN (e.g. 123456)"
                  value={linkTargetPasscode}
                  onChange={(e) => setLinkTargetPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {linkLoading ? 'Connecting...' : 'Link Branch ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT TRANSFER MODAL */}
      {isTransferModalOpen && transferToken && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Transfer Patient to Branch</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Move token seamlessly with live pass & SMS update.</p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-2xl text-xs">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Selected Patient</span>
              <p className="font-extrabold text-sm text-zinc-900 mt-0.5">
                Token #{transferToken.token_number} — {transferToken.customer_name || 'Guest'}
              </p>
            </div>

            <form onSubmit={handleTransferPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Select Destination Clinic / Branch *
                </label>
                <select
                  value={transferTargetStreamId}
                  onChange={(e) => setTransferTargetStreamId(e.target.value)}
                  className="w-full px-3.5 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                >
                  {linkedBranches.map((b) => (
                    <option key={b.stream_id} value={b.stream_id}>
                      🏥 {b.business_name} ({b.stream_name})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                ℹ️ The patient will automatically receive a Web Push & SMS notification with their new token pass for the destination clinic.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-200 text-zinc-600 text-xs font-bold rounded-xl hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                >
                  {transferLoading ? 'Transferring...' : 'Transfer Patient ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCESSIBILITY MODAL */}
      {isA11yOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-100 space-y-4 text-zinc-900">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">👓</span>
                <h3 className="text-base font-bold">Accessibility Options</h3>
              </div>
              <button
                onClick={() => setIsA11yOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-2xl cursor-pointer">
                <div>
                  <span className="text-xs font-bold block text-zinc-800">High Contrast Theme</span>
                  <span className="text-[10px] text-zinc-500">Enhanced visual borders & contrast</span>
                </div>
                <input
                  type="checkbox"
                  checked={a11yHighContrast}
                  onChange={(e) => setA11yHighContrast(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-2xl cursor-pointer">
                <div>
                  <span className="text-xs font-bold block text-zinc-800">Large Typography Mode</span>
                  <span className="text-[10px] text-zinc-500">Scale text for improved readability</span>
                </div>
                <input
                  type="checkbox"
                  checked={a11yLargeText}
                  onChange={(e) => setA11yLargeText(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>
            </div>

            <button
              onClick={() => setIsA11yOpen(false)}
              className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 font-medium">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}