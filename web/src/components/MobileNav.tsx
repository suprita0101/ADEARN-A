import { Link, useRouterState } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/authStore';
import {
  Home, Wallet, BarChart2, Heart, User,
  PlusCircle, LayoutDashboard, Shield, Users, Megaphone, Clapperboard,
} from 'lucide-react';

type MobileNavItem = {
  label: string;
  icon: React.ElementType;
  to: string;
  search?: Record<string, string>;
};

// A compact, thumb-reachable subset of the sidebar nav for phones.
const MOBILE_NAV: Record<string, MobileNavItem[]> = {
  consumer: [
    { label: 'Home', icon: Home, to: '/feed' },
    { label: 'Wallet', icon: Wallet, to: '/wallet' },
    { label: 'Insights', icon: BarChart2, to: '/insights' },
    { label: 'Impact', icon: Heart, to: '/impact' },
    { label: 'Profile', icon: User, to: '/onboarding' },
  ],
  advertiser: [
    { label: 'Home', icon: LayoutDashboard, to: '/advertiser' },
    { label: 'New Ad', icon: PlusCircle, to: '/advertiser/campaigns/new' },
    { label: 'Analytics', icon: BarChart2, to: '/advertiser/analytics' },
  ],
  admin: [
    { label: 'Overview', icon: LayoutDashboard, to: '/admin', search: { tab: 'financials' } },
    { label: 'Fraud', icon: Shield, to: '/admin', search: { tab: 'fraud' } },
    { label: 'Users', icon: Users, to: '/admin', search: { tab: 'users' } },
    { label: 'Ads', icon: Megaphone, to: '/admin', search: { tab: 'advertisers' } },
    { label: 'Clips', icon: Clapperboard, to: '/admin', search: { tab: 'campaigns' } },
  ],
};

export function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const { location } = useRouterState();
  const items = user ? (MOBILE_NAV[user.role] ?? []) : [];

  if (items.length === 0) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch"
      style={{
        background: 'rgba(10,16,26,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const currentTab = (location.search as { tab?: string }).tab ?? 'financials';
        const isActive = item.search?.tab
          ? location.pathname === item.to && currentTab === item.search.tab
          : location.pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            to={item.to}
            search={item.search}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors duration-150',
              isActive ? 'text-teal-300' : 'text-slate-500',
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
