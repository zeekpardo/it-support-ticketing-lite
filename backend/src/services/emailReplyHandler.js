import { prisma } from '../lib/auth.js';
import { sanitizeEmailBody } from '../utils/htmlSanitizer.js';
import { findOrCreateClient, parseFullName } from './emailParticipantManager.js';

/**
 * Fetch full email content from Resend's Received Emails API.
 * The webhook only includes metadata; body/headers require a separate API call.
 */
export async function fetchReceivedEmail(emailId) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[InboundEmail] No RESEND_API_KEY set, cannot fetch email body');
    return null;
  }

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[InboundEmail] Failed to fetch email from Resend:', response.status, errorText);
    return null;
  }

  return response.json();
}

/**
 * Handle email reply - add as comment to existing ticket
 * Returns true if successfully handled as a reply, false otherwise
 */
export async function handleEmailReply(inboundEmail, inReplyToMessageId) {
  if (!inReplyToMessageId) return false;

  // Clean up the message ID (remove angle brackets if present)
  const cleanMessageId = inReplyToMessageId.replace(/[<>]/g, '');

  // Look up this Message-ID in our outbound emails
  const outboundEmail = await prisma.outboundEmail.findUnique({
    where: { messageId: cleanMessageId },
    include: { ticket: true },
  });

  if (!outboundEmail?.ticket) {
    // Not a reply to our outbound email — also check if sender is a known participant
    const participant = await prisma.ticketEmailParticipant.findFirst({
      where: { email: inboundEmail.from.toLowerCase() },
      include: { ticket: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!participant?.ticket) {
      return false;
    }

    // Found by participant lookup — continue with that ticket
    return handleParticipantReply(inboundEmail, participant.ticket, participant.memberId);
  }

  const ticket = outboundEmail.ticket;

  // Find client member by email — or auto-create if they're a known participant
  let client = await prisma.member.findFirst({
    where: {
      organizationId: ticket.organizationId,
      user: { email: inboundEmail.from },
    },
  });

  if (!client) {
    // Check if they're a known email participant on this ticket
    const participant = await prisma.ticketEmailParticipant.findUnique({
      where: { ticketId_email: { ticketId: ticket.id, email: inboundEmail.from.toLowerCase() } },
    });

    if (participant) {
      // Auto-create client for known participant
      const { firstName, lastName } = parseFullName(inboundEmail.fromName || inboundEmail.from);
      client = await findOrCreateClient(inboundEmail.from, firstName, lastName, ticket.organizationId, ticket.projectId);

      // Update participant with member ID
      await prisma.ticketEmailParticipant.update({
        where: { id: participant.id },
        data: { memberId: client.id },
      });
    } else {
      console.warn('[InboundEmail] Reply from unknown email:', inboundEmail.from);
      return false;
    }
  }

  // Sanitize content
  const content = sanitizeEmailBody(inboundEmail.htmlBody || inboundEmail.textBody || '');

  // Create comment
  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: client.id,
      content,
      isInternal: false, // Client comments are always public
    },
  });

  // Link inbound email to comment
  await prisma.inboundEmail.update({
    where: { id: inboundEmail.id },
    data: {
      commentId: comment.id,
      status: 'PROCESSED',
      processedAt: new Date(),
    },
  });

  // Auto-update ticket status to IN_PROGRESS when client replies via email
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'IN_PROGRESS' },
  });

  console.log('[InboundEmail] Created comment from reply:', comment.id, 'on ticket:', ticket.id);
  return true;
}

/**
 * Handle a reply from a known email participant (fallback when threading headers don't match outbound emails)
 */
async function handleParticipantReply(inboundEmail, ticket, memberId) {
  let client;

  if (memberId) {
    client = await prisma.member.findUnique({ where: { id: memberId } });
  }

  if (!client) {
    const { firstName, lastName } = parseFullName(inboundEmail.fromName || inboundEmail.from);
    client = await findOrCreateClient(inboundEmail.from, firstName, lastName, ticket.organizationId, ticket.projectId);
  }

  const content = sanitizeEmailBody(inboundEmail.htmlBody || inboundEmail.textBody || '');

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: client.id,
      content,
      isInternal: false,
    },
  });

  await prisma.inboundEmail.update({
    where: { id: inboundEmail.id },
    data: {
      commentId: comment.id,
      status: 'PROCESSED',
      processedAt: new Date(),
    },
  });

  // Auto-update ticket status to IN_PROGRESS when client replies via email
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'IN_PROGRESS' },
  });

  console.log('[InboundEmail] Created comment from participant reply:', comment.id, 'on ticket:', ticket.id);
  return true;
}
