import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Settings,
  PlusCircle, BarChart2, Shield, Users, Megaphone,
  FileText, Heart, SlidersHorizontal, Award, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';

type NavItem = {
  label: string;
  icon: React.ElementType;
  to: string;
  search?: Record<string, string>;
};

const NAV: Record<string, NavItem[]> = {
  consumer: [
    { label: 'Dashboard',    icon: LayoutDashboard, to: '/feed' },
    { label: 'Wallet',       icon: Wallet,          to: '/wallet' },
    { label: 'Insights',     icon: BarChart2,       to: '/insights' },
    { label: 'Rewards',      icon: Award,           to: '/rewards' },
    { label: 'Transactions', icon: ArrowLeftRight,  to: '/transactions' },
    { label: 'Charity Impact', icon: Heart,         to: '/impact' },
    { label: 'Cashback Split', icon: SlidersHorizontal, to: '/pool-settings' },
    { label: 'Settings',     icon: Settings,        to: '/onboarding' },
  ],
  advertiser: [
    { label: 'Dashboard',    icon: LayoutDashboard, to: '/advertiser' },
    { label: 'New Campaign', icon: PlusCircle,      to: '/advertiser/campaigns/new' },
    { label: 'Analytics',    icon: BarChart2,       to: '/advertiser/analytics' },
  ],
  admin: [
    { label: 'Overview',     icon: LayoutDashboard, to: '/admin', search: { tab: 'financials' } },
    { label: 'Fraud Queue',  icon: Shield,          to: '/admin', search: { tab: 'fraud' } },
    { label: 'Users',        icon: Users,           to: '/admin', search: { tab: 'users' } },
    { label: 'Advertisers',  icon: Megaphone,       to: '/admin', search: { tab: 'advertisers' } },
    { label: 'Audit Log',    icon: FileText,        to: '/admin/audit-log' },
  ],
};

export function Sidebar() {
  const { user } = useAuthStore();
  const { location } = useRouterState();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const items = user ? (NAV[user.role] ?? []) : [];

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <aside
      style={{
        width: collapsed ? 68 : 240,
        transition: 'width 0.25s ease',
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
      className="relative hidden md:flex flex-col h-full overflow-hidden"
    >
      {/* Logo row */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 min-h-[60px]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-300 to-teal-600 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="font-bold text-slate-100 text-base tracking-tight whitespace-nowrap">
            AdEarn
          </span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        aria-label="Toggle sidebar"
        className={clsx(
          'absolute top-[18px] right-2.5 w-5 h-5 rounded-full',
          'bg-white/[0.08] border border-white/[0.12]',
          'flex items-center justify-center',
          'text-slate-500 hover:text-teal-300 hover:bg-white/[0.12]',
          'transition-colors duration-150'
        )}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {items.map(item => {
          const currentTab = (location.search as { tab?: string }).tab ?? 'financials';
          const isActive = item.search?.tab
            ? location.pathname === item.to && currentTab === item.search.tab
            : location.pathname === item.to && !item.to.includes('?');
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              search={item.search}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 whitespace-nowrap',
                isActive
                  ? 'bg-teal-300/[0.15] text-teal-300 border border-teal-300/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {user && (
        <div
          className="px-2 pb-4 pt-2 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-600 to-teal-300 flex items-center justify-center text-slate-900 text-xs font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
