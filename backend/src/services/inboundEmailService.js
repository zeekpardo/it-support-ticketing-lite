import { prisma } from '../lib/auth.js';
import { findMatchingEmailRule } from './emailRuleMatcher.js';
import { createTicketFromEmail } from './ticketFromEmailFactory.js';
import { handleEmailReply, handleReplyAsParticipant, fetchReceivedEmail } from './emailReplyHandler.js';
import { parseEmailAddress, parseEmailName } from './emailParticipantManager.js';

/**
 * Process an inbound email from Resend webhook
 *
 * Resend webhook event.data structure:
 * {
 *   email_id: "...",
 *   from: "Name <sender@example.com>",
 *   to: ["help@groovi.support"],
 *   cc: ["person@example.com"],
 *   subject: "Need help with...",
 *   message_id: "<...>",
 *   attachments: [{ id, filename, content_type }]
 * }
 *
 * Note: The webhook does NOT include html/text body or full headers.
 * Those must be fetched via GET /emails/receiving/{email_id}.
 */
export async function processInboundEmail(payload) {
  const { email_id, from, to: toArray, cc: ccArray, subject, message_id, attachments = [] } = payload;
  const to = Array.isArray(toArray) ? toArray[0] : toArray;
  const allToAddresses = Array.isArray(toArray) ? toArray : (toArray ? [toArray] : []);
  const allCcAddresses = Array.isArray(ccArray) ? ccArray : (ccArray ? [ccArray] : []);

  console.log('[InboundEmail] Processing email from:', from, 'to:', to, 'email_id:', email_id);

  // Fetch full email content (body, headers) from Resend API
  const fullEmail = email_id ? await fetchReceivedEmail(email_id) : null;
  const html = fullEmail?.html || null;
  const text = fullEmail?.text || null;

  // Extract threading headers from the full email response
  const rawHeaders = fullEmail?.headers || [];
  // Resend returns headers as an array of { name, value } objects
  const getHeader = (name) => {
    if (Array.isArray(rawHeaders)) {
      const h = rawHeaders.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return h?.value || null;
    }
    // Fallback for key-value object format
    return rawHeaders[name] || rawHeaders[name.toLowerCase()] || null;
  };

  const messageId = message_id || getHeader('message-id');
  const inReplyTo = getHeader('in-reply-to');
  const references = getHeader('references');
  const fromName = parseEmailName(from);
  const fromAddress = parseEmailAddress(from);

  // Check for duplicate (idempotency)
  if (messageId) {
    const existing = await prisma.inboundEmail.findUnique({
      where: { messageId },
    });

    if (existing) {
      console.log('[InboundEmail] Duplicate email ignored:', messageId);
      return;
    }
  }

  // Create inbound email record
  const inboundEmail = await prisma.inboundEmail.create({
    data: {
      messageId: messageId || `generated-${Date.now()}-${Math.random()}`,
      inReplyTo,
      subject: subject || '(No Subject)',
      from: fromAddress,
      fromName,
      to,
      htmlBody: html,
      textBody: text,
      status: 'PENDING',
      receivedAt: new Date(),
    },
  });

  try {
    // Check if this is a reply to an existing ticket (email threading)
    if (inReplyTo) {
      const handled = await handleEmailReply(inboundEmail, inReplyTo);
      if (handled) {
        console.log('[InboundEmail] Processed as reply to existing ticket');
        return;
      }
    }

    // Also check References header — runs even when inReplyTo is set but didn't resolve,
    // because some clients (e.g. Outlook) set In-Reply-To to their own previous message
    // rather than our outbound email, while our message ID appears in References.
    if (references) {
      // Resend returns References as a JSON array string; fall back to space-split for plain format
      let referencedIds;
      try {
        const parsed = JSON.parse(references);
        referencedIds = Array.isArray(parsed) ? parsed : references.split(/\s+/).filter(Boolean);
      } catch {
        referencedIds = references.split(/\s+/).filter(Boolean);
      }
      for (const refId of referencedIds.reverse()) {
        const handled = await handleEmailReply(inboundEmail, refId);
        if (handled) {
          console.log('[InboundEmail] Processed as reply via References header');
          return;
        }
      }
    }

    // Last resort: sender is a known participant on an existing ticket
    const handledByParticipant = await handleReplyAsParticipant(inboundEmail);
    if (handledByParticipant) {
      console.log('[InboundEmail] Processed as reply via participant fallback');
      return;
    }

    // Find matching email rule for routing
    const emailRule = await findMatchingEmailRule(to, fromAddress);

    if (!emailRule) {
      await prisma.inboundEmail.update({
        where: { id: inboundEmail.id },
        data: {
          status: 'FAILED',
          processingError: `No matching email rule found for recipient: ${to}, sender: ${fromAddress}`,
          processedAt: new Date(),
        },
      });
      console.warn('[InboundEmail] No rule matched for:', to, fromAddress);
      return;
    }

    // Create ticket from email (pass all recipients for participant tracking)
    await createTicketFromEmail(inboundEmail, emailRule, attachments, { allToAddresses, allCcAddresses, from, emailId: email_id });
    console.log('[InboundEmail] Successfully created ticket');
  } catch (error) {
    console.error('[InboundEmail] Processing failed:', error);
    await prisma.inboundEmail.update({
      where: { id: inboundEmail.id },
      data: {
        status: 'FAILED',
        processingError: error.message || 'Unknown error',
        processedAt: new Date(),
      },
    });
  }
}
