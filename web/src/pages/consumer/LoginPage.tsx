import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AxiosError } from 'axios';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Zap, Heart } from 'lucide-react';

// Surface the backend's actual reason (e.g. "Account suspended", "Invalid or
// expired OTP") instead of a generic message, so failures are self-explanatory.
function getApiError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as { error?: { message?: string } })?.error?.message ?? fallback;
  }
  return fallback;
}

const ROLE_HOME: Record<string, string> = {
  consumer: '/feed',
  advertiser: '/advertiser',
  admin: '/admin',
};

// Seeded demo accounts (see CLAUDE.md §14). OTP is mocked to 123456 in dev.
const DEMO_ACCOUNTS: { label: string; mobile: string; role: string }[] = [
  { label: 'Consumer', mobile: '9876543210', role: 'consumer' },
  { label: 'Advertiser', mobile: '9123456789', role: 'advertiser' },
  { label: 'Admin', mobile: '9000000000', role: 'admin' },
];
const DEMO_OTP = '123456';

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (phoneNum = phone) => {
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/request-otp', {
        mobile: phoneNum,
      });

      setPhone(phoneNum);
      setStep('otp');
    } catch (err) {
      setError(getApiError(err, 'Failed to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (mobile?: string, otpValue?: string) => {
    setLoading(true);
    setError('');

    const actualPhone = mobile ?? phone;
    const actualOtp = otpValue ?? otp;

    try {
      const res = await api.post('/auth/verify-otp', {
        mobile: actualPhone,
        otp: actualOtp,
      });

      const {
        user,
        access_token,
        refresh_token,
      } = res.data.data as {
        user: {
          id: string;
          name: string;
          role: 'consumer' | 'advertiser' | 'admin';
          kyc_status: string;
        };
        access_token: string;
        refresh_token: string;
      };

      setAuth(user, access_token, refresh_token);

      navigate({
        to: ROLE_HOME[user.role] ?? '/feed',
      });
    } catch (err) {
      setError(getApiError(err, 'Invalid OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpHandler = async () => {
    await verifyOtp();
  };

  // One-click login for the seeded demo accounts: request the mock OTP, then
  // immediately verify it and route to the account's role home.
  const quickLogin = async (mobile: string) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/request-otp', { mobile });
      await verifyOtp(mobile, DEMO_OTP);
    } catch (err) {
      setError(getApiError(err, 'Demo login failed. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: '#060b14',
      }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 80% 10%, rgba(94,234,212,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 90%, rgba(255,210,194,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-[400px] relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-300 to-teal-600 flex items-center justify-center mb-3 shadow-lg shadow-teal-300/20">
            <Zap
              className="w-6 h-6 text-slate-900"
              strokeWidth={2.5}
            />
          </div>

          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            AdEarn
          </h1>

          <p className="text-sm text-slate-400 mt-1">
            Get paid for every purchase
          </p>
        </div>

        {/* Login Card */}
        <div
          className="p-6 rounded-[14px]"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {step === 'phone' ? (
            <>
              <h2 className="text-base font-semibold text-slate-100 mb-4">
                Sign in
              </h2>

              <div className="flex flex-col gap-4">
                <Input
                  label="Mobile Number"
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      e.target.value.replace(/\D/g, '').slice(0, 10)
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    phone.length === 10 &&
                    requestOtp()
                  }
                />

                {error && (
                  <p className="text-xs text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  onClick={() => requestOtp()}
                  loading={loading}
                  disabled={phone.length !== 10}
                  className="w-full"
                >
                  Send OTP
                </Button>
              </div>

              {/* Demo quick-login */}
              <div className="mt-6 pt-5 border-t border-white/[0.08]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500 mb-3 text-center">
                  Demo Accounts · one-click login
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.mobile}
                      onClick={() => void quickLogin(acc.mobile)}
                      disabled={loading}
                      className="px-2 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-medium text-slate-300 hover:text-teal-300 hover:border-teal-300/30 hover:bg-teal-300/[0.08] transition-all disabled:opacity-50"
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors mb-4 flex items-center gap-1"
              >
                ← Back
              </button>

              <h2 className="text-base font-semibold text-slate-100 mb-1">
                Enter OTP
              </h2>

              <p className="text-xs text-slate-400 mb-4">
                Sent to +91 {phone}
              </p>

              <div className="flex flex-col gap-4">
                <Input
                  label="OTP"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value.replace(/\D/g, '').slice(0, 6)
                    )
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    otp.length === 6 &&
                    verifyOtpHandler()
                  }
                />

                {error && (
                  <p className="text-xs text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  onClick={verifyOtpHandler}
                  loading={loading}
                  disabled={otp.length !== 6}
                  className="w-full"
                >
                  Verify & Sign in
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Public charity impact link */}
        <div className="text-center mt-5">
          <button
            onClick={() => void navigate({ to: '/impact' })}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#FFD2C2] transition-colors"
          >
            <Heart className="w-3.5 h-3.5" /> See our charity impact
          </button>
        </div>
      </div>
    </div>
  );
}
