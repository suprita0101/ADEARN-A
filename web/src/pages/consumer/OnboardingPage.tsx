import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { AxiosError } from 'axios';
import { api } from '../../lib/api';

function getApiError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as { error?: { message?: string } })?.error?.message ?? fallback;
  }
  return fallback;
}
import { Button } from '../../components/ui/Button';
import { CheckCircle2, Zap } from 'lucide-react';

const CATEGORIES = [
  'Health & Beauty', 'Electronics', 'Fashion', 'Grocery',
  'Home & Kitchen', 'Sports', 'Books', 'Toys',
];

const POOL_DEFAULTS = { liquid: 40, savings: 30, parent: 20, charity: 10 };

type Pools = { liquid: number; savings: number; parent: number; charity: number };

const POOL_CONFIG = [
  { key: 'liquid'  as const, label: 'Liquid',  color: 'text-teal-300',   bar: 'bg-teal-300'   },
  { key: 'savings' as const, label: 'Savings', color: 'text-blue-400',   bar: 'bg-blue-400'   },
  { key: 'parent'  as const, label: 'Parent',  color: 'text-purple-400', bar: 'bg-purple-400' },
  { key: 'charity' as const, label: 'Charity', color: 'text-[#FFD2C2]',  bar: 'bg-[#FFD2C2]'  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [pools, setPools] = useState<Pools>(POOL_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleCat = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const poolSum = Object.values(pools).reduce((a, b) => a + b, 0);

  const adjustPool = (key: keyof Pools, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    const others = (Object.keys(pools) as (keyof Pools)[]).filter(k => k !== key);
    const oldSum = others.reduce((s, k) => s + pools[k], 0);
    const remaining = 100 - clamped;
    const newPools = { ...pools, [key]: clamped };
    if (oldSum > 0) {
      others.forEach(k => {
        newPools[k] = Math.round((pools[k] / oldSum) * remaining);
      });
    }
    const actual = (Object.values(newPools) as number[]).reduce((a, b) => a + b, 0);
    if (actual !== 100) newPools[others[others.length - 1]] += 100 - actual;
    setPools(newPools);
  };

  const saveProfile = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put('/profile', {
        categories: selectedCats.map((category) => ({
          category,
          brands: [],
          spend_range: 'mid',
          frequency: 'Monthly' as const,
        })),
      });
      setStep(2);
    } catch (err) {
      setError(getApiError(err, 'Failed to save profile. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const savePools = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put('/pool-config', {
        liquid_pct: pools.liquid,
        savings_pct: pools.savings,
        parent_pct: pools.parent,
        charity_pct: pools.charity,
      });
      setStep(3);
    } catch (err) {
      setError(getApiError(err, 'Failed to save pool configuration.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#060b14' }}
    >
      <div className="w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-300 to-teal-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-100 text-base">AdEarn</span>
        </div>

        {/* Progress bar */}
        {step < 3 && (
          <div className="mb-6">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500 mb-2">
              <span>Step {step} of 2</span>
              <span>{step === 1 ? 'Shopping Profile' : 'Earning Pools'}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-400 transition-all duration-500"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
        )}

        {/* Glass card */}
        <div
          className="p-6 rounded-[14px]"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Step 1: Categories */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-slate-100 mb-1">
                Your Shopping Interests
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                Select categories you shop in (choose at least one)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={clsx(
                      'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all duration-150',
                      selectedCats.includes(cat)
                        ? 'bg-teal-300/[0.15] border-teal-300/30 text-teal-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Completeness nudge — 3+ categories give the best ad matches */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (selectedCats.length / 3) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  {selectedCats.length >= 3
                    ? '✓ Great match potential'
                    : `Pick ${3 - selectedCats.length} more for best matches`}
                </span>
              </div>

              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <Button
                onClick={saveProfile}
                loading={loading}
                disabled={selectedCats.length === 0}
                className="w-full"
              >
                Continue
              </Button>
            </>
          )}

          {/* Step 2: Pool sliders */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Cashback Split</h2>
              <p className="text-sm text-slate-400 mb-5">
                Set how your earnings are distributed across pools
              </p>
              <div className="flex flex-col gap-5 mb-5">
                {POOL_CONFIG.map(p => (
                  <div key={p.key}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-sm font-medium ${p.color}`}>{p.label}</span>
                      <span className="text-sm font-bold text-slate-200">{pools[p.key]}%</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 rounded-full bg-white/[0.08] mb-1">
                        <div
                          className={`h-full rounded-full transition-all ${p.bar}`}
                          style={{ width: `${pools[p.key]}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pools[p.key]}
                        onChange={e => adjustPool(p.key, Number(e.target.value))}
                        className="absolute inset-0 w-full opacity-0 h-2 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={clsx(
                'text-center text-sm font-semibold mb-4',
                poolSum === 100 ? 'text-emerald-400' : 'text-red-400'
              )}>
                Total: {poolSum}%{poolSum !== 100 ? ' (must equal 100%)' : ' ✓'}
              </div>
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <Button
                onClick={savePools}
                loading={loading}
                disabled={poolSum !== 100}
                className="w-full"
              >
                Save &amp; Continue
              </Button>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">You&apos;re all set!</h2>
              <p className="text-sm text-slate-400 text-center mb-6">
                Your profile is ready. Start exploring ads matched to your interests.
              </p>
              <Button onClick={() => void navigate({ to: '/feed' })} className="w-full">
                Go to Feed →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
