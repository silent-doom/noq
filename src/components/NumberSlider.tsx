'use client';

import React from 'react';

interface NumberSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  presets?: number[];
  onChange: (val: number) => void;
  accentColor?: 'emerald' | 'amber' | 'sky' | 'purple';
  description?: string;
}

export function NumberSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  presets,
  onChange,
  accentColor = 'emerald',
  description,
}: NumberSliderProps) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  const colorStyles = {
    emerald: {
      track: 'from-emerald-600 to-teal-400',
      thumb: 'border-emerald-400 focus:ring-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      pillActive: 'bg-emerald-500 text-black shadow-xs font-black',
    },
    amber: {
      track: 'from-amber-600 to-yellow-400',
      thumb: 'border-amber-400 focus:ring-amber-400',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      pillActive: 'bg-amber-500 text-black shadow-xs font-black',
    },
    sky: {
      track: 'from-sky-600 to-cyan-400',
      thumb: 'border-sky-400 focus:ring-sky-400',
      badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      pillActive: 'bg-sky-500 text-white shadow-xs font-black',
    },
    purple: {
      track: 'from-purple-600 to-pink-400',
      thumb: 'border-purple-400 focus:ring-purple-400',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      pillActive: 'bg-purple-500 text-white shadow-xs font-black',
    },
  }[accentColor];

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-4 space-y-3 transition hover:border-zinc-700">
      {/* Header with Title & Live Value Badge */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
            {label}
          </label>
          {description && (
            <span className="text-[11px] text-zinc-500 leading-tight block mt-0.5">
              {description}
            </span>
          )}
        </div>

        <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1 ${colorStyles.badge}`}>
          <span className="text-sm font-black">{value}</span>
          {unit && <span className="text-[10px] uppercase">{unit}</span>}
        </div>
      </div>

      {/* Interactive Slider Track & Steppers */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold text-white transition cursor-pointer shrink-0"
        >
          −
        </button>

        {/* Custom Range Slider */}
        <div className="relative flex-1 flex items-center py-2">
          {/* Background Track */}
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden relative">
            <div
              className={`h-full bg-gradient-to-r ${colorStyles.track} transition-all duration-75`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Actual Input Slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            role="slider"
            aria-label={label}
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {/* Draggable Custom Thumb Overlay */}
          <div
            className={`absolute pointer-events-none w-4 h-4 rounded-full bg-white border-2 ${colorStyles.thumb} shadow-md -ml-2 transition-all duration-75`}
            style={{ left: `${percentage}%` }}
          />
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold text-white transition cursor-pointer shrink-0"
        >
          +
        </button>
      </div>

      {/* Quick Select Preset Pills */}
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-1 shrink-0">
            Presets:
          </span>
          {presets.map((preset) => {
            const isSelected = value === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                  isSelected
                    ? colorStyles.pillActive
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800/80 hover:bg-zinc-850'
                }`}
              >
                {preset} {unit}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
