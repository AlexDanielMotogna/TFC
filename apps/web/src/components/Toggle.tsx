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
  const checkedColor =
    variant === 'win' ? 'bg-win-500' :
    variant === 'loss' ? 'bg-loss-500' :
    'bg-primary-500';

  const isSmall = size === 'sm';

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200
          ${isSmall ? 'w-7 h-3.5' : 'w-9 h-[18px]'}
          ${checked ? checkedColor : 'bg-surface-700'}
          focus:outline-none
        `}
      >
        <span
          className={`
            inline-block rounded-full shadow-sm transition-all duration-200
            ${isSmall ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}
            ${checked ? 'bg-white' : 'bg-surface-400'}
            ${checked
              ? (isSmall ? 'translate-x-[14px]' : 'translate-x-[18px]')
              : 'translate-x-[3px]'
            }
          `}
        />
      </button>
      {label && (
        <span className={`text-xs font-medium ${checked ? 'text-surface-200' : 'text-surface-500'} transition-colors`}>{label}</span>
      )}
    </label>
  );
}
