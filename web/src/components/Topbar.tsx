import { LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { NotificationBell } from './NotificationBell';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        height: 60,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="min-w-0">
        <h1 className="text-lg md:text-[22px] font-bold text-slate-100 tracking-[-0.5px] leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] md:text-xs text-slate-400 leading-tight mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-3">
        {actions}
        <NotificationBell />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
