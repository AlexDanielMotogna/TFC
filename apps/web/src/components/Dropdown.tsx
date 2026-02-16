'use client';

import { useState, useRef, useEffect } from 'react';

export interface DropdownOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string | number = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Alignment of the dropdown menu */
  align?: 'left' | 'right';
  /** Additional className for the trigger button */
  className?: string;
}

export function Dropdown<T extends string | number = string>({
  options,
  value,
  onChange,
  align = 'left',
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs text-surface-300 hover:text-white hover:bg-surface-800 transition-colors ${className ?? ''}`}
      >
        {selected?.label ?? String(value)}
        <svg
          className={`w-3 h-3 text-surface-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 min-w-[72px] bg-surface-850 rounded-lg shadow-xl overflow-hidden z-50 py-1`}
        >
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                value === opt.value
                  ? 'text-white bg-surface-700/50'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <svg className="w-3 h-3 text-surface-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
