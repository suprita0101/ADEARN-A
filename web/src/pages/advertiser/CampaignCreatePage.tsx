import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard, Input, Select, Button } from '../../components/ui';
import { api } from '../../lib/api';
import { ArrowLeft, Eye, Tag, Percent, CalendarDays, Rocket, Flag, Clock } from 'lucide-react';
import { useWatch } from 'react-hook-form';

// ─── schedule helpers ────────────────────────────────────────────────────────

/** datetime-local expects `YYYY-MM-DDTHH:mm` in LOCAL time (not ISO/UTC). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPretty(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DURATION_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

const createCampaignSchema = z.object({
  name: z.string().min(3).max(255),
  creative_url: z.string().url('Must be a valid URL'),
  creative_type: z.enum(['video', 'banner', 'audio']),
  target_categories: z.string().min(1),
  target_brands: z.string().min(1),
  cashback_rate: z.coerce.number().min(0.01).max(0.05),
  daily_cap: z.coerce.number().min(500),
  total_budget: z.coerce.number().positive(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  pledge_accepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the anti-surge pledge to launch a campaign' }),
  }),
});

type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    if (response?.data?.error?.message) return response.data.error.message;
  }
  return 'Failed to create campaign. Please try again.';
}

export function CampaignCreatePage() {
  const navigate = useNavigate();

  const form = useForm<CreateCampaignInput>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      creative_type: 'video',
      cashback_rate: 0.03,
      daily_cap: 10000,
      total_budget: 200000,
    },
  });

  const watchedName = useWatch({ control: form.control, name: 'name' });
  const watchedBrands = useWatch({ control: form.control, name: 'target_brands' });
  const watchedRate = useWatch({ control: form.control, name: 'cashback_rate' });
  const watchedBudget = useWatch({ control: form.control, name: 'total_budget' });
  const watchedStart = useWatch({ control: form.control, name: 'starts_at' });
  const watchedEnd = useWatch({ control: form.control, name: 'ends_at' });

  // Schedule summary — duration in whole days between start and end
  const startDate = watchedStart ? new Date(watchedStart) : null;
  const endDate = watchedEnd ? new Date(watchedEnd) : null;
  const durationDays =
    startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())
      ? Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000)
      : null;
  const invalidRange = durationDays !== null && durationDays <= 0;

  /** Start now, end N days later. */
  const applyPreset = (days: number) => {
    const now = new Date();
    const end = new Date(now.getTime() + days * 86_400_000);
    form.setValue('starts_at', toLocalInputValue(now), { shouldDirty: true });
    form.setValue('ends_at', toLocalInputValue(end), { shouldDirty: true });
  };

  async function onSubmit(data: CreateCampaignInput) {
    try {
      await api.post('/advertiser/campaigns', {
        name: data.name,
        creative_url: data.creative_url,
        creative_type: data.creative_type,
        target_profile: {
          categories: data.target_categories.split(',').map((s) => s.trim()).filter(Boolean),
          brands: data.target_brands.split(',').map((s) => s.trim()).filter(Boolean),
        },
        cashback_rate: data.cashback_rate,
        daily_cap: data.daily_cap,
        total_budget: data.total_budget,
        starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : undefined,
        ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : undefined,
      });
      void navigate({ to: '/advertiser' });
    } catch (err) {
      form.setError('root', { message: extractErrorMessage(err) });
    }
  }

  const errors = form.formState.errors;

  return (
    <AppLayout
      title="New Campaign"
      subtitle="Set up your campaign details"
      actions={
        <Button
          variant="ghost"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => void navigate({ to: '/advertiser' })}
        >
          Back
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: form ── */}
        <div className="lg:col-span-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <GlassCard className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-200">Creative Details</h3>

              <Input
                label="Campaign Name"
                placeholder="e.g. Mamaearth Vitamin C Launch"
                error={errors.name?.message}
                {...form.register('name')}
              />

              <Input
                label="Creative URL"
                placeholder="https://cdn.example.com/ad.mp4"
                error={errors.creative_url?.message}
                {...form.register('creative_url')}
              />

              <Select
                label="Creative Type"
                error={errors.creative_type?.message}
                {...form.register('creative_type')}
              >
                <option value="video">Video</option>
                <option value="banner">Banner</option>
                <option value="audio">Audio</option>
              </Select>
            </GlassCard>

            <GlassCard className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-200">Audience Targeting</h3>

              <Input
                label="Target Categories (comma-separated)"
                placeholder="Health & Beauty, Electronics"
                error={errors.target_categories?.message}
                {...form.register('target_categories')}
              />

              <Input
                label="Target Brands (comma-separated)"
                placeholder="Mamaearth, Plum"
                error={errors.target_brands?.message}
                {...form.register('target_brands')}
              />
            </GlassCard>

            <GlassCard className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-200">Budget & Cashback</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Input
                    label="Cashback Rate"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.05"
                    placeholder="0.03"
                    error={errors.cashback_rate?.message}
                    {...form.register('cashback_rate')}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">e.g. 0.03 = 3%</p>
                </div>
                <Input
                  label="Daily Cap (₹)"
                  type="number"
                  error={errors.daily_cap?.message}
                  {...form.register('daily_cap')}
                />
                <Input
                  label="Total Budget (₹)"
                  type="number"
                  error={errors.total_budget?.message}
                  {...form.register('total_budget')}
                />
              </div>

            </GlassCard>

            {/* ── Campaign schedule ── */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-teal-300" />
                  Campaign Schedule
                </h3>
                {durationDays !== null && !invalidRange && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-300/10 border border-teal-300/25 text-teal-300 text-[11px] font-bold whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    {durationDays} {durationDays === 1 ? 'day' : 'days'}
                  </span>
                )}
              </div>

              {/* Quick duration presets */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500 mb-2">
                  Quick select
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => {
                    const active = durationDays === p.days;
                    return (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => applyPreset(p.days)}
                        className={
                          active
                            ? 'px-3 py-1.5 rounded-lg border text-xs font-semibold bg-teal-300/[0.15] border-teal-300/40 text-teal-300 transition-all'
                            : 'px-3 py-1.5 rounded-lg border text-xs font-medium bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-100 hover:border-white/20 transition-all'
                        }
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'starts_at' as const, label: 'Starts', icon: Rocket, tint: 'text-teal-300' },
                  { key: 'ends_at' as const, label: 'Ends', icon: Flag, tint: 'text-[#FFD2C2]' },
                ].map(({ key, label: lbl, icon: Icon, tint }) => (
                  <div key={key}>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
                      <Icon className={`w-3.5 h-3.5 ${tint}`} />
                      {lbl}
                    </label>
                    <input
                      type="datetime-local"
                      // colorScheme:dark makes the native calendar/clock picker
                      // render dark instead of a white popup on the dark UI.
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300/40 focus:border-teal-300/40 transition-colors duration-150 cursor-pointer hover:bg-white/[0.08]"
                      {...form.register(key)}
                    />
                  </div>
                ))}
              </div>

              {/* Timeline summary */}
              {startDate && endDate && !invalidRange && (
                <div
                  className="rounded-lg p-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-300 shrink-0 shadow-[0_0_8px_rgba(94,234,212,0.6)]" />
                    <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-teal-300 via-teal-400/40 to-[#FFD2C2]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFD2C2] shrink-0" />
                  </div>
                  <div className="flex items-start justify-between gap-3 mt-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Launch</p>
                      <p className="text-xs text-slate-200 font-medium">{formatPretty(watchedStart)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Finish</p>
                      <p className="text-xs text-slate-200 font-medium">{formatPretty(watchedEnd)}</p>
                    </div>
                  </div>
                </div>
              )}

              {invalidRange && (
                <p className="text-xs text-red-400">The end date must come after the start date.</p>
              )}
              {(errors.starts_at || errors.ends_at) && (
                <p className="text-xs text-red-400">
                  {errors.starts_at?.message ?? errors.ends_at?.message}
                </p>
              )}
            </GlassCard>

            {/* Anti-surge pledge — mandatory */}
            <GlassCard className="p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 accent-teal-400 shrink-0"
                  {...form.register('pledge_accepted')}
                />
                <span className="text-sm text-slate-300 leading-snug">
                  <span className="font-semibold text-slate-100">Anti-surge pledge.</span>{' '}
                  I commit not to raise the price of products advertised on AdEarn for the duration
                  of this campaign. I understand a breach results in immediate campaign suspension.
                </span>
              </label>
              {errors.pledge_accepted && (
                <p className="text-xs text-red-400 mt-2">{errors.pledge_accepted.message}</p>
              )}
            </GlassCard>

            {errors.root && (
              <p className="text-sm text-red-400">{errors.root.message}</p>
            )}

            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              disabled={invalidRange}
              className="w-full"
            >
              {form.formState.isSubmitting ? 'Creating...' : 'Submit Campaign'}
            </Button>
          </form>
        </div>

        {/* ── Right column: live preview ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </p>

            <GlassCard className="p-5 space-y-4">
              {/* Campaign name */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Campaign</p>
                <p className="text-slate-100 font-semibold text-base leading-snug">
                  {watchedName || 'Campaign Name'}
                </p>
              </div>

              {/* Brand */}
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                <p className="text-sm text-slate-300 truncate">
                  {watchedBrands
                    ? watchedBrands.split(',')[0].trim()
                    : 'Brand Name'}
                </p>
              </div>

              {/* Cashback badge */}
              <div className="flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                <span className="text-sm font-bold text-teal-300">
                  {watchedRate ? (Number(watchedRate) * 100).toFixed(1) : '3.0'}% cashback
                </span>
              </div>

              {/* Budget */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total Budget</span>
                  <span className="text-slate-200 font-medium">
                    ₹{watchedBudget ? Number(watchedBudget).toLocaleString('en-IN') : '2,00,000'}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.08]">
                  <div className="h-full w-0 rounded-full bg-gradient-to-r from-teal-300 to-teal-400" />
                </div>
                <p className="text-[10px] text-slate-500">Pending review — no spend yet</p>
              </div>

              <div
                className="rounded-lg px-3 py-2 text-center"
                style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.15)' }}
              >
                <p className="text-[11px] text-teal-300 font-semibold">Performance billing only</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Charged only on confirmed purchases</p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
