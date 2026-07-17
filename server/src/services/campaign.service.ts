import { campaignRepository } from '../repositories/campaign.repository';
import { AppError } from '../lib/AppError';
import type { CreateCampaignInput } from '@adearn/shared';

export const campaignService = {
  async createCampaign(userId: string, data: CreateCampaignInput) {
    const advertiser = await campaignRepository.findAdvertiserByUserId(userId);
    if (!advertiser) {
      throw new AppError(
        'Advertiser profile not found — complete onboarding first',
        403,
        'ADVERTISER_NOT_FOUND',
      );
    }
    if (advertiser.status !== 'active') {
      throw new AppError('Advertiser account is not active', 403, 'ADVERTISER_NOT_ACTIVE');
    }

    const campaign = await campaignRepository.create(advertiser.id, data);
    return { campaign_id: campaign.id, status: campaign.status };
  },

  async listCampaigns(userId: string) {
    const advertiser = await campaignRepository.findAdvertiserByUserId(userId);
    if (!advertiser) {
      throw new AppError('Advertiser profile not found', 403, 'ADVERTISER_NOT_FOUND');
    }
    return campaignRepository.findByAdvertiserId(advertiser.id);
  },

  /** Pause (active→paused) or resume (paused→active) an owned campaign. */
  async setCampaignStatus(userId: string, campaignId: string, action: 'pause' | 'resume') {
    const advertiser = await campaignRepository.findAdvertiserByUserId(userId);
    if (!advertiser) {
      throw new AppError('Advertiser profile not found', 403, 'ADVERTISER_NOT_FOUND');
    }
    const from = action === 'pause' ? 'active' : 'paused';
    const to = action === 'pause' ? 'paused' : 'active';
    const ok = await campaignRepository.setStatusOwned(campaignId, advertiser.id, from, to);
    if (!ok) {
      throw AppError.conflict(
        action === 'pause'
          ? 'Only an active campaign can be paused'
          : 'Only a paused campaign can be resumed',
      );
    }
    return { id: campaignId, status: to };
  },

  /** Duplicate an owned campaign as a new pending_review draft. */
  async duplicateCampaign(userId: string, campaignId: string) {
    const advertiser = await campaignRepository.findAdvertiserByUserId(userId);
    if (!advertiser) {
      throw new AppError('Advertiser profile not found', 403, 'ADVERTISER_NOT_FOUND');
    }
    const copy = await campaignRepository.duplicateOwned(campaignId, advertiser.id);
    if (!copy) throw AppError.notFound('Campaign not found');
    return { campaign_id: copy.id, status: copy.status };
  },

  async getCampaignStats(userId: string, campaignId: string) {
    const advertiser = await campaignRepository.findAdvertiserByUserId(userId);
    if (!advertiser) {
      throw new AppError('Advertiser profile not found', 403, 'ADVERTISER_NOT_FOUND');
    }

    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) throw AppError.notFound('Campaign not found');
    if (campaign.advertiser_id !== advertiser.id) throw AppError.forbidden('Not your campaign');

    const [stats, recentConversions] = await Promise.all([
      campaignRepository.getStats(campaignId),
      campaignRepository.getRecentConversions(campaignId),
    ]);

    const conversions = Number(stats.conversions);
    const totalSpend = Number(stats.total_spend);
    const avgCashback = Number(stats.avg_cashback_paid);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        cashback_rate: String(campaign.cashback_rate),
        total_budget: String(campaign.total_budget),
        spent_to_date: String(campaign.spent_to_date),
        ends_at: campaign.ends_at ? new Date(campaign.ends_at).toISOString() : null,
      },
      conversions_count: conversions,
      total_spent: totalSpend,
      avg_cashback: Math.round(avgCashback * 100) / 100,
      recent_conversions: recentConversions.map((c) => ({
        id: c.id,
        created_at: c.created_at,
        cashback_amount: Number(c.cashback_amount),
        purchase_amount: Number(c.purchase_amount),
        status: c.status,
      })),
    };
  },
};
