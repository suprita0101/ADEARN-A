import { useRef, useState } from 'react';
import { X, Volume2, VolumeX, ShoppingBag } from 'lucide-react';
import { Button } from './ui/Button';

interface VideoAd {
  campaign_id: string;
  product: string;
  brand: string;
  cashback_rate: number;
  estimated_cashback_rupees: number;
  creative_url: string;
}

interface VideoAdModalProps {
  ad: VideoAd;
  onShopNow: () => void;
  onClose: () => void;
}

export function VideoAdModal({ ad, onShopNow, onClose }: VideoAdModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [watched, setWatched] = useState(false);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-[400px] rounded-[16px] overflow-hidden relative"
        style={{ background: '#0a101a', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Video */}
        <div className="relative bg-black aspect-[9/12] sm:aspect-video">
          <video
            ref={videoRef}
            src={ad.creative_url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            controls={false}
            onEnded={() => setWatched(true)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration && v.currentTime / v.duration > 0.6) setWatched(true);
            }}
          />

          {/* top controls */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="px-2 py-1 rounded-md bg-black/50 text-[10px] font-semibold uppercase tracking-wide text-white/80">
              Sponsored
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/90"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/90"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* bottom gradient + cashback badge */}
          <div
            className="absolute bottom-0 left-0 right-0 p-4 pt-10"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-teal-300">
              {ad.brand}
            </p>
            <p className="text-sm font-semibold text-white mt-0.5 leading-snug">{ad.product}</p>
            <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full bg-teal-300/20 border border-teal-300/40 text-teal-300 text-xs font-bold">
              {(ad.cashback_rate * 100).toFixed(1)}% cashback
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="p-4">
          <Button onClick={onShopNow} icon={<ShoppingBag className="w-4 h-4" />} className="w-full">
            Shop Now · earn ~₹{ad.estimated_cashback_rupees.toFixed(0)}
          </Button>
          <p className="text-center text-[11px] text-slate-500 mt-2">
            {watched ? '✓ Ad watched — cashback unlocked on purchase' : 'Watch the ad, then shop to earn cashback'}
          </p>
        </div>
      </div>
    </div>
  );
}
