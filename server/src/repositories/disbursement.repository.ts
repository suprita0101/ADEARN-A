import { db } from '../config/db';

export interface UserParentBalance {
  user_id: string;
  parent_pending: string; // DECIMAL comes as string from pg
  bank_ifsc: string | null;
  bank_account: string | null;
}

export interface CharityTotals {
  total_amount: string; // DECIMAL comes as string from pg
  user_count: string;   // aggregate count comes as string from pg
}

export interface CharityLedgerRow {
  id: string;
  ngo_name: string | null;
  total_amount: string;
  user_count: number;
  disbursed_at: string;
  notes: string | null;
}

export interface NgoRow {
  id: string;
  name: string;
  cause: string;
  accumulated_balance: string;
}

export const disbursementRepository = {
  /**
   * Returns all users with parent_pending > 0, along with their parent bank
   * details extracted from pool_configs.parent_account JSONB.
   */
  async getUsersWithParentBalance(): Promise<UserParentBalance[]> {
    const res = await db.query<UserParentBalance>(
      `SELECT
         pb.user_id,
         pb.parent_pending,
         pc.parent_account->>'ifsc'    AS bank_ifsc,
         pc.parent_account->>'account' AS bank_account
       FROM pool_balances pb
       LEFT JOIN pool_configs pc ON pc.user_id = pb.user_id
       WHERE pb.parent_pending > 0`,
    );
    return res.rows;
  },

  /**
   * Zero out parent_pending for a user and record the transfer — one atomic
   * transaction so the balance and the log are always consistent.
   */
  async transferParentFund(
    userId: string,
    amount: number,
    bankIfsc: string | null,
    bankAccount: string | null,
  ): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE pool_balances
         SET parent_pending = 0, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      await client.query(
        `INSERT INTO parent_fund_transfers (user_id, amount, bank_ifsc, bank_account, status)
         VALUES ($1, $2, $3, $4, 'completed')`,
        [userId, amount, bankIfsc, bankAccount],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Returns the aggregate charity_pending across all users and the count of
   * users who have a non-zero charity balance.
   */
  async getCharityTotals(): Promise<CharityTotals> {
    const res = await db.query<CharityTotals>(
      `SELECT
         COALESCE(SUM(charity_pending), 0)::TEXT AS total_amount,
         COUNT(*)::TEXT                          AS user_count
       FROM pool_balances
       WHERE charity_pending > 0`,
    );
    const row = res.rows[0];
    if (!row) return { total_amount: '0', user_count: '0' };
    return row;
  },

  /**
   * Zero out all users' charity_pending balances and record the disbursement —
   * one atomic transaction.
   */
  async disburseCharity(
    ngoId: string | null,
    totalAmount: number,
    userCount: number,
  ): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE pool_balances
         SET charity_pending = 0, updated_at = NOW()
         WHERE charity_pending > 0`,
      );
      await client.query(
        `INSERT INTO charity_disbursements (ngo_id, total_amount, user_count)
         VALUES ($1, $2, $3)`,
        [ngoId, totalAmount, userCount],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Public charity ledger — returns all disbursements newest-first, joined with
   * NGO names where available.
   */
  async getCharityLedger(): Promise<CharityLedgerRow[]> {
    const res = await db.query<CharityLedgerRow>(
      `SELECT
         cd.id,
         n.name     AS ngo_name,
         cd.total_amount,
         cd.user_count,
         cd.disbursed_at,
         cd.notes
       FROM charity_disbursements cd
       LEFT JOIN ngos n ON n.id = cd.ngo_id
       ORDER BY cd.disbursed_at DESC
       LIMIT 100`,
    );
    return res.rows;
  },

  /** Active NGOs partnered with the platform, for the public impact page. */
  async getNgos(): Promise<NgoRow[]> {
    const res = await db.query<NgoRow>(
      `SELECT id, name, cause, accumulated_balance
       FROM ngos
       WHERE is_active = true
       ORDER BY name`,
    );
    return res.rows;
  },

  /** All NGOs (incl. inactive) for the admin manager. */
  async listAllNgos(): Promise<(NgoRow & { registration_no: string; is_active: boolean })[]> {
    const res = await db.query<NgoRow & { registration_no: string; is_active: boolean }>(
      `SELECT id, name, registration_no, cause, accumulated_balance, is_active
       FROM ngos
       ORDER BY is_active DESC, name`,
    );
    return res.rows;
  },

  /** Admin: add a new partner NGO. */
  async createNgo(
    name: string,
    registrationNo: string,
    cause: string,
  ): Promise<{ id: string }> {
    const res = await db.query<{ id: string }>(
      `INSERT INTO ngos (name, registration_no, cause, bank_account)
       VALUES ($1, $2, $3, '{}'::jsonb)
       RETURNING id`,
      [name, registrationNo, cause],
    );
    return res.rows[0];
  },

  /** Admin: activate / deactivate an NGO. Returns false if not found. */
  async setNgoActive(ngoId: string, isActive: boolean): Promise<boolean> {
    const res = await db.query(
      `UPDATE ngos SET is_active = $2 WHERE id = $1`,
      [ngoId, isActive],
    );
    return (res.rowCount ?? 0) > 0;
  },

  /** Total amount ever disbursed to charity across all disbursements. */
  async getTotalDisbursed(): Promise<string> {
    const res = await db.query<{ total: string }>(
      `SELECT COALESCE(SUM(total_amount), 0)::TEXT AS total FROM charity_disbursements`,
    );
    return res.rows[0]?.total ?? '0';
  },
};
