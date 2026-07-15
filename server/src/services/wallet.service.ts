import { walletRepository } from '../repositories/wallet.repository';
import { AppError } from '../lib/AppError';

const MIN_WITHDRAWAL = 10;

export const walletService = {
  /**
   * Redeem part of the liquid pool via a mocked payout (Stripe/UPI swap later).
   * Enforces a ₹10 minimum and rejects amounts above the available balance.
   */
  async withdraw(
    userId: string,
    amount: number,
    method: string,
    destination: string,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Enter a valid amount', 422, 'VALIDATION_ERROR');
    }
    if (amount < MIN_WITHDRAWAL) {
      throw new AppError(`Minimum withdrawal is ₹${MIN_WITHDRAWAL}`, 422, 'AMOUNT_TOO_LOW');
    }
    const result = await walletRepository.withdrawLiquid(userId, amount, method, destination);
    if (!result) {
      throw AppError.conflict('Insufficient liquid balance');
    }
    return {
      withdrawn: amount,
      method,
      destination,
      new_liquid_balance: result.new_liquid_balance,
      status: 'completed',
    };
  },

  async getWallet(userId: string) {
    const balances = await walletRepository.getPoolBalances(userId);
    return {
      pool_balances: {
        liquid_balance:  Number(balances?.liquid_balance  ?? 0),
        savings_balance: Number(balances?.savings_balance ?? 0),
        parent_balance:  Number(balances?.parent_pending  ?? 0),
        charity_balance: Number(balances?.charity_pending ?? 0),
        total_earned:    Number(balances?.total_earned    ?? 0),
      },
      withdrawal_eligible: Number(balances?.liquid_balance ?? 0) >= 10,
    };
  },

  async getTransactions(userId: string) {
    const rows = await walletRepository.getTransactions(userId);
    return rows.map(r => ({
      id:              r.id,
      campaign_id:     r.campaign_id,
      campaign_name:   r.campaign_name,
      cashback_amount: Number(r.cashback_amount),
      created_at:      r.created_at,
      status:          r.status,
      reviewed:        r.reviewed,
    }));
  },
};
