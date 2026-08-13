'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function QRScanPage({ params }: { params: { streamId: string } }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Synchronous guard against rapid double-taps
  const isSubmittingRef = useRef(false);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission if form invalid, loading, or already submitting
    if (!name.trim() || isSubmittingRef.current || loading) return;

    // Lock immediately on first tap
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/token/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId: params.streamId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          accessChannel: 'PHYSICAL_QR',
        }),
      });

      const json = await res.json();
      
      if (res.ok && json.data?.id) {
        setIsSuccess(true);
        // Navigate to pass — keep loading/success state locked during redirect
        router.push(`/t/${json.data.id}`);
      } else {
        alert(json.error || 'Failed to issue token. Please try again.');
        // Reset guard on server error
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
      // Reset guard on network error
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-zinc-950 p-6 text-white border-b border-zinc-800">
          <div className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
            <QrCode className="w-3.5 h-3.5" /> On-Site Check-In
          </div>
          <h1 className="text-2xl font-black tracking-tight">Join the Queue</h1>
          <p className="text-zinc-400 text-xs mt-1">Get an instant digital token without standing in line.</p>
        </div>

        {/* Success Acknowledgement Card */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900">Pass Generated!</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Redirecting you to your live tracking card...
            </p>
            <div className="pt-4">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleJoinQueue} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                Your Name *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-900 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                Mobile Number (Optional for updates)
              </label>
              <input
                type="tel"
                disabled={loading}
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-zinc-900 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl text-sm tracking-wide shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>ISSUING YOUR PASS...</span>
                </>
              ) : (
                <>
                  <span>GET DIGITAL PASS</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}