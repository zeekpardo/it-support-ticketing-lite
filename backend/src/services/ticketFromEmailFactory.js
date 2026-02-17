import { prisma } from '../lib/auth.js';
import { sanitizeEmailBody, sanitizeEmailHtml } from '../utils/htmlSanitizer.js';
import { isStorageConfigured } from '../lib/storage.js';
import { createNotification } from './notificationService.js';
import { sendAutoReplyEmail, getOrgBranding } from '../lib/email/index.js';
import { findOrCreateClient, storeEmailParticipants, parseFullName, parseEmailAddress } from './emailParticipantManager.js';
import { downloadAndStoreAttachments } from './attachmentProcessor.js';

/**
 * Create a support ticket from an inbound email
 */
export async function createTicketFromEmail(inboundEmail, emailRule, attachments, { allToAddresses = [], allCcAddresses = [], from: rawFrom, emailId } = {}) {
  const { from, fromName, subject, htmlBody, textBody } = inboundEmail;
  const { inbox } = emailRule;
  const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'groovi.support';

  // Parse sender name into first/last name
  const { firstName, lastName } = parseFullName(fromName || from);

  // Find or create client member
  const client = await findOrCreateClient(from, firstName, lastName, inbox.organizationId, inbox.id);

  // Get default stage for inbox
  const defaultStage = await prisma.ticketStage.findFirst({
    where: { inboxId: inbox.id, isDefault: true },
  });

  // Sanitize email body for description
  const description = sanitizeEmailBody(htmlBody || textBody || '');

  // Calculate due date based on default priority (MEDIUM)
  const dueDays = inbox.dueDateMediumDays;
  const dueDate = dueDays != null ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000) : null;

  // Create ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: inbox.organizationId,
      inboxId: inbox.id,
      clientId: client.id,
      stageId: defaultStage?.id || null,
      ownerId: inbox.defaultAssigneeId,
      firstName,
      lastName,
      email: from,
      phone: null,
      subject: subject || '(No Subject)',
      requestType: 'GENERAL_SUPPORT',
      priorityLevel: 'MEDIUM',
      description,
      dueDate,
    },
  });

  // Link inbound email to ticket
  await prisma.inboundEmail.update({
    where: { id: inboundEmail.id },
    data: {
      emailRuleId: emailRule.id,
      ticketId: ticket.id,
      status: 'PROCESSED',
      processedAt: new Date(),
    },
  });

  // Store email participants (sender + TO recipients + CC recipients)
  await storeEmailParticipants(ticket.id, {
    from: rawFrom || from,
    toAddresses: allToAddresses,
    ccAddresses: allCcAddresses,
    emailDomain: EMAIL_DOMAIN,
    organizationId: inbox.organizationId,
    inboxId: inbox.id,
    primaryClientId: client.id,
  });

  // Download and store email attachments, get CID→S3 key map for inline images
  let cidToS3Map = new Map();
  if (emailId && isStorageConfigured()) {
    cidToS3Map = await downloadAndStoreAttachments(emailId, ticket.id, client.id);
  }

  // Process HTML body with inline image references resolved
  if (htmlBody && cidToS3Map.size > 0) {
    const descriptionHtml = sanitizeEmailHtml(htmlBody, cidToS3Map);
    if (descriptionHtml) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { descriptionHtml },
      });
    }
  }

  // Notify the assigned staff member
  if (inbox.defaultAssigneeId) {
    try {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: inbox.defaultAssigneeId,
        organizationId: inbox.organizationId,
        data: {
          ticketId: ticket.id,
          ticketSubject: subject || '(No Subject)',
          inboxName: inbox.name,
          requestType: 'GENERAL_SUPPORT',
          priorityLevel: 'MEDIUM',
          description,
          clientName: `${firstName} ${lastName}`.trim(),
          projectId: inbox.id,
        },
        entityType: 'ticket',
        entityId: ticket.id,
      });
    } catch (notifError) {
      console.error('[InboundEmail] Error sending new ticket notification:', notifError);
    }
  }

  // Send auto-reply to client if enabled for this inbox
  if (inbox.autoReplyEnabled && inbox.autoReplyHtml) {
    try {
      const branding = await getOrgBranding(inbox.organizationId);
      await sendAutoReplyEmail({
        ticketId: ticket.id,
        to: from,
        ticketSubject: subject || '(No Subject)',
        autoReplyHtml: inbox.autoReplyHtml,
        inboundMessageId: inboundEmail.messageId,
        branding,
        organizationId: inbox.organizationId,
        projectId: inbox.id,
      });
    } catch (autoReplyError) {
      console.error('[InboundEmail] Error sending auto-reply:', autoReplyError);
    }
  }

  console.log('[InboundEmail] Created ticket:', ticket.id);
  return ticket;
}
