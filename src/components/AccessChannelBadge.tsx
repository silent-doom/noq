import React from 'react';

interface Props {
  channel?: string;
}

const CHANNEL_CONFIG: Record<string, { label: string; className: string }> = {
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

export function AccessChannelBadge({ channel }: Props) {
  const config = (channel && CHANNEL_CONFIG[channel]) || {
    label: channel || 'N/A',
    className: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.className}`}
    >
      {config.label}
    </span>
  );
}