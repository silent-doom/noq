'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Ably from 'ably';
import { AccessChannelBadge } from '@/components/AccessChannelBadge';
import { NumberSlider } from '@/components/NumberSlider';
import { getDomainTerminology, formatWaitTime, generateDomainStations } from '@/lib/domain';
import { openRazorpayCheckout } from '@/lib/razorpayClient';
import { playChimeAndAnnounce, VoiceLanguage } from '@/lib/audioAnnouncement';

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
  admin_passcode?: string;
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

  // Mobile sidebar toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

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
  const [showTrialModal, setShowTrialModal] = useState<boolean>(false);

  // Emergency STAT Clinical Call State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [emergencyStation, setEmergencyStation] = useState<string>('Doctor Room 1');
  const [emergencyPatient, setEmergencyPatient] = useState<string>('Emergency Patient');
  const [emergencyLoading, setEmergencyLoading] = useState<boolean>(false);
  const [emergencySuccess, setEmergencySuccess] = useState<string | null>(null);

  // TTS & Chime Announcement Toggle & Regional Voice Settings
  const [ttsVoiceEnabled, setTtsVoiceEnabled] = useState<boolean>(true);
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>('hi');
  const [activeCounter, setActiveCounter] = useState<string>('Counter 1');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('noq_voice_lang') as VoiceLanguage;
      if (saved) setVoiceLang(saved);
    }
  }, []);

  const handleSetVoiceLang = (lang: VoiceLanguage) => {
    setVoiceLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('noq_voice_lang', lang);
    }
  };

  // Inactivity Auto-Lock (15m idle privacy shield)
  const [isLockedByInactivity, setIsLockedByInactivity] = useState<boolean>(false);
  const [inactivityPin, setInactivityPin] = useState<string>('');
  const [inactivityError, setInactivityError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutes = 15 * 60 * 1000
      timeoutId = setTimeout(() => {
        setIsLockedByInactivity(true);
      }, 15 * 60 * 1000);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isAuthenticated]);

  const handleUnlockInactivity = (e: React.FormEvent) => {
    e.preventDefault();
    setInactivityError(null);
    const expected = streamInfo?.admin_passcode || '123456';
    if (inactivityPin.trim() === expected.trim()) {
      setIsLockedByInactivity(false);
      setInactivityPin('');
    } else {
      setInactivityError('Incorrect PIN. Please re-enter.');
    }
  };

  const handleTriggerEmergency = async () => {
    if (!streamId) return;
    setEmergencyLoading(true);
    setEmergencySuccess(null);
    try {
      const res = await fetch(`/api/queue/stream/${streamId}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationName:
            emergencyStation ||
            (Array.isArray(streamInfo?.stations) && streamInfo.stations[0]
              ? streamInfo.stations[0]
              : 'Doctor Room 1'),
          patientName: emergencyPatient || 'Emergency Patient',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEmergencySuccess(`🚨 STAT Emergency alert broadcasted for ${emergencyStation}!`);
        setTimeout(() => {
          setIsEmergencyModalOpen(false);
          setEmergencySuccess(null);
        }, 2200);
      }
    } catch (err) {
      console.error('Failed to trigger emergency call:', err);
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Daily Trial Warning Modal auto-popup (once per day per session)
  useEffect(() => {
    if (subscription?.isTrial && !subscription?.isLocked && streamId) {
      const day = subscription?.trialDay || 1;
      const dismissed = sessionStorage.getItem(`noq_dismissed_trial_day_${day}_${streamId}`);
      if (!dismissed) {
        setShowTrialModal(true);
      }
    }
  }, [subscription, streamId]);

  const handleDismissTrialModal = () => {
    if (streamId) {
      const day = subscription?.trialDay || 1;
      sessionStorage.setItem(`noq_dismissed_trial_day_${day}_${streamId}`, 'true');
    }
    setShowTrialModal(false);
  };

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

  // 1. Dynamic Stream Resolution (Zero Stream ID entry for doctors)
  useEffect(() => {
    if (urlStreamId) {
      setStreamId(urlStreamId);
      return;
    }

    // Try to resolve from saved operator login session
    const stored = localStorage.getItem('noq_business_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.streamId) {
          setStreamId(parsed.streamId);
          window.history.replaceState({}, '', `/dashboard?streamId=${parsed.streamId}`);
          return;
        }
      } catch {}
    }

    // If no stream specified and no saved session, smoothly direct doctor to login
    window.location.href = '/login';
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
      await openRazorpayCheckout({
        streamId,
        amount: subscription?.monthlyFee || 999,
        paymentType: 'MONTHLY_RENEWAL',
        onSuccess: async () => {
          setRenewLoading(false);
          setIsRenewModalOpen(false);
          alert('✅ Subscription renewed successfully! Your terminal is active.');
          await fetchQueueData();
        },
        onDismiss: () => {
          setRenewLoading(false);
        },
        onError: (err) => {
          setRenewLoading(false);
          alert(err?.message || 'Payment was cancelled or failed.');
        },
      });
    } catch (err: any) {
      setRenewLoading(false);
      alert(err?.message || 'Error launching payment checkout.');
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

  // 3. Real-time updates via Ably Pub/Sub & 10s fallback polling with tab visibility guard
  useEffect(() => {
    if (!streamId) return;

    fetchQueueData();
    // Trigger daily queue reset check once on mount
    fetch(`/api/queue/stream/${streamId}/reset`, { method: 'POST' }).catch(() => {});

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchQueueData();
    }, 10000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchQueueData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [streamId, fetchQueueData]);

  useEffect(() => {
    if (!streamId) return;

    const key = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY || process.env.ABLY_API_KEY;
    if (!key) return;

    let ably: any = null;
    try {
      ably = new Ably.Realtime({ key });
      const channel = ably.channels.get(`queue:${streamId}`);

      const onRealtimeEvent = (msg?: any) => {
        fetchQueueData();
        if (msg?.name === 'TOKEN_CALLED' && msg?.data?.serving_token && ttsVoiceEnabled) {
          const st = msg.data.serving_token;
          const counter = st.assigned_station || st.counter_name || activeCounter || 'Counter 1';
          playChimeAndAnnounce(st.token_number, counter, { language: voiceLang });
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
      console.error('Ably client connection error in Dashboard:', err);
    }
  }, [streamId, fetchQueueData, ttsVoiceEnabled, voiceLang, activeCounter]);

  // 4. Update Token Status Action
  const handleUpdateStatus = async (
    tokenId: string,
    status: 'COMPLETED' | 'CANCELLED' | 'SERVING'
  ) => {
    setActionLoading(true);
    try {
      const targetToken = tokens.find((t) => t.id === tokenId);
      await fetch(`/api/token/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, assigned_station: activeCounter }),
      });
      if (status === 'SERVING' && targetToken && ttsVoiceEnabled) {
        playChimeAndAnnounce(targetToken.token_number, activeCounter, { language: voiceLang });
      }
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

      const data = await res.json();
      if (data.success && data.serving_token && ttsVoiceEnabled) {
        playChimeAndAnnounce(data.serving_token.token_number, activeCounter, { language: voiceLang });
      }

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
          if (ttsVoiceEnabled) {
            playChimeAndAnnounce(nextWaiting.token_number, activeCounter, { language: voiceLang });
          }
        }
      }

      await fetchQueueData();
    } catch (err) {
      console.error('Failed to call next token:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecallToken = () => {
    if (!currentServingTokenObj) return;
    if (ttsVoiceEnabled) {
      playChimeAndAnnounce(currentServingTokenObj.token_number, activeCounter, { language: voiceLang });
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
      {/* Mobile sidebar overlay backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Dark Left Sidebar — hidden on mobile, slide-in on toggle */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-black text-zinc-400 flex flex-col justify-between p-5 shrink-0 transition-transform duration-300 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2.5 mb-8 px-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white tracking-tight">noQ</span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono font-medium px-2 py-0.5 rounded tracking-wide">
                OPERATOR
              </span>
            </div>
            {/* Close button on mobile */}
            <button
              className="lg:hidden text-zinc-400 hover:text-white"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

        {/* Action Button: Emergency STAT Call */}
        <button
          onClick={() => setIsEmergencyModalOpen(true)}
          className="w-full mt-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-red-100 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          <span className="text-sm animate-pulse">🚨</span>
          <span>STAT Emergency Call</span>
        </button>
      </aside>

      {/* Main Screen Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-4 sm:px-8 py-3 flex items-center justify-between border-b border-zinc-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-10 gap-2">
          {/* Left: Hamburger (mobile) + Business Name */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 shrink-0"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-base sm:text-xl font-bold text-zinc-900 truncate max-w-[150px] sm:max-w-none">
              {streamInfo?.business_name || 'Business Venue'}
            </h1>
            <span className="hidden sm:inline text-xs bg-zinc-100 text-zinc-600 font-semibold px-3 py-1 rounded-full border border-zinc-200 shrink-0">
              {streamInfo?.stream_name || terms.queueTitle}
            </span>

            {/* Linked Branch Switcher — desktop only */}
            <div className="hidden lg:block">
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
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Station selector — visible on all sizes but compact */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-full px-2.5 py-1 text-xs text-white">
              <span className="hidden sm:inline text-[10px] font-bold text-zinc-400 uppercase tracking-wider">STN:</span>
              <select
                value={activeCounter}
                onChange={(e) => setActiveCounter(e.target.value)}
                className="bg-transparent font-bold text-emerald-400 focus:outline-none cursor-pointer max-w-[90px] sm:max-w-none text-[11px]"
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

            {/* Search — hidden on mobile, shown on sm+ */}
            <div className="relative hidden sm:block">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={`Search ${terms.guestTerm.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 pl-9 pr-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition shadow-xs"
              />
            </div>

            {/* A11y — desktop only */}
            <button
              onClick={() => setIsA11yOpen(true)}
              className="hidden lg:flex px-2.5 py-1.5 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition cursor-pointer items-center gap-1"
              title="Accessibility Settings"
              aria-label="Accessibility Options"
            >
              <span>👓 A11y</span>
            </button>

            {/* Lock / Unlock Status */}
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
              className={`hidden sm:flex px-2.5 py-1.5 rounded-full text-xs font-bold items-center gap-1.5 transition ${
                isAuthenticated
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span>{isAuthenticated ? '🔒 Unlocked' : '🔑 Locked'}</span>
            </button>

            {/* STAT Emergency Quick Button */}
            <button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="h-9 px-3 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 flex items-center gap-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
              title="Trigger Emergency STAT Call"
            >
              <span className="text-sm animate-pulse">🚨</span>
              <span className="hidden sm:inline">Emergency STAT</span>
            </button>

            {/* Audio Chime & TTS Toggle */}
            <button
              onClick={() => {
                const nextVal = !ttsVoiceEnabled;
                setTtsVoiceEnabled(nextVal);
                if (nextVal && currentServingTokenObj) {
                  playChimeAndAnnounce(currentServingTokenObj.token_number, activeCounter);
                }
              }}
              className={`h-9 px-2.5 sm:px-3 rounded-full border text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                ttsVoiceEnabled
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200'
              }`}
              title={ttsVoiceEnabled ? 'Audio Chime & TTS Voice Active (Click to mute)' : 'Audio Muted (Click to enable)'}
            >
              <span>{ttsVoiceEnabled ? '🔊' : '🔇'}</span>
              <span className="hidden md:inline">{ttsVoiceEnabled ? 'Voice ON' : 'Mute'}</span>
            </button>

            {/* Settings Gear */}
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

            {/* New Walk-in — shown on mobile as quick action */}
            <button
              onClick={() => setIsWalkInOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition cursor-pointer"
              title={`Add Walk-in ${terms.guestTerm}`}
              aria-label="Add Walk-in"
            >
              +
            </button>
          </div>
        </header>

        {/* DAILY TRIAL WARNING MODAL (Appears on Day 1, 2, and 3) */}
        {showTrialModal && subscription?.isTrial && !subscription?.isLocked && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-emerald-500/40 rounded-3xl max-w-md w-full p-7 text-center text-white shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                {subscription.trialDay === 1 ? '🎉' : subscription.trialDay === 2 ? '⏳' : '⚠️'}
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/60 inline-block mb-2">
                  {subscription.trialDay === 1 ? 'Day 1 of 3 — Welcome' : subscription.trialDay === 2 ? 'Day 2 of 3 — 1 Day Left' : 'Day 3 of 3 — Final Day'}
                </span>
                <h3 className="text-xl font-black tracking-tight text-white">
                  {subscription.trialDay === 1
                    ? 'Your 3-Day Free Trial is Active'
                    : subscription.trialDay === 2
                    ? '1 Day Remaining on Free Trial'
                    : 'Final Day of Free Trial!'}
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  {subscription.trialDay === 1
                    ? 'Explore full virtual queue capabilities with zero limits. Set up consultation rooms, test customer live passes, and try parallel calling. Activate anytime to ensure permanent continuity.'
                    : subscription.trialDay === 2
                    ? 'Your virtual queue is live and operational. Tomorrow is your final trial day. Activate your subscription today to ensure uninterrupted queue tracking for your visitors.'
                    : 'Your free trial ends tonight at midnight. After today, an unpaid terminal enters a 3-day grace period before being deactivated. Settle your plan now to keep your live queue, links, and posters permanently active.'}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl text-left space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Trial Progress</span>
                  <span className="font-bold text-emerald-400 font-mono">Day {subscription.trialDay || 1} of 3</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Setup + 1st Month Plan</span>
                  <span className="font-bold text-white font-mono">₹1,499</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Ongoing Monthly Renewal</span>
                  <span className="font-bold text-zinc-300 font-mono">₹499 / mo</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    setShowTrialModal(false);
                    setIsRenewModalOpen(true);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Activate 1st Month Plan (₹1,499) ↗
                </button>
                <button
                  onClick={handleDismissTrialModal}
                  className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer"
                >
                  Continue Exploring Trial →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FREE TRIAL TOP BANNER */}
        {subscription?.isTrial && !subscription?.isLocked && (
          <div className="mx-4 sm:mx-8 mt-4 p-3 sm:p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-950 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌟</span>
              <div>
                <span className="font-extrabold text-emerald-900">3-Day Free Trial (Day {subscription.trialDay || 1} of 3): </span>
                <span className="text-emerald-700">{subscription.message}</span>
              </div>
            </div>
            <button
              onClick={() => setIsRenewModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-2xs shrink-0"
            >
              Activate 1st Month Plan (₹1,499) ↗
            </button>
          </div>
        )}

        {/* GRACE PERIOD SUBSCRIPTION WARNING BANNER */}
        {subscription?.isGracePeriod && !subscription?.isLocked && !subscription?.isTrial && (
          <div className="mx-4 sm:mx-8 mt-4 p-3 sm:p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <div>
                <span className="font-extrabold text-amber-950">Post-Trial Grace Period: </span>
                <span className="text-amber-800">{subscription.message}</span>
              </div>
            </div>
            <button
              onClick={() => setIsRenewModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-2xs shrink-0"
            >
              Settle Plan (₹{subscription.monthlyFee || 499}) ↗
            </button>
          </div>
        )}

        {/* SUBSCRIPTION OVERDUE OR DEACTIVATED LOCK OVERLAY */}
        {(subscription?.isLocked || subscription?.isDeactivated) && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-red-900/60 rounded-3xl max-w-md w-full p-8 text-center text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-red-950/80 border border-red-800 text-red-400 rounded-3xl flex items-center justify-center mx-auto text-3xl font-black">
                {subscription?.isDeactivated ? '🛑' : '🔒'}
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">
                  {subscription?.isDeactivated ? 'Business Terminal Deactivated' : 'Terminal Temporarily Locked'}
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  {subscription?.isDeactivated
                    ? 'Payment is overdue beyond the 3-day grace period. In accordance with our soft-delete policy, all your tokens, stream history, and venue QR links are safely preserved in our database. Settle your subscription fee to immediately reactivate this terminal.'
                    : subscription?.message || 'Your subscription payment is overdue. Please renew to continue calling tokens.'}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subscription Plan Fee</span>
                  <span className="font-bold text-white font-mono">₹{subscription.monthlyFee || 499}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Billing Anchor Day</span>
                  <span className="font-bold text-white font-mono">Day {subscription.billingAnchorDay || 'X'}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Account Status</span>
                  <span className="font-bold text-red-400 font-mono">
                    {subscription?.isDeactivated ? 'DEACTIVATED (DATA PRESERVED)' : `${subscription.daysOverdue || 4} Days Overdue`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsRenewModalOpen(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {subscription?.isDeactivated
                  ? `Reactivate Terminal & Restore Queue Now (₹${subscription.monthlyFee || 499}) ↗`
                  : `Renew Subscription & Unlock Now (₹${subscription.monthlyFee || 499}) ↗`}
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

        {/* INACTIVITY PRIVACY AUTO-LOCK SHIELD */}
        {isLockedByInactivity && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full text-center text-white shadow-2xl space-y-4">
              <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                🛡️
              </div>
              <div>
                <h3 className="text-lg font-bold">Terminal Inactivity Shield</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Terminal automatically obscured for patient privacy. Re-enter 6-digit PIN to resume session.
                </p>
              </div>
              <form onSubmit={handleUnlockInactivity} className="space-y-3">
                <input
                  type="password"
                  required
                  maxLength={10}
                  placeholder="Enter 6-Digit PIN"
                  value={inactivityPin}
                  onChange={(e) => setInactivityPin(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-3 text-center text-sm font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
                />
                {inactivityError && <p className="text-xs text-red-400 font-semibold">{inactivityError}</p>}
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Unlock Terminal 🔓
                </button>
              </form>
            </div>
          </div>
        )}

        {/* EMERGENCY STAT MODAL */}
        {isEmergencyModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-zinc-950 border border-red-500/50 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl animate-bounce">🚨</span>
                  <div>
                    <h3 className="text-base font-black text-white">STAT Clinical Emergency Call</h3>
                    <p className="text-[11px] text-zinc-400">Broadcasts instant priority alert to Lounge TV and audio TTS</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEmergencyModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {emergencySuccess ? (
                <div className="p-4 bg-emerald-950/60 border border-emerald-800/60 rounded-2xl text-emerald-300 text-xs font-medium text-center space-y-2 animate-in zoom-in">
                  <span className="text-2xl block">✅</span>
                  <p>{emergencySuccess}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Target Station / Room
                    </label>
                    <select
                      value={emergencyStation}
                      onChange={(e) => setEmergencyStation(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                    >
                      {Array.isArray(streamInfo?.stations) && streamInfo.stations.length > 0 ? (
                        streamInfo.stations.map((stName: string) => (
                          <option key={stName} value={stName}>
                            {stName}
                          </option>
                        ))
                      ) : (
                        generateDomainStations(streamInfo?.category).map((stName: string) => (
                          <option key={stName} value={stName}>
                            {stName}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Clinical Note / Patient Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acute Trauma / Chest Pain"
                      value={emergencyPatient}
                      onChange={(e) => setEmergencyPatient(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button
                    onClick={handleTriggerEmergency}
                    disabled={emergencyLoading}
                    className="w-full mt-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                  >
                    {emergencyLoading ? 'Broadcasting STAT...' : '🚨 Broadcast Emergency Call Now'}
                  </button>
                </div>
              )}
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
          <div className="mx-4 sm:mx-8 mt-6 bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📥</span>
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                Pending Reschedule Requests ({safeTokens.filter((t) => t?.reschedule_status === 'PENDING').length})
              </h3>
            </div>
            <div className="space-y-2.5">
              {safeTokens
                .filter((t) => t?.reschedule_status === 'PENDING')
                .map((req) => (
                  <div key={req.id} className="bg-white border border-amber-200 p-3 sm:p-4 rounded-2xl shadow-xs">
                    {/* Info row */}
                    <div className="mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-zinc-900">
                          {req.customer_name || 'Guest'}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                          Token #{req.token_number}
                        </span>
                        {req.customer_phone && (
                          <span className="text-xs font-mono text-zinc-500">
                            ({req.customer_phone})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-700 font-semibold mt-1.5">
                        📅 <span className="text-zinc-500">Requested:</span>{' '}
                        <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {req.reschedule_requested_date} at {req.reschedule_requested_slot}
                        </strong>
                      </p>
                    </div>
                    {/* Action buttons — full width on mobile, inline on desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        onClick={() => handleApproveReschedule(req.id, 'APPROVE')}
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1"
                      >
                        ✓ Approve & Issue Token
                      </button>
                      <button
                        onClick={() => {
                          const note = prompt('Optional note to user (e.g. "Slot unavailable. Please pick a slot between 2 PM - 5 PM"):');
                          if (note !== null) {
                            handleApproveReschedule(req.id, 'REJECT', note);
                          }
                        }}
                        className="flex-1 sm:flex-none bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        💬 Reconsider / Reject
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Layout Grid */}
        <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 max-w-7xl w-full">

          {/* ─── LEFT COLUMN: Control Panel ─── */}
          <div className="lg:col-span-5 space-y-4">

            {/* Current Token Card — centred on all screen sizes */}
            <div className="bg-black text-white rounded-[2rem] p-6 sm:p-7 flex flex-col items-center text-center shadow-xl">
              <div className="w-full flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 ${currentServingTokenObj ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'} border text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${currentServingTokenObj ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {currentServingTokenObj ? 'SERVING NOW' : 'COUNTER AT REST'}
                </span>
              </div>

              <span className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase mt-6">
                CURRENT TOKEN
              </span>

              <div className="text-6xl sm:text-7xl font-black text-white tracking-tight my-2">
                {currentServingTokenObj && currentServingTokenObj.token_number > 0
                  ? `#${currentServingTokenObj.token_number}`
                  : '--'}
              </div>

              <div className="text-zinc-300 font-medium text-sm mb-6 max-w-xs leading-relaxed">
                {currentServingTokenObj && currentServingTokenObj.token_number > 0
                  ? currentServingTokenObj.customer_name
                  : terms.atRestStatus}
              </div>

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
                  onClick={() => currentServingTokenObj && handleUpdateStatus(currentServingTokenObj.id, 'COMPLETED')}
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
                  onClick={() => currentServingTokenObj && handleWaitlist(currentServingTokenObj.id)}
                  disabled={!currentServingTokenObj || actionLoading}
                  className="py-3 px-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-zinc-400 rounded-xl transition border border-zinc-800 cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={handleRecallToken}
                  disabled={!currentServingTokenObj || actionLoading}
                  className="py-3 px-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-xs font-bold text-sky-400 rounded-xl transition border border-zinc-800 cursor-pointer flex items-center justify-center gap-1"
                  title="Play audio chime and repeat voice announcement"
                >
                  <span>🔊</span>
                  <span className="hidden sm:inline">Recall</span>
                </button>
              </div>
            </div>

            {/* Metrics Card */}
            <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-5 lg:p-6 grid grid-cols-3 lg:grid-cols-2 gap-3 lg:gap-4 shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">IN LINE</span>
                <div className="text-2xl lg:text-3xl font-black text-zinc-900 mt-1">{allWaitingTokens.length}</div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">waiting {terms.guestTermPlural.toLowerCase()}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">PACE</span>
                <div className="text-2xl lg:text-3xl font-black text-zinc-900 mt-1">~{paceMins}m</div>
                <div className="text-xs text-zinc-400 mt-0.5 font-medium">per token</div>
              </div>
              {/* Station — only on mobile since desktop has it in the header */}
              <div className="lg:hidden">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">STATION</span>
                <div className="text-xs font-bold text-emerald-600 mt-1 leading-tight truncate">{activeCounter}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5 font-medium">active</div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Waiting List ─── */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-4 lg:p-7 shadow-sm min-h-[300px] lg:min-h-[480px] flex flex-col">

              {/* Header — desktop: original no-divider style; mobile: with inline search */}
              <div className="flex items-center justify-between lg:pb-6 pb-4 lg:border-b-0 border-b border-zinc-100">
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-zinc-900">Waiting List</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 font-medium hidden lg:block">
                    Manage upcoming {terms.guestTermPlural.toLowerCase()} in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Inline search — mobile only */}
                  <div className="relative lg:hidden">
                    <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-28 pl-7 pr-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-full text-[11px] text-zinc-800 placeholder-zinc-400 focus:outline-none"
                    />
                  </div>
                  <span className="bg-zinc-100 text-zinc-600 text-xs font-bold px-3 py-1 rounded-full border border-zinc-200 shrink-0">
                    {allWaitingTokens.length} Pending
                  </span>
                </div>
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
                      <div key={token.id || token.token_number}>

                        {/* DESKTOP: original single-row layout */}
                        <div className="hidden lg:flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition">
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

                        {/* MOBILE: stacked two-row layout */}
                        <div className="lg:hidden p-3 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition">
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                              #{token.token_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-zinc-900 text-sm truncate">
                                {token.customer_name || `Anonymous ${terms.guestTerm}`}
                              </p>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <AccessChannelBadge channel={token.access_channel} />
                                <span>•</span>
                                <span>~{formatWaitTime(estWaitMins)} wait</span>
                              </div>
                            </div>
                          </div>
                          {/* Action buttons: wrap so they never overflow on small screens */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateStatus(token.id, 'SERVING')}
                              disabled={actionLoading}
                              className="flex-1 min-w-[70px] border border-emerald-500/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold px-2 py-1.5 rounded-xl transition cursor-pointer text-center"
                            >
                              📣 Call
                            </button>
                            <button
                              onClick={() => handleWaitlist(token.id)}
                              disabled={actionLoading}
                              className="flex-1 min-w-[70px] border border-amber-500/40 text-amber-700 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold px-2 py-1.5 rounded-xl transition cursor-pointer text-center"
                            >
                              ⏭ Skip
                            </button>
                            {linkedBranches.length > 0 && (
                              <button
                                onClick={() => {
                                  setTransferToken(token);
                                  setTransferTargetStreamId(linkedBranches[0]?.stream_id || '');
                                  setIsTransferModalOpen(true);
                                }}
                                disabled={actionLoading}
                                className="border border-sky-500/40 text-sky-700 bg-sky-50 hover:bg-sky-100 text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                              >
                                🔄
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateStatus(token.id, 'CANCELLED')}
                              disabled={actionLoading}
                              className="text-zinc-400 hover:text-red-500 text-[11px] font-medium px-2 py-1.5 transition cursor-pointer shrink-0"
                            >
                              ✕
                            </button>
                          </div>
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
              <h3 className="text-lg font-bold text-zinc-900">Queue Settings</h3>
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

              {/* Voice Announcement Language Settings */}
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    🔊 Regional Voice Announcement Engine
                  </p>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    🌸 Female Natural Voice
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetVoiceLang('hi')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center cursor-pointer ${
                      voiceLang === 'hi'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    🇮🇳 हिन्दी (Hindi)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetVoiceLang('bilingual')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center cursor-pointer ${
                      voiceLang === 'bilingual'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    🌐 Bilingual (EN+HI)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetVoiceLang('en')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center cursor-pointer ${
                      voiceLang === 'en'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Plays dual-tone chime followed by natural female speech synthesis calling out the token number and station.
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
                    <span>Fee: ₹{subscription.monthlyFee || 499}/mo</span>
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

      {/* RENEWAL / PLAN ACTIVATION CHECKOUT MODAL */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {subscription?.isTrial ? 'Activate Full Plan' : 'Monthly Subscription Renewal'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Secure payment via UPI, Cards, or Net Banking</p>
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
                <span>
                  {subscription?.isTrial
                    ? 'Setup + 1st Month Plan (Unlimited Queues)'
                    : 'noQ Unlimited Virtual Queue Plan (1 Month)'}
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  ₹{subscription?.isTrial ? 1499 : (subscription?.monthlyFee || 499)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500 text-[11px] border-t border-zinc-800 pt-2">
                <span>Billing Anchor Day</span>
                <span>Day {subscription?.billingAnchorDay || 'X'}</span>
              </div>
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>Extended Period</span>
                <span>+30 Days</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRenewSubscription}
              disabled={renewLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {renewLoading
                ? 'Processing Payment...'
                : `Pay ₹${subscription?.isTrial ? 1499 : (subscription?.monthlyFee || 499)} & Activate ↗`}
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