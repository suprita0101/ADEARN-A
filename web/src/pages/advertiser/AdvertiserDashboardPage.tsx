import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AxiosError } from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { KpiCard, GlassCard, DataTable, StatusBadge, Button } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { EditCampaignModal } from '../../components/EditCampaignModal';
import {
  api, setCampaignStatus, duplicateCampaign, deleteCampaign, archiveCampaign,
} from '../../lib/api';
import {
  Plus, BarChart2, DollarSign, Target, TrendingUp, Pause, Play, Copy, Pencil, Trash2, Archive,
} from 'lucide-react';

interface Campaign extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  cashback_rate: string;
  total_budget: string;
  spent_to_date: string;
  conversion_count: number;
}

export function AdvertiserDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['advertiser-campaigns'],
    queryFn: async () => {
      const res = await api.get('/advertiser/campaigns');
      return (res.data.data ?? []) as Campaign[];
    },
    refetchInterval: 10_000,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['advertiser-campaigns'] });

  const statusMutation = useMutation({
    mutationFn: (args: { id: string; action: 'pause' | 'resume' }) =>
      setCampaignStatus(args.id, args.action),
    onSuccess: invalidate,
  });
  const dupMutation = useMutation({
    mutationFn: (id: string) => duplicateCampaign(id),
    onSuccess: invalidate,
  });

  const [editing, setEditing] = useState<Campaign | null>(null);

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveCampaign(id),
    onSuccess: invalidate,
  });

  // Deleting is only allowed when a campaign has no cashback history. If the
  // server refuses, offer archiving instead (which preserves the record).
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: invalidate,
    onError: (err, id) => {
      const msg =
        err instanceof AxiosError
          ? ((err.response?.data as { error?: { message?: string } })?.error?.message ?? '')
          : '';
      if (msg && window.confirm(`${msg}\n\nArchive this campaign instead?`)) {
        archiveMutation.mutate(id);
      } else if (!msg) {
        window.alert('Could not delete this campaign.');
      }
    },
  });

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spent_to_date), 0);
  const totalConversions = campaigns.reduce((s, c) => s + Number(c.conversion_count), 0);
  const convRate = campaigns.length > 0
    ? ((totalConversions / campaigns.length) * 100).toFixed(1)
    : '0.0';

  const columns: TableColumn<Campaign>[] = [
    { key: 'name', label: 'Campaign' },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusBadge status={String(v)} />,
    },
    {
      key: 'spent_to_date', label: 'Budget Usage',
      render: (v, row) => (
        <div className="min-w-[140px]">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">₹{Number(v).toFixed(0)}</span>
            <span className="text-slate-500">₹{Number(row.total_budget).toFixed(0)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-400"
              style={{ width: `${Math.min(100, (Number(v) / Number(row.total_budget)) * 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'cashback_rate', label: 'Cashback',
      render: (v) => (
        <span className="text-teal-300 font-semibold">
          {(Number(v) * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'conversion_count', label: 'Conversions',
      render: (v) => <span className="font-semibold text-slate-200">{String(v)}</span>,
    },
    {
      key: 'id', label: 'Actions',
      render: (_v, row) => {
        const busy =
          (statusMutation.isPending && statusMutation.variables?.id === row.id) ||
          (dupMutation.isPending && dupMutation.variables === row.id) ||
          (deleteMutation.isPending && deleteMutation.variables === row.id) ||
          (archiveMutation.isPending && archiveMutation.variables === row.id);
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {row.status === 'active' && (
              <Button size="sm" variant="ghost" loading={busy} title="Pause campaign"
                icon={<Pause className="w-3.5 h-3.5" />}
                onClick={() => statusMutation.mutate({ id: row.id, action: 'pause' })}>
                Pause
              </Button>
            )}
            {row.status === 'paused' && (
              <Button size="sm" variant="primary" loading={busy} title="Resume campaign"
                icon={<Play className="w-3.5 h-3.5" />}
                onClick={() => statusMutation.mutate({ id: row.id, action: 'resume' })}>
                Resume
              </Button>
            )}
            <Button size="sm" variant="ghost" title="Edit campaign"
              onClick={() => setEditing(row)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" loading={busy} title="Duplicate campaign"
              onClick={() => dupMutation.mutate(row.id)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {row.status !== 'completed' && (
              <Button size="sm" variant="ghost" loading={busy} title="Archive campaign"
                onClick={() => {
                  if (window.confirm(`Archive "${row.name}"? It stops serving but all history is kept.`)) {
                    archiveMutation.mutate(row.id);
                  }
                }}>
                <Archive className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button size="sm" variant="danger" loading={busy} title="Delete campaign"
              onClick={() => {
                if (window.confirm(`Delete "${row.name}"? This cannot be undone.`)) {
                  deleteMutation.mutate(row.id);
                }
              }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppLayout
      title="Advertiser Dashboard"
      actions={
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => void navigate({ to: '/advertiser/campaigns/new' })}
        >
          New Campaign
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Spend"
          value={`₹${totalSpend.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <KpiCard
          label="Active Campaigns"
          value={activeCampaigns}
          icon={<BarChart2 className="w-5 h-5" />}
        />
        <KpiCard
          label="Conversions"
          value={totalConversions}
          icon={<Target className="w-5 h-5" />}
        />
        <KpiCard
          label="Avg Conv. Rate"
          value={`${convRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      <GlassCard className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold text-slate-200">Campaigns</h3>
        </div>
        <DataTable
          columns={columns}
          rows={campaigns}
          loading={isLoading}
          onRowClick={row =>
            void navigate({
              to: '/advertiser/campaigns/$campaignId/stats',
              params: { campaignId: row.id },
            })
          }
          emptyMessage="No campaigns yet — create your first one"
        />
      </GlassCard>

      {editing && (
        <EditCampaignModal
          campaign={{
            id: editing.id,
            name: editing.name,
            cashback_rate: editing.cashback_rate,
            total_budget: editing.total_budget,
            spent_to_date: editing.spent_to_date,
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </AppLayout>
  );
}
