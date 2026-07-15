import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AppLayout } from '../../components/AppLayout';
import { GlassCard, EmptyState, StatusBadge, Button } from '../../components/ui';
import { CheckoutModal } from '../../components/CheckoutModal';
import { VideoAdModal } from '../../components/VideoAdModal';
import { api } from '../../lib/api';
import { ShoppingBag, Play, Flame } from 'lucide-react';

interface AdCard {
  campaign_id: string;
  product: string;
  brand: string;
  cashback_rate: number;
  estimated_cashback_rupees: number;
  creative_url?: string;
  creative_type?: string;
}

export function FeedPage() {
  const [checkoutAd, setCheckoutAd] = useState<AdCard | null>(null);
  const [videoAd, setVideoAd] = useState<AdCard | null>(null);

  const { data: ads = [], isLoading } = useQuery<AdCard[]>({
    queryKey: ['feed'],
    queryFn: async () => {
      const res = await api.get('/feed');
      return (res.data.data?.ads ?? []) as AdCard[];
    },
    staleTime: 60_000,
  });

  // Video ads open the player first; the player's "Shop Now" leads to checkout.
  const openAd = (ad: AdCard) => {
    if (ad.creative_type === 'video' && ad.creative_url) setVideoAd(ad);
    else setCheckoutAd(ad);
  };

  return (
    <AppLayout title="Your Feed" subtitle="Ads matched to your purchase intent">
      {/* Rewards teaser (discoverable entry to streaks & badges, esp. on mobile) */}
      <Link
        to="/rewards"
        className="flex items-center gap-3 p-3 mb-4 rounded-xl transition-colors"
        style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
      >
        <Flame className="w-5 h-5 text-orange-400 shrink-0" fill="#fb923c" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100 leading-tight">Your Rewards</p>
          <p className="text-xs text-slate-400 leading-tight">Track your streak &amp; unlock badges</p>
        </div>
        <span className="text-orange-400 text-sm">→</span>
      </Link>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="h-40 animate-pulse">{null}</GlassCard>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-10 h-10" />}
          title="No matched ads yet"
          description="Complete your shopping profile to see personalised ads here."
          action={{ label: 'Update Profile', onClick: () => { window.location.href = '/onboarding'; } }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map(ad => {
            const isVideo = ad.creative_type === 'video' && !!ad.creative_url;
            return (
            <GlassCard key={ad.campaign_id} hover className="p-0 flex flex-col overflow-hidden">
              {/* Video-ad preview banner */}
              {isVideo && (
                <button
                  onClick={() => openAd(ad)}
                  className="relative h-28 w-full flex items-center justify-center group"
                  style={{ background: 'linear-gradient(135deg, rgba(94,234,212,0.12), rgba(96,165,250,0.10))' }}
                >
                  <span className="w-12 h-12 rounded-full bg-black/40 group-hover:bg-black/55 flex items-center justify-center transition-colors">
                    <Play className="w-5 h-5 text-white ml-0.5" fill="#fff" />
                  </span>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/45 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                    Video ad
                  </span>
                </button>
              )}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.08] flex items-center justify-center text-slate-300 font-bold text-sm">
                    {ad.brand.charAt(0)}
                  </div>
                  <StatusBadge status="active" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-slate-500">
                    {ad.brand}
                  </p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5 leading-snug">
                    {ad.product}
                  </p>
                </div>
                <div
                  className="flex items-center justify-between mt-auto pt-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-300/10 border border-teal-300/20 text-teal-300 text-xs font-bold">
                    {(ad.cashback_rate * 100).toFixed(1)}% cashback
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={isVideo ? <Play className="w-3.5 h-3.5" /> : undefined}
                    onClick={() => openAd(ad)}
                  >
                    {isVideo ? 'Watch & Shop' : 'Shop Now'}
                  </Button>
                </div>
              </div>
            </GlassCard>
            );
          })}
        </div>
      )}

      {videoAd && videoAd.creative_url && (
        <VideoAdModal
          ad={{
            campaign_id: videoAd.campaign_id,
            product: videoAd.product,
            brand: videoAd.brand,
            cashback_rate: videoAd.cashback_rate,
            estimated_cashback_rupees: videoAd.estimated_cashback_rupees,
            creative_url: videoAd.creative_url,
          }}
          onShopNow={() => {
            const ad = videoAd;
            setVideoAd(null);
            setCheckoutAd(ad);
          }}
          onClose={() => setVideoAd(null)}
        />
      )}

      {checkoutAd && (
        <CheckoutModal ad={checkoutAd} onClose={() => setCheckoutAd(null)} />
      )}
    </AppLayout>
  );
}
