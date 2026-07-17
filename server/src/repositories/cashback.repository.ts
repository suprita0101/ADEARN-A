import { PoolClient } from 'pg';
import { db } from '../config/db';

export interface InsertCashbackTransactionData {
  userId: string;
  // NOTE: campaign_id is not a column in cashback_transactions — the campaign
  // link is via attribution_sessions.campaign_id (FK through attribution_id).
  sessionId: string;
  purchaseAmount: number;  // rupees
  cashbackAmount: number;  // rupees
  liquidAmount: number;    // rupees (2dp)
  savingsAmount: number;   // rupees (2dp)
  parentAmount: number;    // rupees (2dp)
  charityAmount: number;   // rupees (2dp)
  status: 'completed' | 'under_review';
  fraudScore: number;
}

export interface UpsertPoolBalancesData {
  userId: string;
  liquidAmount: number;   // paise
  savingsAmount: number;  // paise
  parentAmount: number;   // paise
  charityAmount: number;  // paise
  totalEarned: number;    // paise
}

export interface InsertAuditLogData {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  afterState: Record<string, unknown>;
  ipAddress?: string;
}

export interface CashbackTransactionForReversal {
  userId: string;
  campaignId: string;
  status: string;
  cashbackAmount: number;  // rupees
  liquidAmount: number;    // rupees
  savingsAmount: number;   // rupees
  parentAmount: number;    // rupees
  charityAmount: number;   // rupees
}

