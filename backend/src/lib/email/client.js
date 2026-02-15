import { Resend } from 'resend';

// Lazy-load Resend client to avoid initialization errors when API key is not set
let resend = null;
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export const FROM_EMAIL = process.env.FROM_EMAIL || 'Groovi Support <noreply@resend.dev>';
export const APP_NAME = process.env.APP_NAME || 'Groovi Support';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
export const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'groovi.support';

/**
 * Send an email using Resend with optional threading headers
 */
export async function sendEmail({ to, cc, subject, html, text, messageId, references, inReplyTo, fromName }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] No RESEND_API_KEY set, logging email instead:');
    console.log({ to, cc, subject, text: text?.substring(0, 200), messageId });
    return { success: true, mock: true };
  }

  try {
    const client = getResendClient();

    // Build headers for email threading
    const headers = {};
    if (messageId) headers['Message-ID'] = messageId;
    if (references) headers['References'] = references;
    if (inReplyTo) headers['In-Reply-To'] = inReplyTo;

    // Override display name in FROM if branding provides one
    const from = fromName
      ? FROM_EMAIL.replace(/^[^<]*</, `${fromName} <`)
      : FROM_EMAIL;

    const { data, error } = await client.emails.send({
      from,
      to,
      ...(cc && cc.length > 0 && { cc }),
      subject,
      html,
      text,
      ...(Object.keys(headers).length > 0 && { headers })
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return { success: false, error };
    }

    console.log('[Email] Sent successfully:', data?.id, messageId ? `(Message-ID: ${messageId})` : '');
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Error:', err);
    return { success: false, error: err };
  }
}
