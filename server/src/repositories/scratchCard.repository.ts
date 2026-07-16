import { db } from '../config/db';

export interface ScratchCardRow {
  transaction_id: string;
  campaign_name: string;
  earned_at: string;
  scratched: boolean;
  reward_amount: string | null;
  scratched_at: string | null;
}

export const scratchCardRepository = {
  /**
   * One scratch card per completed cashback transaction. Unscratched cards are
   * transactions with no scratch_cards row yet.
   */
  async listForUser(userId: string): Promise<ScratchCardRow[]> {
    const res = await db.query<ScratchCardRow>(
      `SELECT
         ct.id                                   AS transaction_id,
         COALESCE(c.name, 'Purchase reward')     AS campaign_name,
         ct.created_at                           AS earned_at,
         (sc.id IS NOT NULL)                     AS scratched,
         sc.reward_amount::text                  AS reward_amount,
         sc.scratched_at                         AS scratched_at
       FROM cashback_transactions ct
       LEFT JOIN attribution_sessions ats ON ats.id = ct.attribution_id
       LEFT JOIN campaigns c ON c.id = ats.campaign_id
       LEFT JOIN scratch_cards sc ON sc.transaction_id = ct.id
       WHERE ct.user_id = $1 AND ct.status = 'completed'
       ORDER BY ct.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return res.rows;
  },

  /**
   * Atomically scratch a card: record the reward (UNIQUE transaction_id makes
   * double-scratching impossible) and credit the user's liquid pool. Returns
   * null when the card was already scratched or the transaction is not the
   * caller's completed cashback.
   */
  async scratch(
    userId: string,
    transactionId: string,
    rewardAmount: number,
  ): Promise<{ reward_amount: number } | null> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // The INSERT only fires if the transaction belongs to this user and is
      // completed; ON CONFLICT protects against concurrent double-scratches.
      const ins = await client.query<{ id: string }>(
        `INSERT INTO scratch_cards (user_id, transaction_id, reward_amount)
         SELECT $1, ct.id, $3
         FROM cashback_transactions ct
         WHERE ct.id = $2 AND ct.user_id = $1 AND ct.status = 'completed'
         ON CONFLICT (transaction_id) DO NOTHING
         RETURNING id`,
        [userId, transactionId, rewardAmount],
      );
      if (ins.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      if (rewardAmount > 0) {
        await client.query(
          `UPDATE pool_balances
           SET liquid_balance = liquid_balance + $2,
               total_earned   = total_earned + $2,
               updated_at     = NOW()
           WHERE user_id = $1`,
          [userId, rewardAmount],
        );
      }

      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_state)
         VALUES ($1, 'scratch_card.reveal', 'scratch_card', $2, $3)`,
        [userId, transactionId, JSON.stringify({ reward_amount: rewardAmount })],
      );

      await client.query('COMMIT');
      return { reward_amount: rewardAmount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
