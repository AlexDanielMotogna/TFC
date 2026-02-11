'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Swords,
  TrendingUp,
  Trophy,
  Gift,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  HandCoins,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/fights', label: 'Fights', icon: Swords },
  { href: '/admin/trades', label: 'Trades', icon: TrendingUp },
  { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/admin/prize-pool', label: 'Prize Pool', icon: Gift },
  { href: '/admin/referrals/payouts', label: 'Referrals', icon: HandCoins },
  { href: '/admin/beta', label: 'Beta Access', icon: UserCheck },
  { href: '/admin/anti-cheat', label: 'Anti-Cheat', icon: ShieldCheck },
  { href: '/admin/jobs', label: 'Jobs', icon: Activity },
  { href: '/admin/system', label: 'System', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-surface-850 border-r border-surface-700 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-surface-700">
        {!collapsed && (
          <span className="font-semibold text-white text-sm">TFC Admin</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-700">
        <Link
          href="/"
          className={`flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <ChevronLeft size={16} />
          {!collapsed && <span>Back to Site</span>}
        </Link>
      </div>
    </aside>
  );
}
