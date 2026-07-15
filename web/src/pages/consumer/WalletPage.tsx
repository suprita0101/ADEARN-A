import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard, DataTable, StatusBadge, Button } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { SavingsGoalCard } from '../../components/SavingsGoalCard';
import { WithdrawModal } from '../../components/WithdrawModal';
import { api } from '../../lib/api';
import { Wallet, TrendingUp, Banknote } from 'lucide-react';

interface PoolBalances {
  liquid_balance: number;
  savings_balance: number;
  parent_balance: number;
  charity_balance: number;
  total_earned: number;
}

interface WalletData {
  pool_balances: PoolBalances;
  withdrawal_eligible: boolean;
}

interface Transaction extends Record<string, unknown> {
  id: string;
  campaign_name: string;
  cashback_amount: number;
  created_at: string;
  status: string;
}

const POOL_CONFIG: Array<{
  key: keyof PoolBalances;
  label: string;
  icon: string;
  color: string;
  border: string;
}> = [
  { key: 'liquid_balance',  label: 'Liquid',  icon: '💧', color: 'text-teal-300',   border: 'border-teal-300/20'   },
  { key: 'savings_balance', label: 'Savings', icon: '🏦', color: 'text-blue-400',   border: 'border-blue-400/20'   },
  { key: 'parent_balance',  label: 'Parent',  icon: '👨‍👩‍👧', color: 'text-purple-400', border: 'border-purple-400/20' },
  { key: 'charity_balance', label: 'Charity', icon: '🤝', color: 'text-[#FFD2C2]',  border: 'border-[#FFD2C2]/20'  },
];

const TX_COLUMNS: TableColumn<Transaction>[] = [
  { key: 'campaign_name', label: 'Campaign' },
  {
    key: 'cashback_amount',
    label: 'Amount',
    render: (v) => <span className="text-teal-300 font-semibold">+₹{Number(v).toFixed(2)}</span>,
  },
  {
    key: 'created_at',
    label: 'Date',
    render: (v) => new Date(String(v)).toLocaleDateString('en-IN'),
  },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <StatusBadge status={String(v)} />,
  },
];

export function WalletPage() {
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: wallet } = useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api.get('/wallet');
      return res.data.data as WalletData;
    },
    refetchInterval: 5000,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await api.get('/wallet/transactions');
      return (res.data.data ?? []) as Transaction[];
    },
    refetchInterval: 5000,
  });

  return (
    <AppLayout title="Wallet" subtitle="Your earnings and pool balances">
      {/* Hero */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-300/10 border border-teal-300/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400">
              Total Earned
            </p>
            <p className="text-3xl font-bold text-slate-100 leading-none mt-1">
              ₹{(wallet?.pool_balances?.total_earned ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500">Liquid · withdrawable</p>
            <p className="text-lg font-bold text-teal-300 mt-0.5">₹{(wallet?.pool_balances?.liquid_balance ?? 0).toFixed(2)}</p>
          </div>
          <Button
            icon={<Banknote className="w-4 h-4" />}
            disabled={!wallet?.withdrawal_eligible}
            onClick={() => setShowWithdraw(true)}
          >
            Withdraw
          </Button>
        </div>
      </GlassCard>

      {/* Pool grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {POOL_CONFIG.map(p => (
          <GlassCard key={p.key} className={`p-4 border ${p.border}`}>
            <div className="text-2xl mb-2">{p.icon}</div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400">
              {p.label}
            </p>
            <p className={`text-xl font-bold mt-1 ${p.color}`}>
              ₹{(wallet?.pool_balances?.[p.key] ?? 0).toFixed(2)}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Savings goal */}
      <div className="mb-6">
        <SavingsGoalCard savingsBalance={wallet?.pool_balances?.savings_balance ?? 0} />
      </div>

      {/* Recent activity (full history lives on the Transactions page) */}
      <GlassCard className="overflow-hidden">
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h3 className="text-sm font-semibold text-slate-200">Recent Activity</h3>
          {transactions.length > 5 && (
            <Link
              to="/transactions"
              className="text-xs font-medium text-teal-300 hover:text-teal-200 transition-colors"
            >
              View all →
            </Link>
          )}
        </div>
        <DataTable
          columns={TX_COLUMNS}
          rows={transactions.slice(0, 5)}
          emptyMessage="No transactions yet"
        />
      </GlassCard>

      {showWithdraw && (
        <WithdrawModal
          liquidBalance={wallet?.pool_balances?.liquid_balance ?? 0}
          onClose={() => setShowWithdraw(false)}
        />
      )}
    </AppLayout>
  );
}
