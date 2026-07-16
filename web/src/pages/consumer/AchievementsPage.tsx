import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard } from '../../components/ui';
import { ScratchCardModal } from '../../components/ScratchCardModal';
import { useAuthStore } from '../../store/authStore';
import { api, getScratchCards } from '../../lib/api';
import type { ScratchCard } from '../../lib/api';
import { Flame, Award, Lock, Sparkles } from 'lucide-react';

interface Wallet {
  pool_balances: { total_earned: number; savings_balance: number };
}
interface Txn {
  id: string;
  cashback_amount: number;
  created_at: string;
  status: string;
  reviewed: boolean;
}

interface Badge {
  key: string;
  emoji: string;
  label: string;
  desc: string;
  earned: boolean;
  progress?: string;
}

// Consecutive-day streak ending on the most recent purchase day.
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const days = new Set(dates);
  const sorted = [...days].sort().reverse();
  let streak = 1;
  let cursor = new Date(sorted[0]);
  for (;;) {
    const prev = new Date(cursor);
    prev.setDate(prev.getDate() - 1);
    const key = prev.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      cursor = prev;
    } else break;
  }
  return streak;
}

export function AchievementsPage() {
  const user = useAuthStore((s) => s.user);
  const [scratching, setScratching] = useState<ScratchCard | null>(null);

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ['wallet'],
    queryFn: async () => (await api.get('/wallet')).data.data,
    refetchInterval: 10_000,
  });

  const { data: cards = [] } = useQuery<ScratchCard[]>({
    queryKey: ['scratch-cards'],
    queryFn: getScratchCards,
    refetchInterval: 10_000,
  });
  const unscratched = cards.filter((c) => !c.scratched).length;
  const { data: txns = [] } = useQuery<Txn[]>({
    queryKey: ['transactions'],
    queryFn: async () => (await api.get('/wallet/transactions')).data.data ?? [],
    refetchInterval: 10_000,
  });

  const { streak, badges, earnedCount } = useMemo(() => {
    const completed = txns.filter((t) => t.status === 'completed');
    const purchaseDays = completed.map((t) => new Date(t.created_at).toISOString().slice(0, 10));
    const streak = computeStreak(purchaseDays);
    const totalEarned = wallet?.pool_balances.total_earned ?? 0;
    const purchases = completed.length;
    const reviews = completed.filter((t) => t.reviewed).length;
    const hasGoal = !!localStorage.getItem(`savings_goal_${user?.id ?? 'anon'}`);

    const badges: Badge[] = [
      { key: 'first', emoji: '🎉', label: 'First Cashback', desc: 'Earn your first reward', earned: totalEarned > 0 },
      { key: 'shopper', emoji: '🛍️', label: 'Getting Started', desc: 'Make 1 purchase', earned: purchases >= 1 },
      { key: 'c100', emoji: '💯', label: '₹100 Club', desc: 'Earn ₹100 total', earned: totalEarned >= 100, progress: totalEarned < 100 ? `₹${totalEarned.toFixed(0)}/100` : undefined },
      { key: 'reviewer', emoji: '⭐', label: 'Reviewer', desc: 'Rate an ad', earned: reviews >= 1 },
      { key: 'regular', emoji: '🔁', label: 'Regular', desc: 'Make 5 purchases', earned: purchases >= 5, progress: purchases < 5 ? `${purchases}/5` : undefined },
      { key: 'saver', emoji: '🏦', label: 'Super Saver', desc: 'Earn ₹500 total', earned: totalEarned >= 500, progress: totalEarned < 500 ? `₹${totalEarned.toFixed(0)}/500` : undefined },
      { key: 'critic', emoji: '🎬', label: 'Top Critic', desc: 'Rate 5 ads', earned: reviews >= 5, progress: reviews < 5 ? `${reviews}/5` : undefined },
      { key: 'goal', emoji: '🎯', label: 'Goal Setter', desc: 'Set a savings goal', earned: hasGoal },
    ];
    return { streak, badges, earnedCount: badges.filter((b) => b.earned).length };
  }, [txns, wallet, user]);

  return (
    <AppLayout title="Rewards" subtitle="Streaks, badges and milestones">
      {/* Streak hero */}
      <GlassCard className="p-6 mb-5 border border-orange-400/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-400/10 border border-orange-400/25 flex items-center justify-center">
            <Flame className="w-7 h-7 text-orange-400" fill={streak > 0 ? '#fb923c' : 'none'} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-100 leading-none">
              {streak} <span className="text-lg font-semibold text-slate-400">day{streak === 1 ? '' : 's'}</span>
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {streak > 0 ? 'Shopping streak — keep it going!' : 'Shop today to start a streak'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Scratch cards */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Scratch Cards</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          {unscratched > 0 ? `${unscratched} to scratch!` : 'shop to earn more'}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {cards.length === 0 ? (
          <div className="col-span-full">
            <GlassCard className="p-6 text-center">
              <p className="text-sm text-slate-400">
                Every purchase earns a scratch card with a surprise bonus. Shop from an ad to get
                your first one! 🪙
              </p>
            </GlassCard>
          </div>
        ) : (
          cards.map((c) =>
            c.scratched ? (
              <div
                key={c.transaction_id}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xl">{(c.reward_amount ?? 0) > 0 ? '🎉' : '😅'}</span>
                <p className={`text-sm font-bold ${(c.reward_amount ?? 0) > 0 ? 'text-teal-300' : 'text-slate-500'}`}>
                  {(c.reward_amount ?? 0) > 0 ? `₹${c.reward_amount}` : '—'}
                </p>
              </div>
            ) : (
              <button
                key={c.transaction_id}
                onClick={() => setScratching(c)}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-2 transition-transform hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #2dd4bf, #0d9488 60%, #115e59)',
                  border: '1px solid rgba(94,234,212,0.5)',
                  boxShadow: '0 4px 18px rgba(45,212,191,0.25)',
                }}
              >
                <span className="text-2xl">🪙</span>
                <p className="text-[11px] font-bold text-slate-900">Scratch me!</p>
              </button>
            ),
          )
        )}
      </div>

      {/* Badge progress */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Badges</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Award className="w-3.5 h-3.5 text-teal-300" /> {earnedCount}/{badges.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {badges.map((b) => (
          <div
            key={b.key}
            className="p-4 rounded-[14px] text-center relative"
            style={{
              background: b.earned ? 'rgba(94,234,212,0.06)' : 'rgba(255,255,255,0.03)',
              border: b.earned ? '1px solid rgba(94,234,212,0.22)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {!b.earned && (
              <Lock className="w-3.5 h-3.5 text-slate-600 absolute top-2.5 right-2.5" />
            )}
            <div className={`text-3xl mb-2 ${b.earned ? '' : 'grayscale opacity-40'}`}>{b.emoji}</div>
            <p className={`text-xs font-semibold ${b.earned ? 'text-slate-100' : 'text-slate-500'}`}>{b.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{b.desc}</p>
            {b.progress && <p className="text-[10px] text-teal-300 mt-1 font-medium">{b.progress}</p>}
          </div>
        ))}
      </div>

      {scratching && (
        <ScratchCardModal
          transactionId={scratching.transaction_id}
          campaignName={scratching.campaign_name}
          onClose={() => setScratching(null)}
        />
      )}
    </AppLayout>
  );
}
