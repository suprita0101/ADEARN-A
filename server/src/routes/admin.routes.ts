import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { disbursementRepository } from '../repositories/disbursement.repository';
import { campaignRepository } from '../repositories/campaign.repository';
import { analyticsService } from '../services/analytics.service';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { AppError } from '../lib/AppError';

const router = Router();

const updateCreativeSchema = z.object({
  creative_url: z.string().url('creative_url must be a valid URL'),
  creative_type: z.enum(['video', 'banner', 'audio']).default('video'),
});

const createNgoSchema = z.object({
  name: z.string().min(2).max(255),
  registration_no: z.string().min(2).max(100),
  cause: z.enum(['education', 'environment', 'elderly_care', 'healthcare']),
});
const ngoActiveSchema = z.object({ is_active: z.boolean() });

/**
 * GET /admin/charity-ledger
 * Public — no JWT required. Returns all charity disbursements newest-first.
 * Response: { success: true, data: [{ id, ngo_name, total_amount, user_count, disbursed_at, notes }] }
 */
router.get(
  '/charity-ledger',
  (async (_req, res, next) => {
    try {
      const data = await disbursementRepository.getCharityLedger();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

// All routes below require an authenticated admin JWT.
router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /admin/fraud-queue
 * List all cashback transactions currently flagged for fraud review.
 */
router.get(
  '/fraud-queue',
  (async (_req, res, next) => {
    try {
      const data = await analyticsService.getFraudQueue();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * PUT /admin/fraud-queue/:id/approve
 * Body: { approved: boolean }
 * Approve (true) or reject (false) a fraud-flagged transaction.
 */
router.put(
  '/fraud-queue/:id/approve',
  (async (req, res, next) => {
    try {
      if (!req.user) {
        next(new Error('Unauthorized'));
        return;
      }
      const txId = req.params['id'] as string;
      const approved: boolean = Boolean(req.body.approved);
      await analyticsService.resolveFraudCase(txId, approved, req.user.sub);
      res.json({ success: true, data: { id: txId, approved } });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/users
 * Paginated list of platform users (most recent first, default limit 50).
 */
router.get(
  '/users',
  (async (_req, res, next) => {
    try {
      const data = await analyticsService.listUsers();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * PUT /admin/users/:id/suspend
 * Body: { suspended: boolean }
 * Suspend (true) or reinstate (false) a user account.
 */
router.put(
  '/users/:id/suspend',
  (async (req, res, next) => {
    try {
      const userId = req.params['id'] as string;
      const suspended: boolean = Boolean(req.body.suspended);
      // Guard: an admin suspending their own account would lock everyone out
      // of the admin panel entirely.
      if (suspended && req.user && req.user.sub === userId) {
        res.status(422).json({
          success: false,
          error: { code: 'SELF_SUSPEND', message: 'You cannot suspend your own account' },
        });
        return;
      }
      await analyticsService.setUserSuspended(userId, suspended);
      res.json({ success: true, data: { id: userId, suspended } });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/advertisers
 * List all advertisers with status='pending' awaiting approval.
 */
router.get(
  '/advertisers',
  (async (_req, res, next) => {
    try {
      const data = await analyticsService.listPendingAdvertisers();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * PUT /admin/advertisers/:id/approve
 * Body: { approved: boolean }
 * Approve → status 'active', reject → status 'suspended'.
 */
router.put(
  '/advertisers/:id/approve',
  (async (req, res, next) => {
    try {
      const advertiserId = req.params['id'] as string;
      const approved: boolean = Boolean(req.body.approved);
      await analyticsService.setAdvertiserApproval(advertiserId, approved);
      res.json({ success: true, data: { id: advertiserId, approved } });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/financials
 * Platform-wide financial summary (total cashback paid, pool balances, active users).
 */
router.get(
  '/financials',
  (async (_req, res, next) => {
    try {
      const data = await analyticsService.getAdminFinancials();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/audit-log?action=cashback_processed&entity_type=cashback_transaction
 * Returns last 100 audit log entries, optionally filtered.
 */
router.get(
  '/audit-log',
  (async (req, res, next) => {
    try {
      const action = typeof req.query['action'] === 'string' ? req.query['action'] : undefined;
      const entity_type = typeof req.query['entity_type'] === 'string' ? req.query['entity_type'] : undefined;
      const data = await analyticsService.getAuditLog({ action, entity_type });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/campaigns
 * All campaigns with advertiser + current creative, for the creative manager.
 */
router.get(
  '/campaigns',
  (async (_req, res, next) => {
    try {
      const data = await campaignRepository.listAllForAdmin();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * PUT /admin/campaigns/:id/creative
 * Body: { creative_url, creative_type } — replace a campaign's ad clip.
 */
router.put(
  '/campaigns/:id/creative',
  validate(updateCreativeSchema),
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      const { creative_url, creative_type } = req.body as z.infer<typeof updateCreativeSchema>;
      const updated = await campaignRepository.updateCreative(
        req.params.id,
        creative_url,
        creative_type,
      );
      if (!updated) {
        next(AppError.notFound('Campaign not found'));
        return;
      }
      res.json({ success: true, data: { id: req.params.id, creative_url, creative_type } });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

/**
 * GET /admin/ngos — all partner NGOs with accumulated balances.
 * POST /admin/ngos — add a new NGO.
 * PUT /admin/ngos/:id/active — activate/deactivate.
 */
router.get(
  '/ngos',
  (async (_req, res, next) => {
    try {
      const data = await disbursementRepository.listAllNgos();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

router.post(
  '/ngos',
  validate(createNgoSchema),
  (async (req, res, next) => {
    try {
      const { name, registration_no, cause } = req.body as z.infer<typeof createNgoSchema>;
      const data = await disbursementRepository.createNgo(name, registration_no, cause);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

router.put(
  '/ngos/:id/active',
  validate(ngoActiveSchema),
  (async (req: Request<{ id: string }>, res, next) => {
    try {
      const { is_active } = req.body as z.infer<typeof ngoActiveSchema>;
      const ok = await disbursementRepository.setNgoActive(req.params.id, is_active);
      if (!ok) {
        next(AppError.notFound('NGO not found'));
        return;
      }
      res.json({ success: true, data: { id: req.params.id, is_active } });
    } catch (err) {
      next(err);
    }
  }) as RequestHandler,
);

export default router;
