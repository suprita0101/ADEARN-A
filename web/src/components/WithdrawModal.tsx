import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Banknote } from 'lucide-react';
import { AxiosError } from 'axios';
import { withdrawFromWallet } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface WithdrawModalProps {
  liquidBalance: number;
  onClose: () => void;
}

export function WithdrawModal({ liquidBalance, onClose }: WithdrawModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');

  const amt = Number(amount);
  const valid = amt >= 10 && amt <= liquidBalance && destination.trim().length >= 3;

  const mutation = useMutation({
    mutationFn: () => withdrawFromWallet(amt, method, destination.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err) => {
      setError(
        err instanceof AxiosError
          ? ((err.response?.data as { error?: { message?: string } })?.error?.message ??
            'Withdrawal failed.')
          : 'Withdrawal failed.',
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-[420px] rounded-[14px] p-6 relative"
        style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {mutation.isSuccess ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-teal-300" />
            <p className="text-base font-semibold text-slate-100">Withdrawal successful!</p>
            <p className="text-sm text-slate-400">
              ₹{mutation.data.withdrawn.toFixed(2)} is on its way to{' '}
              <span className="text-slate-200">{mutation.data.destination}</span>.
            </p>
            <p className="text-xs text-slate-500">
              New liquid balance: ₹{mutation.data.new_liquid_balance.toFixed(2)}
            </p>
            <Button onClick={onClose} className="w-full mt-2">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-5 h-5 text-teal-300" />
              <h2 className="text-base font-semibold text-slate-100">Withdraw cashback</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Available liquid balance:{' '}
              <span className="text-teal-300 font-semibold">₹{liquidBalance.toFixed(2)}</span>
            </p>

            <div className="flex flex-col gap-4">
              <Input
                label="Amount (₹)"
                type="number"
                min="10"
                placeholder="Min ₹10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex gap-2">
                {[0.25, 0.5, 1].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setAmount(String(Math.floor(liquidBalance * f)))}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-slate-400 hover:text-teal-300 hover:border-teal-300/30"
                  >
                    {f === 1 ? 'Max' : `${f * 100}%`}
                  </button>
                ))}
              </div>

              {/* Method toggle */}
              <div className="flex gap-2">
                {(['upi', 'bank'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={
                      method === m
                        ? 'flex-1 px-3 py-2 rounded-lg border text-sm font-medium bg-teal-300/[0.12] border-teal-300/30 text-teal-300'
                        : 'flex-1 px-3 py-2 rounded-lg border text-sm font-medium bg-white/[0.04] border-white/[0.08] text-slate-400'
                    }
                  >
                    {m === 'upi' ? 'UPI' : 'Bank'}
                  </button>
                ))}
              </div>

              <Input
                label={method === 'upi' ? 'UPI ID' : 'Account number'}
                type="text"
                placeholder={method === 'upi' ? 'name@bank' : 'Account number'}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />

              {amt > liquidBalance && (
                <p className="text-xs text-red-400">Amount exceeds available balance.</p>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}

              <Button
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
                disabled={!valid}
                className="w-full"
              >
                Withdraw ₹{amt > 0 ? amt.toFixed(0) : '0'}
              </Button>
              <p className="text-center text-[11px] text-slate-600">
                Test mode — payout is simulated, no real money moves.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
