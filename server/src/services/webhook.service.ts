import Stripe from 'stripe';
import { logger } from '../config/logger';
import { checkIdempotency, markProcessed } from '../lib/idempotency';
import { attributionRepository } from '../repositories/attribution.repository';
import { campaignRepository } from '../repositories/campaign.repository';
import { fraudDetectionService } from './fraudDetection.service';
import { cashbackEngine } from './cashbackEngine.service';
import { notificationService } from './notification.service';

export const webhookService = {
  async processStripeEvent(event: Stripe.Event): Promise<void> {
    // A refund on a previously-converted purchase claws back the cashback.
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntentId) {
        logger.warn({ chargeId: charge.id }, 'webhook: refund with no payment_intent');
        return;
      }
      // Idempotent at the event level; reverseForRefund is also idempotent by status.
      if (await checkIdempotency(event.id)) {
        logger.info({ eventId: event.id }, 'webhook: duplicate refund event, skipping');
        return;
      }
      await cashbackEngine.reverseForRefund(paymentIntentId);
      await markProcessed(event.id);
      return;
    }

    if (event.type !== 'payment_intent.succeeded') {
      logger.debug({ eventType: event.type }, 'webhook: ignoring event type');
      return;
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const eventId = event.id;

    // ── Idempotency guard ────────────────────────────────────────────────────
    // Check BEFORE doing any work. Mark AFTER cashback commits — if the process
    // crashes between commit and mark, Stripe will retry and we will reprocess.
    // That is the correct safe failure mode: double-processing is prevented by
    // the session status check (status !== 'open') which the cashback engine
    // enforces via SELECT FOR UPDATE.
    const alreadyProcessed = await checkIdempotency(eventId);
    if (alreadyProcessed) {
      logger.info({ eventId }, 'webhook: duplicate event, skipping');
      return;
    }

    // ── Find attribution session ─────────────────────────────────────────────
    const session = await attributionRepository.findByPaymentIntentId(paymentIntent.id);
    if (!session) {
      logger.warn({ paymentIntentId: paymentIntent.id }, 'webhook: no attribution session found');
      return;
    }

    // ── Validate session is still processable ────────────────────────────────
    if (session.status !== 'open') {
      logger.warn(
        { sessionId: session.id, status: session.status },
        'webhook: session not open, skipping',
      );
      return;
    }

    if (new Date(session.expires_at) < new Date()) {
      logger.warn({ sessionId: session.id }, 'webhook: session expired, skipping');
      return;
    }

    // ── Fraud detection ──────────────────────────────────────────────────────
    // client_ip stored in PaymentIntent metadata by the pay endpoint
    const clientIp = paymentIntent.metadata['client_ip'] ?? '';

    const fraudResult = await fraudDetectionService.score({
      userId: session.user_id,
      campaignId: session.campaign_id,
      purchaseAmount: Number(session.purchase_amount),
      clientIp,
    });

    logger.info(
      {
        sessionId: session.id,
        fraudScore: fraudResult.score,
        isFraud: fraudResult.isFraud,
        triggeredRules: fraudResult.triggeredRules,
      },
      'webhook: fraud score computed',
    );

    // ── Cashback engine — atomic 5-write transaction ──────────────────────────
    const result = await cashbackEngine.processCashback({
      sessionId: session.id,
      userId: session.user_id,
      purchaseAmount: Number(session.purchase_amount),
      fraudScore: fraudResult.score,
      clientIp,
    });

    logger.info(
      {
        sessionId: session.id,
        cashbackTransactionId: result.cashbackTransactionId,
        cashbackAmount: result.cashbackAmount,
        status: result.status,
      },
      'webhook: cashback processed',
    );

    // ── Mark event as processed (after commit — safe to retry if crash here) ─
    await markProcessed(eventId);

    // ── Fire-and-forget notifications ─────────────────────────────────────────
    // Look up campaign to get advertiser_id (not stored on the session row)
    setImmediate(() => {
      campaignRepository
        .findById(session.campaign_id)
        .then((campaign) => {
          // Consumer notification
          notificationService
            .sendCashbackNotification({
              userId: session.user_id,
              cashbackAmount: result.cashbackAmount,
              campaignName: campaign?.name ?? session.campaign_id,
              status: result.status,
            })
            .catch((err) => logger.warn({ err }, 'webhook: cashback notification failed'));

          // Advertiser webhook — only if we have the advertiser_id
          if (campaign?.advertiser_id) {
            notificationService
              .sendAdvertiserWebhook(campaign.advertiser_id, {
                event: 'conversion',
                campaignId: session.campaign_id,
                cashbackAmount: result.cashbackAmount,
                purchaseAmount: Number(session.purchase_amount),
                timestamp: new Date().toISOString(),
              })
              .catch((err) => logger.warn({ err }, 'webhook: advertiser webhook failed'));
          }
        })
        .catch((err) => {
          logger.warn({ err, campaignId: session.campaign_id }, 'webhook: campaign lookup for notifications failed');
        });
    });
  },
};
