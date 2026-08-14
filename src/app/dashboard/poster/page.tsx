'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PosterContent() {
  const searchParams = useSearchParams();
  const streamId = searchParams.get('streamId');

  const [venueName, setVenueName] = useState<string>('Business Venue');
  const [streamName, setStreamName] = useState<string>('Main Queue');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!streamId) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const targetUrl = `${appUrl}/book/${streamId}`;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`);

    fetch(`/api/queue/stream/${streamId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stream) {
          setVenueName(data.stream.business_name || 'Business Venue');
          setStreamName(data.stream.stream_name || 'Main Queue');
        }
      })
      .catch((err) => console.error('Poster stream fetch error:', err))
      .finally(() => setLoading(false));
  }, [streamId]);

  return (
    <div className="min-h-screen bg-zinc-900 text-black flex flex-col items-center justify-center p-6 select-none print:bg-white print:p-0">
      
      {/* Print Controls Top Bar (Hidden when printing) */}
      <div className="mb-6 flex items-center gap-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm px-6 py-3 rounded-full shadow-xl shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span>PRINT VENUE POSTER</span>
        </button>

        <button
          onClick={() => window.close()}
          className="bg-zinc-800 text-zinc-400 hover:text-white font-bold text-sm px-5 py-3 rounded-full border border-zinc-700 transition cursor-pointer"
        >
          Close Window
        </button>
      </div>

      {/* Printable Poster Container */}
      <div className="bg-white w-full max-w-[650px] aspect-[1/1.414] rounded-3xl p-12 shadow-2xl border-4 border-black flex flex-col justify-between text-center relative print:shadow-none print:border-none print:w-full print:max-w-none print:h-screen print:rounded-none">
        
        {/* Header */}
        <div className="space-y-3 border-b-4 border-black pb-8">
          <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase">
            NO-WAIT VIRTUAL QUEUE
          </div>
          <h1 className="text-4xl font-black text-black tracking-tight uppercase">
            {venueName}
          </h1>
          <p className="text-base font-bold text-zinc-600 tracking-wide uppercase">
            {streamName}
          </p>
        </div>

        {/* QR Section */}
        <div className="my-auto py-6 flex flex-col items-center">
          <div className="bg-black p-4 rounded-3xl shadow-xl border-4 border-black inline-block">
            {loading ? (
              <div className="w-64 h-64 bg-zinc-100 flex items-center justify-center text-xs font-bold">
                Generating QR...
              </div>
            ) : (
              <img
                src={qrUrl}
                alt="Venue Queue QR Code"
                className="w-64 h-64 rounded-2xl block bg-white"
              />
            )}
          </div>

          <div className="mt-8 space-y-2 max-w-md">
            <h2 className="text-2xl font-black uppercase text-black tracking-tight">
              📱 SCAN TO JOIN VIRTUAL QUEUE
            </h2>
            <p className="text-sm font-semibold text-zinc-600 leading-relaxed">
              Scan with your phone camera to get your digital pass. Track live queue position & receive instant turn alerts!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black pt-6 flex items-center justify-between text-xs font-bold text-zinc-700">
          <span>Zero Hardware • No App Install Required</span>
          <span className="font-mono font-black text-black text-sm">noQ.app</span>
        </div>

      </div>

    </div>
  );
}

export default function PosterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Poster...</div>}>
      <PosterContent />
    </Suspense>
  );
}
