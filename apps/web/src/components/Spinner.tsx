'use client';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'white';
  className?: string;
}

const sizes = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const variants = {
  primary: 'border-b-2 border-primary-500',
  white: 'border-2 border-white/30 border-t-white',
};

export function Spinner({ size = 'md', variant = 'primary', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full ${sizes[size]} ${variants[variant]} ${className}`}
    />
  );
}
