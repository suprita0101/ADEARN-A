import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate';
import { scratchCardService } from '../services/scratchCard.service';

const router = Router();
router.use(authenticate);

// GET /rewards/scratch-cards — one card per completed cashback transaction
router.get(
  '/scratch-cards',
  (async (req, res, next) => {
    try {
      const data = await scratchCardService.list(req.user!.sub);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// POST /rewards/scratch-cards/:transactionId/scratch — reveal the reward
router.post(
  '/scratch-cards/:transactionId/scratch',
  (async (req: Request<{ transactionId: string }>, res, next) => {
    try {
      const data = await scratchCardService.scratch(
        req.user!.sub,
        req.params.transactionId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

export default router;
