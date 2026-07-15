import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Coins, Star, Trophy, Heart } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

interface Wallet {
  pool_balances: { savings_balance: number };
}
interface Txn {
  id: string;
  campaign_name: string;
  cashback_amount: number;
  created_at: string;
  status: string;
  reviewed: boolean;
}

type NotifType = 'cashback' | 'review' | 'goal';
interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  at: number;
}

const ICONS: Record<NotifType, React.ReactNode> = {
  cashback: <Coins className="w-4 h-4 text-teal-300" />,
  review: <Star className="w-4 h-4 text-amber-400" />,
  goal: <Trophy className="w-4 h-4 text-emerald-400" />,
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const readKey = `notif_read_${user?.id ?? 'anon'}`;
  const goalKey = `savings_goal_${user?.id ?? 'anon'}`;

  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(readKey) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  const isConsumer = user?.role === 'consumer';

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ['wallet'],
    queryFn: async () => (await api.get('/wallet')).data.data,
    refetchInterval: 10_000,
    enabled: isConsumer,
  });
  const { data: txns = [] } = useQuery<Txn[]>({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get('/wallet/transactions')).data.data ?? [],
    refetchInterval: 10_000,
    enabled: isConsumer,
  });

  const notifs = useMemo<Notif[]>(() => {
    const list: Notif[] = [];
    txns
      .filter((t) => t.status === 'completed')
      .forEach((t) => {
        const at = new Date(t.created_at).getTime();
        list.push({
          id: `cb-${t.id}`,
          type: 'cashback',
          title: `+₹${t.cashback_amount.toFixed(2)} cashback`,
          body: `Credited from ${t.campaign_name}`,
          at,
        });
        if (!t.reviewed) {
          list.push({
            id: `rv-${t.id}`,
            type: 'review',
            title: 'Rate your purchase',
            body: `Tell us about ${t.campaign_name}`,
            at: at - 1,
          });
        }
      });

    const goal = Number(localStorage.getItem(goalKey) ?? 0);
    const savings = wallet?.pool_balances.savings_balance ?? 0;
    if (goal > 0 && savings >= goal) {
      list.push({
        id: `goal-${goal}`,
        type: 'goal',
        title: 'Savings goal reached! 🎉',
        body: `You hit your ₹${goal.toLocaleString('en-IN')} target`,
        at: Date.now(),
      });
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 20);
  }, [txns, wallet, goalKey]);

  const unread = notifs.filter((n) => !readIds.has(n.id)).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPanel = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      const next = new Set(readIds);
      notifs.forEach((n) => next.add(n.id));
      setReadIds(next);
      localStorage.setItem(readKey, JSON.stringify([...next]));
    }
  };

  if (!isConsumer) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-teal-400 text-slate-900 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[14px] overflow-hidden z-50 shadow-2xl"
          style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-semibold text-slate-100">Notifications</span>
            <Bell className="w-4 h-4 text-slate-500" />
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-12 text-center px-6">
                <Heart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No activity yet</p>
                <p className="text-xs text-slate-600 mt-1">Shop from an ad to start earning.</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                    {ICONS[n.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 leading-tight">{n.title}</p>
                    <p className="text-xs text-slate-400 leading-tight mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
