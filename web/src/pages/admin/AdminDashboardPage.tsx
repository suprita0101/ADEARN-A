import { useState } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Shield, Users, Megaphone, TrendingUp, Activity, Clapperboard, X, Heart, Plus } from 'lucide-react';
import {
  getFraudQueue,
  resolveFraudCase,
  getAdminUsers,
  suspendUser,
  getPendingAdvertisers,
  approveAdvertiser,
  getAdminFinancials,
  getAdminCampaigns,
  updateCampaignCreative,
  getNgos,
  createNgo,
  setNgoActive,
  type FraudQueueRow,
  type AdminUserRow,
  type PendingAdvertiserRow,
  type AdminFinancials,
  type AdminCampaignRow,
  type NgoRow,
} from '../../lib/api';
import { AppLayout } from '../../components/AppLayout';
import {
  GlassCard,
  KpiCard,
  Button,
  Skeleton,
} from '../../components/ui';

// ─── tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'financials',  label: 'Financials',  icon: DollarSign   },
  { key: 'fraud',       label: 'Fraud Queue', icon: Shield       },
  { key: 'users',       label: 'Users',       icon: Users        },
  { key: 'advertisers', label: 'Advertisers', icon: Megaphone    },
  { key: 'campaigns',   label: 'Ad Clips',    icon: Clapperboard },
  { key: 'ngos',        label: 'NGOs',        icon: Heart        },
] as const;
type Tab = typeof TABS[number]['key'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(str: string): string {
  return `₹${Number(str).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── shared table styles ──────────────────────────────────────────────────────

const thClass =
  'text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 whitespace-nowrap border-b border-white/[0.08]';
const tdClass = 'py-3 px-4 text-slate-300 text-sm';
const trClass = 'border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-100';

// ─── Tab: Financials ─────────────────────────────────────────────────────────

function FinancialsTab() {
  const { data, isLoading, isError } = useQuery<AdminFinancials>({
    queryKey: ['admin-financials'],
    queryFn: getAdminFinancials,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Unable to load financials. Please try again later.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cashback Paid"
          value={formatCurrency(data.total_cashback_paid)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <KpiCard
          label="Under Review"
          value={formatCurrency(data.total_under_review)}
          icon={<Shield className="w-5 h-5" />}
        />
        <KpiCard
          label="Total Liquid"
          value={formatCurrency(data.total_liquid)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KpiCard
          label="Active Users"
          value={data.active_users.toLocaleString('en-IN')}
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Total Savings"      value={formatCurrency(data.total_savings)} />
        <KpiCard label="Parent Fund Pending" value={formatCurrency(data.total_parent_pending)} />
        <KpiCard label="Charity Pending"    value={formatCurrency(data.total_charity_pending)} />
      </div>
    </div>
  );
}

// ─── Tab: Fraud Queue ────────────────────────────────────────────────────────

function FraudQueueTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<FraudQueueRow[]>({
    queryKey: ['admin-fraud-queue'],
    queryFn: getFraudQueue,
    refetchInterval: 10_000,
  });

  const mutation = useMutation({
    mutationFn: (args: { id: string; approved: boolean }) =>
      resolveFraudCase(args.id, args.approved),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-fraud-queue'] }),
  });

  if (isLoading) {
    return (
      <GlassCard className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Unable to load fraud queue. Please try again later.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thClass}>User Mobile</th>
              <th className={thClass}>Campaign</th>
              <th className={`${thClass} text-right`}>Purchase</th>
              <th className={`${thClass} text-right`}>Cashback</th>
              <th className={`${thClass} text-right`}>Fraud Score</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  No transactions under review.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const scoreNum = Number(row.fraud_score) * 100;
                const scoreColor =
                  scoreNum > 80
                    ? 'text-red-400 font-semibold'
                    : scoreNum > 50
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-300';
                const isPending =
                  mutation.isPending && mutation.variables?.id === row.id;

                return (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>{row.user_mobile}</td>
                    <td className={tdClass}>{row.campaign_name}</td>
                    <td className={`${tdClass} text-right`}>
                      {formatCurrency(row.purchase_amount)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {formatCurrency(row.cashback_amount)}
                    </td>
                    <td className={`${tdClass} text-right ${scoreColor}`}>
                      {scoreNum.toFixed(0)}%
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          loading={isPending}
                          onClick={() => mutation.mutate({ id: row.id, approved: true })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={isPending}
                          onClick={() => mutation.mutate({ id: row.id, approved: false })}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<AdminUserRow[]>({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (args: { id: string; suspended: boolean }) =>
      suspendUser(args.id, args.suspended),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (isLoading) {
    return (
      <GlassCard className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Unable to load users. Please try again later.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Mobile</th>
              <th className={thClass}>Role</th>
              <th className={thClass}>KYC</th>
              <th className={`${thClass} text-right`}>Fraud Flags</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isPending =
                  mutation.isPending && mutation.variables?.id === row.id;

                return (
                  <tr key={row.id} className={trClass}>
                    <td className={`${tdClass} font-medium text-slate-100`}>{row.name}</td>
                    <td className={tdClass}>{row.mobile}</td>
                    <td className={`${tdClass} capitalize`}>{row.role}</td>
                    <td className={`${tdClass} capitalize`}>{row.kyc_status}</td>
                    <td className={`${tdClass} text-right`}>{row.fraud_flags}</td>
                    <td className={tdClass}>
                      {row.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-400/10 text-red-400 border border-red-400/20">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {row.is_active ? (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={isPending}
                          onClick={() => {
                            // Suspension blocks the user's login entirely — confirm first
                            // so a stray tap (esp. on mobile) can't lock an account.
                            if (
                              window.confirm(
                                `Suspend ${row.name} (${row.mobile})? They will not be able to log in until reinstated.`,
                              )
                            ) {
                              mutation.mutate({ id: row.id, suspended: true });
                            }
                          }}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={isPending}
                          onClick={() => mutation.mutate({ id: row.id, suspended: false })}
                        >
                          Reinstate
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Tab: Advertisers ────────────────────────────────────────────────────────

function AdvertisersTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PendingAdvertiserRow[]>({
    queryKey: ['admin-pending-advertisers'],
    queryFn: getPendingAdvertisers,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (args: { id: string; approved: boolean }) =>
      approveAdvertiser(args.id, args.approved),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-pending-advertisers'] }),
  });

  if (isLoading) {
    return (
      <GlassCard className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Unable to load advertiser applications. Please try again later.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thClass}>Company</th>
              <th className={thClass}>Email</th>
              <th className={`${thClass} text-right`}>Quality Score</th>
              <th className={thClass}>Registered</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-400">
                  No pending advertiser applications.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const score = Number(row.quality_score);
                const scoreDisplay = score > 0 ? score.toFixed(2) : '—';
                const isPending =
                  mutation.isPending && mutation.variables?.id === row.id;

                return (
                  <tr key={row.id} className={trClass}>
                    <td className={`${tdClass} font-medium text-slate-100`}>{row.company_name}</td>
                    <td className={tdClass}>{row.contact_email}</td>
                    <td className={`${tdClass} text-right`}>{scoreDisplay}</td>
                    <td className={tdClass}>{formatDate(row.created_at)}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          loading={isPending}
                          onClick={() => mutation.mutate({ id: row.id, approved: true })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={isPending}
                          onClick={() => mutation.mutate({ id: row.id, approved: false })}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Tab: Ad Clips (campaign creative manager) ───────────────────────────────

function EditCreativeModal({
  campaign,
  onClose,
}: {
  campaign: AdminCampaignRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(campaign.creative_url);
  const [previewError, setPreviewError] = useState(false);
  const isValidUrl = /^https?:\/\/.+/.test(url.trim());

  const mutation = useMutation({
    mutationFn: () => updateCampaignCreative(campaign.id, url.trim(), 'video'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-[480px] rounded-[14px] p-6 relative"
        style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-base font-semibold text-slate-100 mb-1">Edit ad clip</h2>
        <p className="text-sm text-slate-400 mb-4 truncate">{campaign.name}</p>

        <label className="block text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
          Video URL (mp4)
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setPreviewError(false);
          }}
          placeholder="https://…/product-ad.mp4"
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-300/40 mb-4"
        />

        {/* Live preview — verify the clip actually plays before saving */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1.5">
          Preview
        </p>
        <div
          className="rounded-lg overflow-hidden bg-black mb-4 flex items-center justify-center"
          style={{ height: 200 }}
        >
          {isValidUrl && !previewError ? (
            <video
              key={url}
              src={url.trim()}
              className="w-full h-full object-contain"
              controls
              muted
              playsInline
              onError={() => setPreviewError(true)}
            />
          ) : (
            <p className="text-xs text-slate-500 px-4 text-center">
              {previewError
                ? '⚠️ This URL did not load as a video — check the link.'
                : 'Enter a video URL to preview it here.'}
            </p>
          )}
        </div>

        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!isValidUrl || previewError}
          className="w-full"
        >
          Save clip
        </Button>
        {mutation.isError && (
          <p className="text-xs text-red-400 mt-2 text-center">Could not save — try again.</p>
        )}
      </div>
    </div>
  );
}

function CampaignsTab() {
  const [editing, setEditing] = useState<AdminCampaignRow | null>(null);

  const { data, isLoading, isError } = useQuery<AdminCampaignRow[]>({
    queryKey: ['admin-campaigns'],
    queryFn: getAdminCampaigns,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <GlassCard className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </GlassCard>
    );
  }
  if (isError) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-red-400">Unable to load campaigns. Please try again later.</p>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={thClass}>Campaign</th>
                <th className={thClass}>Advertiser</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Clip</th>
                <th className={`${thClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    No campaigns yet.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={`${tdClass} font-medium text-slate-100`}>{row.name}</td>
                    <td className={tdClass}>{row.company_name}</td>
                    <td className={`${tdClass} capitalize`}>{row.status.replace('_', ' ')}</td>
                    <td className={tdClass}>
                      <a
                        href={row.creative_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-300 hover:text-teal-200 text-xs inline-flex items-center gap-1"
                      >
                        <Clapperboard className="w-3.5 h-3.5" />
                        {row.creative_type}
                      </a>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Edit clip
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {editing && <EditCreativeModal campaign={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ─── Tab: NGOs (charity partner manager) ─────────────────────────────────────

function NgosTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', registration_no: '', cause: '' });

  const { data, isLoading, isError } = useQuery<NgoRow[]>({
    queryKey: ['admin-ngos'],
    queryFn: getNgos,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-ngos'] });
  const addMutation = useMutation({
    mutationFn: () => createNgo(form.name.trim(), form.registration_no.trim(), form.cause.trim()),
    onSuccess: () => {
      setForm({ name: '', registration_no: '', cause: '' });
      void invalidate();
    },
  });
  const toggleMutation = useMutation({
    mutationFn: (args: { id: string; is_active: boolean }) => setNgoActive(args.id, args.is_active),
    onSuccess: () => void invalidate(),
  });

  const canAdd = form.name.trim().length >= 2 && form.registration_no.trim().length >= 2 && form.cause.trim().length >= 2;

  return (
    <div className="space-y-5">
      {/* Add NGO */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Add partner NGO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            placeholder="NGO name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-300/40"
          />
          <input
            placeholder="80G reg. no."
            value={form.registration_no}
            onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-300/40"
          />
          <select
            value={form.cause}
            onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-slate-200 focus:outline-none focus:border-teal-300/40"
          >
            <option value="" className="bg-slate-800">Select cause…</option>
            <option value="education" className="bg-slate-800">Education</option>
            <option value="healthcare" className="bg-slate-800">Healthcare</option>
            <option value="environment" className="bg-slate-800">Environment</option>
            <option value="elderly_care" className="bg-slate-800">Elderly care</option>
          </select>
        </div>
        <div className="mt-3">
          <Button size="sm" icon={<Plus className="w-4 h-4" />} loading={addMutation.isPending} disabled={!canAdd} onClick={() => addMutation.mutate()}>
            Add NGO
          </Button>
        </div>
      </GlassCard>

      {/* NGO list */}
      {isLoading ? (
        <GlassCard className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </GlassCard>
      ) : isError ? (
        <GlassCard className="p-8 text-center"><p className="text-red-400">Unable to load NGOs.</p></GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={thClass}>NGO</th>
                  <th className={thClass}>Cause</th>
                  <th className={thClass}>80G Reg.</th>
                  <th className={`${thClass} text-right`}>Accumulated</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-slate-400">No NGOs yet.</td></tr>
                ) : (
                  data.map((n) => {
                    const busy = toggleMutation.isPending && toggleMutation.variables?.id === n.id;
                    return (
                      <tr key={n.id} className={trClass}>
                        <td className={`${tdClass} font-medium text-slate-100`}>{n.name}</td>
                        <td className={`${tdClass} capitalize`}>{n.cause}</td>
                        <td className={tdClass}>{n.registration_no}</td>
                        <td className={`${tdClass} text-right`}>{formatCurrency(n.accumulated_balance)}</td>
                        <td className={tdClass}>
                          {n.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Active</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-400/10 text-slate-400 border border-slate-400/20">Inactive</span>
                          )}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <Button size="sm" variant={n.is_active ? 'danger' : 'primary'} loading={busy}
                            onClick={() => toggleMutation.mutate({ id: n.id, is_active: !n.is_active })}>
                            {n.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { tab: activeTab } = useSearch({ from: '/admin' });
  const navigate = useNavigate();
  const setActiveTab = (key: Tab) => void navigate({ to: '/admin', search: { tab: key } });

  return (
    <AppLayout title="Admin Dashboard">
      {/* pill tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] w-fit mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === key
                ? 'bg-teal-300/[0.15] text-teal-300 border border-teal-300/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* tab content */}
      {activeTab === 'financials' && <FinancialsTab />}
      {activeTab === 'fraud'      && <FraudQueueTab />}
      {activeTab === 'users'      && <UsersTab />}
      {activeTab === 'advertisers' && <AdvertisersTab />}
      {activeTab === 'campaigns'  && <CampaignsTab />}
      {activeTab === 'ngos'       && <NgosTab />}
    </AppLayout>
  );
}
