import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard, Input, Select, Button } from '../../components/ui';
import { api } from '../../lib/api';
import { ArrowLeft, Eye, Tag, Percent } from 'lucide-react';
import { useWatch } from 'react-hook-form';

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

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="datetime-local"
                  error={errors.starts_at?.message}
                  {...form.register('starts_at')}
                />
                <Input
                  label="End Date"
                  type="datetime-local"
                  error={errors.ends_at?.message}
                  {...form.register('ends_at')}
                />
              </div>
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
