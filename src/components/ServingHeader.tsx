'use client';

interface Token {
  id: string;
  token_number: number;
  customer_name: string;
  status: string;
}

interface ServingHeaderProps {
  servingToken?: Token | null;
}

export function ServingHeader({ servingToken }: ServingHeaderProps) {
  // If no patient is currently being served (or status is not SERVING)
  if (!servingToken || servingToken.status !== 'SERVING') {
    return (
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-6 text-center transition-all">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full mb-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
          Ready for Next Call
        </div>
        <h2 className="text-xl font-bold text-amber-950">Consultation On Standby</h2>
        <p className="text-xs text-amber-700/80 mt-1">
          Click &quot;Call Next Guest&quot; on the dashboard when ready for the next consultation.
        </p>
      </div>
    );
  }

  // Active consultation state
  return (
    <div className="bg-emerald-500 text-white rounded-2xl p-6 shadow-lg shadow-emerald-500/20 transition-all">
      <div className="flex justify-between items-start">
        <div>
          <span className="inline-block px-2.5 py-0.5 bg-emerald-600/60 text-emerald-100 text-[10px] font-bold uppercase tracking-wider rounded-full mb-2">
            ● Now Serving
          </span>
          <h2 className="text-4xl font-black tracking-tight">#{servingToken.token_number}</h2>
          <p className="text-lg font-semibold text-emerald-50 mt-1">{servingToken.customer_name}</p>
        </div>
      </div>
    </div>
  );
}