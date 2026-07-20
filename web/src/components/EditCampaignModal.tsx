import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { AxiosError } from 'axios';
import { updateCampaign } from '../lib/api';
import { Button } from './ui/Button';

interface EditableCampaign {
  id: string;
  name: string;
  cashback_rate: string;
  total_budget: string;
  spent_to_date: string;
}

interface EditCampaignModalProps {
  campaign: EditableCampaign;
  onClose: () => void;
}

const field =
  'w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-300/40';
const label =
  'block text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1.5';

export function EditCampaignModal({ campaign, onClose }: EditCampaignModalProps) {
  const queryClient = useQueryClient();
  const spent = Number(campaign.spent_to_date);

  const [name, setName] = useState(campaign.name);
  const [ratePct, setRatePct] = useState(String((Number(campaign.cashback_rate) * 100).toFixed(1)));
  const [budget, setBudget] = useState(String(Number(campaign.total_budget)));
  const [error, setError] = useState('');

  const rate = Number(ratePct) / 100;
  const budgetNum = Number(budget);
  const budgetTooLow = budgetNum < spent;
  const valid =
    name.trim().length >= 3 &&
    rate >= 0.01 &&
    rate <= 0.05 &&
    budgetNum > 0 &&
    !budgetTooLow;

  const mutation = useMutation({
    mutationFn: () =>
      updateCampaign(campaign.id, {
        name: name.trim(),
        cashback_rate: Math.round(rate * 1000) / 1000,
        total_budget: budgetNum,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['advertiser-campaigns'] });
      onClose();
    },
    onError: (err) => {
      setError(
        err instanceof AxiosError
          ? ((err.response?.data as { error?: { message?: string } })?.error?.message ??
            'Could not save changes.')
          : 'Could not save changes.',
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-[420px] rounded-[14px] p-6 relative"
        style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-base font-semibold text-slate-100 mb-4">Edit campaign</h2>

        <div className="space-y-4">
          <div>
            <label className={label}>Campaign name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Cashback rate (%)</label>
              <input
                className={field}
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">Between 1% and 5%</p>
            </div>
            <div>
              <label className={label}>Total budget (₹)</label>
              <input
                className={field}
                type="number"
                min="1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Spent so far: ₹{spent.toFixed(2)}
              </p>
            </div>
          </div>

          {budgetTooLow && (
            <p className="text-xs text-red-400">
              Budget can't be lower than the ₹{spent.toFixed(2)} already spent.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!valid}
            className="w-full"
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
