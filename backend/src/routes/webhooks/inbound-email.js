import express from 'express';
import { processInboundEmail } from '../../services/inboundEmailService.js';
import { validateResendWebhook } from '../../middleware/webhookAuth.js';

const router = express.Router();

// This route is mounted before the global express.json() middleware
// so we need our own body parser here
router.use(express.json());

/**
 * Resend inbound email webhook
 * POST /api/webhooks/inbound-email
 *
 * Receives POST requests from Resend when emails arrive
 * Resend requires a 200 response within 5 seconds
 */
router.post('/', validateResendWebhook, async (req, res) => {
  try {
    const event = req.body;
    console.log('[Webhook] Received event:', event.type, '| email_id:', event.data?.email_id);

    // Only process email.received events
    if (event.type !== 'email.received') {
      console.log('[Webhook] Ignoring event type:', event.type);
      return res.status(200).json({ received: true });
    }

    // Acknowledge receipt immediately (Resend expects 200 within 5s)
    res.status(200).json({ received: true });

    // Process email asynchronously in the background
    setImmediate(async () => {
      try {
        await processInboundEmail(event.data);
      } catch (error) {
        console.error('[Webhook] Error processing inbound email:', error);
      }
    });
  } catch (error) {
    console.error('[Webhook] Error handling webhook:', error);
    // Still return 200 to prevent Resend from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;
