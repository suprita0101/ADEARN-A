import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Gift } from 'lucide-react';
import { scratchCard } from '../lib/api';
import { Button } from './ui/Button';

interface ScratchCardModalProps {
  transactionId: string;
  campaignName: string;
  onClose: () => void;
}

const SIZE = 280;

export function ScratchCardModal({ transactionId, campaignName, onClose }: ScratchCardModalProps) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [revealed, setRevealed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => scratchCard(transactionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scratch-cards'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  // Paint the metallic scratch layer once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, '#2dd4bf');
    grad.addColorStop(0.5, '#0d9488');
    grad.addColorStop(1, '#115e59');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // sparkles
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * SIZE, Math.random() * SIZE, Math.random() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(6,11,20,0.85)';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scratch here! 🪙', SIZE / 2, SIZE / 2 - 6);
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('rub to reveal your reward', SIZE / 2, SIZE / 2 + 16);
  }, []);

  const scratchedFraction = (): number => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return 0;
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    let clear = 0;
    const step = 16; // sample every 16th pixel's alpha
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] === 0) clear++;
    }
    return clear / (data.length / (4 * step));
  };

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    if (scratchedFraction() > 0.45) setRevealed(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true;
    // First touch locks in the reward server-side.
    if (mutation.isIdle) mutation.mutate();
    scratchAt(e.clientX, e.clientY);
  };

  const reward = mutation.data?.reward_amount ?? null;
  const won = reward !== null && reward > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="rounded-[18px] p-6 relative w-full max-w-[340px]"
        style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500 mb-1">
          Reward from
        </p>
        <p className="text-sm font-semibold text-slate-200 mb-4 truncate">{campaignName}</p>

        {/* Scratch area */}
        <div
          className="relative mx-auto rounded-2xl overflow-hidden select-none"
          style={{ width: SIZE, height: SIZE, maxWidth: '100%', touchAction: 'none' }}
        >
          {/* Underneath: the prize */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'linear-gradient(160deg, #0f172a, #1e293b)' }}
          >
            {reward === null ? (
              <Gift className="w-14 h-14 text-slate-600" />
            ) : won ? (
              <>
                <span className="text-5xl">🎉</span>
                <p className="text-4xl font-bold text-teal-300">₹{reward}</p>
                <p className="text-xs text-slate-400">bonus added to your Liquid pool</p>
              </>
            ) : (
              <>
                <span className="text-5xl">😅</span>
                <p className="text-lg font-bold text-slate-300">Better luck next time!</p>
                <p className="text-xs text-slate-500">Keep shopping to earn more cards</p>
              </>
            )}
          </div>

          {/* Scratch layer */}
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="absolute inset-0 w-full h-full cursor-pointer"
            style={{
              opacity: revealed ? 0 : 1,
              transition: 'opacity 0.6s ease',
              pointerEvents: revealed ? 'none' : 'auto',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={(e) => drawing.current && scratchAt(e.clientX, e.clientY)}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
        </div>

        {revealed && (
          <Button onClick={onClose} className="w-full mt-5">
            {won ? 'Claim & Close' : 'Close'}
          </Button>
        )}
        {!revealed && (
          <p className="text-center text-[11px] text-slate-600 mt-4">
            Once you start scratching, the reward is locked in.
          </p>
        )}
      </div>
    </div>
  );
}
