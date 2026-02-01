import { LucideIcon } from 'lucide-react';

interface AdminCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function AdminCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
}: AdminCardProps) {
  const variantStyles = {
    default: 'text-white',
    success: 'text-win-400',
    warning: 'text-warning',
    danger: 'text-loss-400',
  };

  return (
    <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-surface-400">{title}</p>
          <p className={`text-2xl font-semibold mt-1 ${variantStyles[variant]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-surface-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.value >= 0 ? 'text-win-400' : 'text-loss-400'
              }`}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-surface-800 rounded-lg">
            <Icon size={20} className="text-surface-400" />
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminCardSkeletonProps {
  hasIcon?: boolean;
}

export function AdminCardSkeleton({ hasIcon = true }: AdminCardSkeletonProps) {
  return (
    <div className="bg-surface-850 border border-surface-700 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-surface-700 rounded" />
          <div className="h-8 w-32 bg-surface-700 rounded mt-2" />
          <div className="h-3 w-20 bg-surface-700 rounded mt-2" />
        </div>
        {hasIcon && <div className="w-10 h-10 bg-surface-700 rounded-lg" />}
      </div>
    </div>
  );
}
