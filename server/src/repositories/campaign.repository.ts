import { db } from '../config/db';
import type { Campaign } from '@adearn/shared';

interface CampaignStats {
  impressions: string;
  conversions: string;
  total_spend: string;
  avg_cashback_paid: string;
}

export interface RecentConversionRow {
  id: string;
  created_at: string;
  cashback_amount: string;
  purchase_amount: string;
  status: string;
}

export interface AdminCampaignRow {
  id: string;
  name: string;
  status: string;
  company_name: string;
  creative_url: string;
  creative_type: string;
  cashback_rate: string;
  created_at: string;
}

export const campaignRepository = {
  async findAdvertiserByUserId(userId: string): Promise<{ id: string; status: string } | null> {
    const res = await db.query<{ id: string; status: string }>(
      'SELECT id, status FROM advertisers WHERE user_id = $1',
      [userId],
    );
    return res.rows[0] ?? null;
  },

  async create(
    advertiserId: string,
    data: {
      name: string;
      description?: string;
      creative_url: string;
      creative_type: string;
      target_profile: object;
      cashback_rate: number;
      daily_cap: number;
      total_budget: number;
      starts_at?: string;
      ends_at?: string;
    },
  ): Promise<Campaign> {
    const res = await db.query<Campaign>(
      `INSERT INTO campaigns
         (advertiser_id, name, description, creative_url, creative_type,
          target_profile, cashback_rate, daily_cap, total_budget,
          starts_at, ends_at, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,'pending_review')
       RETURNING *`,
      [
        advertiserId,
        data.name,
        data.description ?? null,
        data.creative_url,
        data.creative_type,
        JSON.stringify(data.target_profile),
        data.cashback_rate,
        data.daily_cap,
        data.total_budget,
        data.starts_at ?? null,
        data.ends_at ?? null,
      ],
    );
    return res.rows[0];
  },

  async findByAdvertiserId(
    advertiserId: string,
  ): Promise<(Campaign & { conversion_count: number })[]> {
    const res = await db.query<Campaign & { conversion_count: number }>(
      `
      SELECT c.*,
        (SELECT COUNT(t.id)::int
         FROM attribution_sessions s
         JOIN cashback_transactions t
           ON t.attribution_id = s.id
          AND t.status = 'completed'
         WHERE s.campaign_id = c.id) AS conversion_count
      FROM campaigns c
      WHERE c.advertiser_id = $1
      ORDER BY c.created_at DESC
      `,
      [advertiserId],
    );
    return res.rows;
  },

  /**
   * Change a campaign's status, but only if it belongs to the advertiser and is
   * currently in `fromStatus`. Returns false if no row matched (wrong owner or
   * invalid current state). Race-safe via the guarded WHERE.
   */
  async setStatusOwned(
    campaignId: string,
    advertiserId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<boolean> {
    const res = await db.query(
      `UPDATE campaigns
       SET status = $4, updated_at = NOW()
       WHERE id = $1 AND advertiser_id = $2 AND status = $3`,
      [campaignId, advertiserId, fromStatus, toStatus],
    );
    return (res.rowCount ?? 0) > 0;
  },

  /** Duplicate a campaign (owned by advertiser) as a fresh pending_review draft with zero spend. */
  async duplicateOwned(campaignId: string, advertiserId: string): Promise<Campaign | null> {
    const res = await db.query<Campaign>(
      `INSERT INTO campaigns
         (advertiser_id, name, description, creative_url, creative_type,
          target_profile, cashback_rate, daily_cap, total_budget,
          starts_at, ends_at, status, spent_to_date)
       SELECT advertiser_id, name || ' (copy)', description, creative_url, creative_type,
              target_profile, cashback_rate, daily_cap, total_budget,
              starts_at, ends_at, 'pending_review', 0
       FROM campaigns
       WHERE id = $1 AND advertiser_id = $2
       RETURNING *`,
      [campaignId, advertiserId],
    );
    return res.rows[0] ?? null;
  },

  async findById(campaignId: string): Promise<Campaign | null> {
    const res = await db.query<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId],
    );
    return res.rows[0] ?? null;
  },

  /** All campaigns with their advertiser, for the admin creative manager. */
  async listAllForAdmin(): Promise<AdminCampaignRow[]> {
    const res = await db.query<AdminCampaignRow>(
      `SELECT c.id, c.name, c.status, a.company_name,
              c.creative_url, c.creative_type, c.cashback_rate, c.created_at
       FROM campaigns c
       JOIN advertisers a ON a.id = c.advertiser_id
       ORDER BY c.created_at DESC
       LIMIT 100`,
    );
    return res.rows;
  },

  /** Admin: replace a campaign's ad creative. Returns false when the campaign doesn't exist. */
  async updateCreative(
    campaignId: string,
    creativeUrl: string,
    creativeType: string,
  ): Promise<boolean> {
    const res = await db.query(
      `UPDATE campaigns
       SET creative_url = $2, creative_type = $3, updated_at = NOW()
       WHERE id = $1`,
      [campaignId, creativeUrl, creativeType],
    );
    return (res.rowCount ?? 0) > 0;
  },

  async getRecentConversions(
    campaignId: string,
    limit = 10,
  ): Promise<RecentConversionRow[]> {
    const res = await db.query<RecentConversionRow>(
      `
      SELECT
        t.id,
        t.created_at,
        t.cashback_amount::text  AS cashback_amount,
        t.purchase_amount::text  AS purchase_amount,
        t.status
      FROM attribution_sessions s
      JOIN cashback_transactions t ON t.attribution_id = s.id
      WHERE s.campaign_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2
      `,
      [campaignId, limit],
    );
    return res.rows;
  },

  async getStats(campaignId: string): Promise<CampaignStats> {
    const res = await db.query<CampaignStats>(
      `
      SELECT
        COUNT(s.id)::text                                         AS impressions,
        COUNT(t.id)::text                                         AS conversions,
        COALESCE(SUM(t.cashback_amount), 0)::text                AS total_spend,
        COALESCE(AVG(t.cashback_amount), 0)::text                AS avg_cashback_paid
      FROM attribution_sessions s
      LEFT JOIN cashback_transactions t
        ON t.attribution_id = s.id
       AND t.status = 'completed'
      WHERE s.campaign_id = $1
      `,
      [campaignId],
    );
    return res.rows[0];
  },
};