export const cashbackRepository = {
  /**
   * INSERT a new cashback_transactions row.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async insertCashbackTransaction(
    client: PoolClient,
    data: InsertCashbackTransactionData,
  ): Promise<{ id: string }> {
    const res = await client.query<{ id: string }>(
      `INSERT INTO cashback_transactions
         (user_id, attribution_id, purchase_amount, cashback_amount,
          liquid_amount, savings_amount, parent_amount, charity_amount,
          status, fraud_score, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text, $10,
               CASE WHEN $9::text = 'completed' THEN NOW() ELSE NULL END)
       RETURNING id`,
      [
        data.userId,
        data.sessionId,
        data.purchaseAmount,
        data.cashbackAmount,
        data.liquidAmount,
        data.savingsAmount,
        data.parentAmount,
        data.charityAmount,
        data.status,
        data.fraudScore,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new Error('INSERT cashback_transactions returned no row');
    return { id: row.id };
  },

  /**
   * UPSERT pool_balances — increments all four pool columns and total_earned.
   * All six amounts (liquid, savings, parent, charity, totalEarned) are in paise
   * and are divided by 100.0 to store as rupees (DECIMAL(12,2)).
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async upsertPoolBalances(client: PoolClient, data: UpsertPoolBalancesData): Promise<void> {
    await client.query(
      `INSERT INTO pool_balances
         (user_id, liquid_balance, savings_balance, parent_pending, charity_pending, total_earned)
       VALUES ($1, $2 / 100.0, $3 / 100.0, $4 / 100.0, $5 / 100.0, $6 / 100.0)
       ON CONFLICT (user_id) DO UPDATE SET
         liquid_balance  = pool_balances.liquid_balance  + EXCLUDED.liquid_balance,
         savings_balance = pool_balances.savings_balance + EXCLUDED.savings_balance,
         parent_pending  = pool_balances.parent_pending  + EXCLUDED.parent_pending,
         charity_pending = pool_balances.charity_pending + EXCLUDED.charity_pending,
         total_earned    = pool_balances.total_earned    + EXCLUDED.total_earned,
         updated_at      = NOW()`,
      [
        data.userId,
        data.liquidAmount,
        data.savingsAmount,
        data.parentAmount,
        data.charityAmount,
        data.totalEarned,
      ],
    );
  },

  /**
   * Increment campaigns.spent_to_date by cashbackAmount.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async incrementCampaignSpend(
    client: PoolClient,
    campaignId: string,
    cashbackAmount: number,
  ): Promise<void> {
    await client.query(
      `UPDATE campaigns
       SET spent_to_date = spent_to_date + $2,
           updated_at    = NOW()
       WHERE id = $1`,
      [campaignId, cashbackAmount],
    );
  },

  /**
   * Mark an attribution session as converted and record the cashback amount.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async convertAttributionSession(
    client: PoolClient,
    sessionId: string,
    cashbackAmount: number,
  ): Promise<void> {
    await client.query(
      `UPDATE attribution_sessions
       SET status          = 'converted',
           cashback_amount = $2,
           converted_at    = NOW()
       WHERE id = $1`,
      [sessionId, cashbackAmount],
    );
  },

  /**
   * Lock a cashback_transactions row for a fraud-review resolution (SELECT FOR UPDATE),
   * joined through attribution_sessions to get the campaign_id.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async lockTransactionForResolution(
    client: PoolClient,
    txId: string,
  ): Promise<CashbackTransactionForReversal | null> {
    const res = await client.query<{
      user_id: string;
      campaign_id: string;
      status: string;
      cashback_amount: string;
      liquid_amount: string;
      savings_amount: string;
      parent_amount: string;
      charity_amount: string;
    }>(
      `SELECT ct.user_id, s.campaign_id, ct.status, ct.cashback_amount,
              ct.liquid_amount, ct.savings_amount, ct.parent_amount, ct.charity_amount
       FROM cashback_transactions ct
       JOIN attribution_sessions s ON s.id = ct.attribution_id
       WHERE ct.id = $1
       FOR UPDATE OF ct`,
      [txId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      campaignId: row.campaign_id,
      status: row.status,
      cashbackAmount: Number(row.cashback_amount),
      liquidAmount: Number(row.liquid_amount),
      savingsAmount: Number(row.savings_amount),
      parentAmount: Number(row.parent_amount),
      charityAmount: Number(row.charity_amount),
    };
  },

  /**
   * Reverse a previously-credited cashback: decrement pool_balances by the exact
   * rupee amounts originally credited (not paise — cashback_transactions already
   * stores rupees). Must be called inside an open transaction via the provided PoolClient.
   */
  async decrementPoolBalances(
    client: PoolClient,
    data: Omit<CashbackTransactionForReversal, 'campaignId' | 'status'>,
  ): Promise<void> {
    await client.query(
      `UPDATE pool_balances
       SET liquid_balance  = liquid_balance  - $2,
           savings_balance = savings_balance - $3,
           parent_pending  = parent_pending  - $4,
           charity_pending = charity_pending - $5,
           total_earned    = total_earned    - $6,
           updated_at      = NOW()
       WHERE user_id = $1`,
      [
        data.userId,
        data.liquidAmount,
        data.savingsAmount,
        data.parentAmount,
        data.charityAmount,
        data.cashbackAmount,
      ],
    );
  },

  /**
   * Decrement campaigns.spent_to_date by cashbackAmount (rupees) — the inverse of
   * incrementCampaignSpend, used when reversing a rejected fraud case.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async decrementCampaignSpend(
    client: PoolClient,
    campaignId: string,
    cashbackAmount: number,
  ): Promise<void> {
    await client.query(
      `UPDATE campaigns
       SET spent_to_date = spent_to_date - $2,
           updated_at    = NOW()
       WHERE id = $1`,
      [campaignId, cashbackAmount],
    );
  },

  /**
   * Set a cashback_transactions row's status directly (used for both the simple
   * approve path and after a reject's compensating writes have been applied).
   * Must be called inside an open transaction via the provided PoolClient.
   */
  /**
   * Find the cashback transaction id + status linked to a Stripe payment intent
   * (via its attribution session). Used by refund reversal. Returns null if the
   * payment was never converted to cashback.
   */
  async findTxByPaymentIntent(
    paymentIntentId: string,
  ): Promise<{ id: string; status: string } | null> {
    const res = await db.query<{ id: string; status: string }>(
      `SELECT ct.id, ct.status
       FROM cashback_transactions ct
       JOIN attribution_sessions s ON s.id = ct.attribution_id
       WHERE s.payment_intent_id = $1
       LIMIT 1`,
      [paymentIntentId],
    );
    return res.rows[0] ?? null;
  },

  async setTransactionStatus(
    client: PoolClient,
    txId: string,
    status: 'completed' | 'rejected' | 'reversed',
  ): Promise<void> {
    await client.query(
      `UPDATE cashback_transactions
       SET status       = $2::text,
           completed_at = CASE WHEN $2::text = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $1`,
      [txId, status],
    );
  },

  /**
   * Append an immutable row to the audit_log table.
   * Must be called inside an open transaction via the provided PoolClient.
   */
  async insertAuditLog(client: PoolClient, data: InsertAuditLogData): Promise<void> {
    await client.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_state, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet)`,
      [
        data.actorId,
        data.action,
        data.entityType,
        data.entityId,
        JSON.stringify(data.afterState),
        data.ipAddress ?? null,
      ],
    );
  },
};
