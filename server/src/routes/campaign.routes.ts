import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { campaignService } from '../services/campaign.service';
import { createCampaignSchema } from '@adearn/shared';

const router = Router();

const statusSchema = z.object({ action: z.enum(['pause', 'resume']) });

router.use(authenticate);
router.use(authorize('advertiser'));

// POST /advertiser/campaigns
router.post(
  '/',
  validate(createCampaignSchema),
  (async (req, res, next) => {
    try {
      if (!req.user) {
        next(new Error('Unauthorized'));
        return;
      }
      const data = await campaignService.createCampaign(req.user.sub, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// GET /advertiser/campaigns
router.get(
  '/',
  (async (req, res, next) => {
    try {
      if (!req.user) {
        next(new Error('Unauthorized'));
        return;
      }
      const data = await campaignService.listCampaigns(req.user.sub);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// PUT /advertiser/campaigns/:id/status  — pause or resume
router.put(
  '/:id/status',
  validate(statusSchema),
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      if (!req.user) { next(new Error('Unauthorized')); return; }
      const { action } = req.body as z.infer<typeof statusSchema>;
      const data = await campaignService.setCampaignStatus(req.user.sub, req.params.id, action);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// POST /advertiser/campaigns/:id/duplicate
router.post(
  '/:id/duplicate',
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      if (!req.user) { next(new Error('Unauthorized')); return; }
      const data = await campaignService.duplicateCampaign(req.user.sub, req.params.id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// GET /advertiser/campaigns/:id/stats
router.get(
  '/:id/stats',
  (async (req, res, next) => {
    try {
      if (!req.user) {
        next(new Error('Unauthorized'));
        return;
      }
      const campaignId = req.params['id'] as string;
      const data = await campaignService.getCampaignStats(req.user.sub, campaignId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

export default router;
