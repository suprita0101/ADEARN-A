import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { walletService } from '../services/wallet.service';

const router = Router();
router.use(authenticate);

const withdrawSchema = z.object({
  amount: z.number({ invalid_type_error: 'amount must be a number' }).positive(),
  method: z.enum(['bank', 'upi']).default('upi'),
  destination: z.string().min(3, 'Enter a valid UPI ID or account').max(100),
});

// GET /wallet
router.get(
  '/',
  (async (req, res, next) => {
    try {
      const data = await walletService.getWallet(req.user!.sub);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// POST /wallet/withdraw — redeem liquid balance via mocked payout
router.post(
  '/withdraw',
  validate(withdrawSchema),
  (async (req, res, next) => {
    try {
      const { amount, method, destination } = req.body as z.infer<typeof withdrawSchema>;
      const data = await walletService.withdraw(req.user!.sub, amount, method, destination);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// GET /transactions
router.get(
  '/transactions',
  (async (req, res, next) => {
    try {
      const data = await walletService.getTransactions(req.user!.sub);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

export default router;
