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

const updateCampaignFieldsSchema = z
  .object({
    name: z.string().min(3).max(255).optional(),
    creative_url: z.string().url().optional(),
    creative_type: z.enum(['video', 'banner', 'audio']).optional(),
    cashback_rate: z.number().min(0.01).max(0.05).optional(),
    daily_cap: z.number().min(500).optional(),
    total_budget: z.number().positive().optional(),
    ends_at: z.string().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

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

// PUT /advertiser/campaigns/:id — edit campaign fields
router.put(
  '/:id',
  validate(updateCampaignFieldsSchema),
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      if (!req.user) { next(new Error('Unauthorized')); return; }
      const data = await campaignService.updateCampaign(
        req.user.sub,
        req.params.id,
        req.body as z.infer<typeof updateCampaignFieldsSchema>,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// DELETE /advertiser/campaigns/:id — only when no cashback history
router.delete(
  '/:id',
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      if (!req.user) { next(new Error('Unauthorized')); return; }
      const data = await campaignService.deleteCampaign(req.user.sub, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// PUT /advertiser/campaigns/:id/archive — preserve history, remove from feed
router.put(
  '/:id/archive',
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      if (!req.user) { next(new Error('Unauthorized')); return; }
      const data = await campaignService.archiveCampaign(req.user.sub, req.params.id);
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
