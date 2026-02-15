import prisma from '../prisma.js';
import { EMAIL_DOMAIN } from './client.js';

/**
 * Generate a unique Message-ID for email threading
 * Format: <ticketId.timestamp.random@domain>
 */
export function generateMessageId(ticketId, type = 'ticket') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `<${ticketId}.${timestamp}.${random}@${EMAIL_DOMAIN}>`;
}

/**
 * Build a full threading chain for a ticket.
 * Queries all inbound and outbound emails to construct References and In-Reply-To headers.
 *
 * @param {string} ticketId
 * @param {object} [options]
 * @param {string[]} [options.extraMessageIds] - Additional message IDs to prepend (e.g. an inbound messageId not yet stored)
 * @param {string} [options.type] - Type label for the new Message-ID (e.g. 'reply', 'auto-reply', 'submitted')
 * @returns {Promise<{ messageId: string, references: string|undefined, inReplyTo: string|undefined }>}
 */
export async function buildThreadingChain(ticketId, { extraMessageIds = [], type = 'ticket' } = {}) {
  const messageId = generateMessageId(ticketId, type);

  // Fetch the initial inbound email that created the ticket
  const initialInbound = await prisma.inboundEmail.findUnique({
    where: { ticketId },
    select: { messageId: true },
  });

  // Fetch inbound email replies (linked via comments on this ticket)
  const inboundReplies = await prisma.inboundEmail.findMany({
    where: { comment: { ticketId }, status: 'PROCESSED' },
    select: { messageId: true },
  });

  // Fetch previous outbound emails
  const outboundEmails = await prisma.outboundEmail.findMany({
    where: { ticketId },
    orderBy: { sentAt: 'asc' },
    select: { messageId: true },
  });

  // Combine all message IDs for the References header
  const allMessageIds = [
    ...extraMessageIds,
    initialInbound?.messageId,
    ...inboundReplies.map(e => e.messageId),
    ...outboundEmails.map(e => e.messageId),
  ].filter(Boolean);

  return {
    messageId,
    references: allMessageIds.length > 0 ? allMessageIds.join(' ') : undefined,
    inReplyTo: allMessageIds[allMessageIds.length - 1] || undefined,
  };
}

/**
 * Store an outbound email record for future threading and reply routing.
 */
export async function storeOutboundEmail({ messageId, ticketId, to, subject, emailType, commentId }) {
  return prisma.outboundEmail.create({
    data: {
      messageId,
      ticketId,
      to,
      subject,
      emailType,
      commentId: commentId || null,
      sentAt: new Date(),
    },
  });
}
