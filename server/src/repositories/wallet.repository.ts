import { db } from '../config/db';

interface PoolBalanceRow {
  liquid_balance: string;
  savings_balance: string;
  parent_pending: string;
  charity_pending: string;
  total_earned: string;
}

interface TransactionRow {
  id: string;
  campaign_id: string | null;
  campaign_name: string;
  cashback_amount: string;
  created_at: string;
  status: string;
  reviewed: boolean;
}

export const walletRepository = {
  async getPoolBalances(userId: string): Promise<PoolBalanceRow | null> {
    const res = await db.query<PoolBalanceRow>(
      `SELECT liquid_balance, savings_balance, parent_pending, charity_pending, total_earned
       FROM pool_balances WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0] ?? null;
  },

  /**
   * Atomically debit the user's liquid pool for a (mocked) payout and record it
   * in the audit log. The guarded UPDATE (liquid_balance >= amount) makes it
   * race-safe: concurrent withdrawals cannot overdraw. Returns the new balance,
   * or null if funds were insufficient.
   */
  async withdrawLiquid(
    userId: string,
    amount: number,
    method: string,
    destination: string,
  ): Promise<{ new_liquid_balance: number } | null> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const upd = await client.query<{ liquid_balance: string }>(
        `UPDATE pool_balances
         SET liquid_balance = liquid_balance - $2, updated_at = NOW()
         WHERE user_id = $1 AND liquid_balance >= $2
         RETURNING liquid_balance`,
        [userId, amount],
      );
      if (upd.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const newBalance = Number(upd.rows[0].liquid_balance);
      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_state)
         VALUES ($1, 'wallet.withdraw', 'wallet', $1, $2)`,
        [userId, JSON.stringify({ amount, method, destination, new_liquid_balance: newBalance })],
      );
      await client.query('COMMIT');
      return { new_liquid_balance: newBalance };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getTransactions(userId: string): Promise<TransactionRow[]> {
    const res = await db.query<TransactionRow>(
      `SELECT ct.id,
              ats.campaign_id,
              COALESCE(c.name, 'Unknown Campaign') AS campaign_name,
              ct.cashback_amount,
              ct.created_at,
              ct.status,
              EXISTS (
                SELECT 1 FROM ad_reviews ar WHERE ar.transaction_id = ct.id
              ) AS reviewed
       FROM cashback_transactions ct
       LEFT JOIN attribution_sessions ats ON ats.id = ct.attribution_id
       LEFT JOIN campaigns c ON c.id = ats.campaign_id
       WHERE ct.user_id = $1
       ORDER BY ct.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return res.rows;
  },
};
