import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard, Button } from '../../components/ui';
import { api } from '../../lib/api';
import { CheckCircle2, RotateCcw } from 'lucide-react';

type Pools = { liquid: number; savings: number; parent: number; charity: number };

interface PoolConfig {
  liquid_pct: number;
  savings_pct: number;
  parent_pct: number;
  charity_pct: number;
  balances: {
    liquid: number;
    savings: number;
    parent_pending: number;
    charity_pending: number;
    total_earned: number;
  };
}

const POOL_META = [
  { key: 'liquid' as const, label: 'Liquid', desc: 'Spendable / withdrawable', color: 'text-teal-300', bar: 'bg-teal-300' },
  { key: 'savings' as const, label: 'Self Savings', desc: 'Your locked savings', color: 'text-blue-400', bar: 'bg-blue-400' },
  { key: 'parent' as const, label: 'Parent Fund', desc: 'Sent to family monthly', color: 'text-purple-400', bar: 'bg-purple-400' },
  { key: 'charity' as const, label: 'Charity', desc: 'Donated to NGOs', color: 'text-[#FFD2C2]', bar: 'bg-[#FFD2C2]' },
];

const DEFAULTS: Pools = { liquid: 40, savings: 30, parent: 20, charity: 10 };

export function PoolSettingsPage() {
  const queryClient = useQueryClient();
  const [pools, setPools] = useState<Pools>(DEFAULTS);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<PoolConfig>({
    queryKey: ['pool-config'],
    queryFn: async () => (await api.get('/pool-config')).data.data,
  });

  useEffect(() => {
    if (data) {
      setPools({
        liquid: data.liquid_pct,
        savings: data.savings_pct,
        parent: data.parent_pct,
        charity: data.charity_pct,
      });
    }
  }, [data]);

  const poolSum = Object.values(pools).reduce((a, b) => a + b, 0);

  // Adjust one pool and proportionally rebalance the others to keep the sum at 100.
  const adjust = (key: keyof Pools, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    const others = (Object.keys(pools) as (keyof Pools)[]).filter((k) => k !== key);
    const oldSum = others.reduce((s, k) => s + pools[k], 0);
    const remaining = 100 - clamped;
    const next = { ...pools, [key]: clamped };
    if (oldSum > 0) {
      others.forEach((k) => {
        next[k] = Math.round((pools[k] / oldSum) * remaining);
      });
    }
    const actual = (Object.values(next) as number[]).reduce((a, b) => a + b, 0);
    if (actual !== 100) next[others[others.length - 1]] += 100 - actual;
    setPools(next);
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/pool-config', {
        liquid_pct: pools.liquid,
        savings_pct: pools.savings,
        parent_pct: pools.parent,
        charity_pct: pools.charity,
      }),
    onSuccess: () => {
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['pool-config'] });
    },
    onError: () => setError('Could not save. The split must total 100%.'),
  });

  return (
    <AppLayout title="Cashback Split" subtitle="Decide where your future cashback goes">
      <div className="max-w-[560px]">
        <GlassCard className="p-6 mb-4">
          {isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-6 mb-5">
                {POOL_META.map((p) => (
                  <div key={p.key}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div>
                        <span className={`text-sm font-semibold ${p.color}`}>{p.label}</span>
                        <span className="text-[11px] text-slate-500 ml-2">{p.desc}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-200">{pools[p.key]}%</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 rounded-full bg-white/[0.08] mb-1">
                        <div className={`h-full rounded-full transition-all ${p.bar}`} style={{ width: `${pools[p.key]}%` }} />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pools[p.key]}
                        onChange={(e) => adjust(p.key, Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 h-2 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={`text-center text-sm font-semibold mb-4 ${poolSum === 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                Total: {poolSum}%{poolSum === 100 ? ' ✓' : ' (must equal 100%)'}
              </div>

              {mutation.isSuccess && (
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-sm mb-3">
                  <CheckCircle2 className="w-4 h-4" /> Saved — applies to future cashback
                </div>
              )}
              {error && <p className="text-xs text-red-400 text-center mb-3">{error}</p>}

              <div className="flex gap-2">
                <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setPools(DEFAULTS)}>
                  Reset
                </Button>
                <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={poolSum !== 100} className="flex-1">
                  Save Split
                </Button>
              </div>
            </>
          )}
        </GlassCard>

        <p className="text-xs text-slate-500 px-1">
          Changing your split only affects cashback earned from now on — balances already in each pool stay put.
        </p>
      </div>
    </AppLayout>
  );
}
