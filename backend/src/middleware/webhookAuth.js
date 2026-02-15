import crypto from 'crypto';

/**
 * Validates that webhooks are actually from Resend.
 * Resend uses Svix for webhook delivery with these headers:
 *   svix-id, svix-timestamp, svix-signature
 *
 * @see https://resend.com/docs/dashboard/webhooks/introduction
 */
export function validateResendWebhook(req, res, next) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_WEBHOOK_SECRET must be set in production');
    }
    console.warn('[Webhook] RESEND_WEBHOOK_SECRET not set - skipping signature validation');
    return next();
  }

  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Webhook] Missing Svix headers');
    return res.status(400).json({ error: 'Missing webhook signature headers' });
  }

  try {
    // Svix signs: "${svix-id}.${svix-timestamp}.${body}"
    const payload = JSON.stringify(req.body);
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

    // The webhook secret from Resend starts with "whsec_" and is base64-encoded after that prefix
    const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');

    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // Svix signature header can contain multiple signatures separated by spaces
    // Each is prefixed with version (e.g., "v1,<base64>")
    const signatures = svixSignature.split(' ');
    const matched = signatures.some(sig => {
      const [version, sigValue] = sig.split(',');
      if (version !== 'v1') return false;
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(sigValue)
        );
      } catch {
        return false;
      }
    });

    if (!matched) {
      console.error('[Webhook] Invalid signature - possible spoofing attempt');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Check timestamp to prevent replay attacks (5 minute tolerance)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(svixTimestamp, 10);
    if (Math.abs(now - ts) > 300) {
      console.error('[Webhook] Timestamp too old or too new:', svixTimestamp);
      return res.status(401).json({ error: 'Webhook timestamp out of tolerance' });
    }

    next();
  } catch (error) {
    console.error('[Webhook] Signature validation error:', error);
    return res.status(500).json({ error: 'Webhook signature validation failed' });
  }
}