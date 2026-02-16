'use client';

/**
 * Custom slider matching the leverage slider design from the Trade page.
 * Thin track + filled portion + tick dots + ring-style thumb.
 */

interface SliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  color?: string; // Tailwind color prefix, e.g. 'primary' or 'orange'
  disabled?: boolean;
}

export function Slider({
  min,
  max,
  value,
  onChange,
  step = 1,
  color = 'primary',
  disabled = false,
}: SliderProps) {
  const range = max - min;
  const percent = range > 0 ? ((value - min) / range) * 100 : 0;
  const ticks = [0, 25, 50, 75, 100];

  const colorMap: Record<string, { fill: string; tick: string; thumb: string; glow: string; inner: string }> = {
    primary: {
      fill: 'bg-surface-400',
      tick: 'bg-surface-400',
      thumb: 'bg-surface-400',
      glow: 'shadow-surface-400/30',
      inner: 'bg-surface-300',
    },
    orange: {
      fill: 'bg-orange-500',
      tick: 'bg-orange-400',
      thumb: 'bg-orange-500',
      glow: 'shadow-orange-500/30',
      inner: 'bg-orange-400',
    },
    cyan: {
      fill: 'bg-cyan-500',
      tick: 'bg-cyan-400',
      thumb: 'bg-cyan-500',
      glow: 'shadow-cyan-500/30',
      inner: 'bg-cyan-400',
    },
  };

  const c = colorMap[color] ?? colorMap['primary']!;

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pad = 9;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / (rect.width - pad * 2)));
    const raw = min + pct * range;
    const stepped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  return (
    <div
      className={`relative w-full h-8 flex items-center select-none touch-none ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        handlePointer(e);
      }}
    >
      {/* Track bg */}
      <div className="absolute left-[9px] right-[9px] h-[3px] bg-surface-700 rounded-full" />
      {/* Filled portion */}
      <div
        className={`absolute left-[9px] h-[3px] ${c.fill} rounded-full`}
        style={{ width: `calc(${percent / 100} * (100% - 18px))` }}
      />
      {/* Tick dots */}
      {ticks.map((t) => (
        <div
          key={t}
          className={`absolute w-2 h-2 rounded-full -translate-x-1/2 ${t <= percent ? c.tick : 'bg-surface-600'}`}
          style={{ left: `calc(9px + ${t / 100} * (100% - 18px))` }}
        />
      ))}
      {/* Thumb — ring style */}
      <div
        className={`absolute w-[18px] h-[18px] rounded-full -translate-x-1/2 ${c.thumb} shadow-lg ${c.glow}`}
        style={{ left: `calc(9px + ${percent / 100} * (100% - 18px))` }}
      >
        <div className="absolute inset-[3px] rounded-full bg-surface-900" />
        <div className={`absolute inset-[5px] rounded-full ${c.inner}`} />
      </div>
    </div>
  );
}
