'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'default' | 'win' | 'loss';
  label?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'sm',
  variant = 'default',
  label,
}: ToggleProps) {
  const sizes = {
    sm: {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-5',
    },
  };

  const variants = {
    default: {
      checked: 'bg-primary-500',
      glow: 'shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    },
    win: {
      checked: 'bg-win-500',
      glow: 'shadow-[0_0_8px_rgba(34,197,94,0.5)]',
    },
    loss: {
      checked: 'bg-loss-500',
      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    },
  };

  const s = sizes[size];
  const v = variants[variant];

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex items-center rounded-full transition-all duration-200 ease-in-out
          ${s.track}
          ${checked ? `${v.checked} ${v.glow}` : 'bg-surface-700'}
          ${disabled ? '' : 'hover:brightness-110'}
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-1 focus:ring-offset-surface-900
        `}
      >
        <span
          className={`
            inline-block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out
            ${s.thumb}
            ${checked ? s.translate : 'translate-x-0.5'}
          `}
        />
      </button>
      {label && (
        <span className="text-xs font-medium text-surface-400">{label}</span>
      )}
    </label>
  );
}
