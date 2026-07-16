import crypto from 'crypto';
import { scratchCardRepository } from '../repositories/scratchCard.repository';
import { AppError } from '../lib/AppError';
import { logger } from '../config/logger';

/**
 * Prize table (server-side only — the client never influences the outcome):
 *   20%  →  ₹0   better luck next time
 *   45%  →  ₹2–8
 *   25%  →  ₹10–20
 *   10%  →  ₹25–50 jackpot
 */
function rollReward(): number {
  const roll = crypto.randomInt(0, 100);
  if (roll < 20) return 0;
  if (roll < 65) return crypto.randomInt(2, 9);
  if (roll < 90) return crypto.randomInt(10, 21);
  return crypto.randomInt(25, 51);
}

export const scratchCardService = {
  async list(userId: string) {
    const rows = await scratchCardRepository.listForUser(userId);
    return rows.map((r) => ({
      transaction_id: r.transaction_id,
      campaign_name: r.campaign_name,
      earned_at: r.earned_at,
      scratched: r.scratched,
      reward_amount: r.reward_amount !== null ? Number(r.reward_amount) : null,
      scratched_at: r.scratched_at,
    }));
  },

  async scratch(userId: string, transactionId: string) {
    const reward = rollReward();
    const result = await scratchCardRepository.scratch(userId, transactionId, reward);
    if (!result) {
      throw AppError.conflict('Card already scratched or not available');
    }
    logger.info(
      { userId, transactionId, reward: result.reward_amount },
      'scratch card revealed',
    );
    return {
      reward_amount: result.reward_amount,
      credited_to: result.reward_amount > 0 ? 'liquid' : null,
    };
  },
};
