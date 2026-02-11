interface AdminBadgeProps {
  variant:
    | 'default'
    | 'live'
    | 'waiting'
    | 'finished'
    | 'cancelled'
    | 'success'
    | 'warning'
    | 'danger'
    | 'admin'
    | 'user';
  children: React.ReactNode;
  pulse?: boolean;
}

const variantStyles: Record<AdminBadgeProps['variant'], string> = {
  default: 'bg-surface-700 text-surface-300',
  live: 'bg-loss-500/10 text-loss-400',
  waiting: 'bg-warning/10 text-warning',
  finished: 'bg-surface-700 text-surface-400',
  cancelled: 'bg-surface-700 text-surface-500',
  success: 'bg-win-500/10 text-win-400',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-loss-500/10 text-loss-400',
  admin: 'bg-primary-500/10 text-primary-400',
  user: 'bg-surface-700 text-surface-400',
};

export function AdminBadge({ variant, children, pulse }: AdminBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded ${variantStyles[variant]}`}
    >
      {pulse && (
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            variant === 'live' ? 'bg-loss-400' : 'bg-current'
          }`}
        />
      )}
      {children}
    </span>
  );
}

// Helper function to get badge variant from fight status
export function getFightStatusVariant(
  status: string
): AdminBadgeProps['variant'] {
  switch (status) {
    case 'LIVE':
      return 'live';
    case 'WAITING':
      return 'waiting';
    case 'FINISHED':
      return 'finished';
    case 'CANCELLED':
    case 'NO_CONTEST':
      return 'cancelled';
    default:
      return 'default';
  }
}

// Helper function to get badge variant from user role
export function getRoleVariant(role: string): AdminBadgeProps['variant'] {
  return role === 'ADMIN' ? 'admin' : 'user';
}
