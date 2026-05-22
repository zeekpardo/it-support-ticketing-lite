import prisma from '../../prisma.js';
import { escapeHtml } from '../../../utils/sanitize.js';
import { sendEmail, EMAIL_DOMAIN, getFrontendUrl } from '../client.js';
import { buildHtmlEmail, buildTextEmail, baseTemplate } from '../templates.js';
import { buildThreadingChain, storeOutboundEmail } from '../threading.js';
import { getFromAddress } from '../../../services/emailDomainService.js';
import { resolveS3ImageUrls } from '../../../utils/resolveS3Urls.js';

const EMAIL_IMAGE_TTL = 7 * 24 * 3600; // 7 days — long enough for emails to be read

/**
 * Resolve custom sender for an org/inbox.
 * Returns { from, domain } if a custom domain is active, otherwise null.
 */
async function resolveSender(organizationId, projectId) {
  if (!organizationId) return null;
  const sender = await getFromAddress(organizationId, projectId);
  return sender.domain ? sender : null;
}

// ==========================================
// Shared Helpers
// ==========================================

/**
 * Clean @mentions from content and truncate for email display.
 */
function prepareCommentContent(content, contentHtml = null, maxLength = 500) {
  const cleanContent = (content || '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  const truncatedText = cleanContent.length > maxLength
    ? cleanContent.substring(0, maxLength) + '...'
    : cleanContent;
  return { text: truncatedText, html: contentHtml || null };
}

async function getTicketUrl(ticketId, isPortal = false, organizationId = null) {
  const baseUrl = await getFrontendUrl(organizationId);
  return isPortal
    ? `${baseUrl}/portal/tickets/${ticketId}`
    : `${baseUrl}/admin/tickets/${ticketId}`;
}

/**
 * Format enum-style request type for display.
 * "GENERAL_SUPPORT" → "General Support"
 */
function formatRequestType(requestType) {
  return requestType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format priority level for display.
 * "HIGH" → "High"
 */
function formatPriority(priorityLevel) {
  return priorityLevel.charAt(0) + priorityLevel.slice(1).toLowerCase();
}

function truncateDescription(description, maxLength = 500) {
  return description.length > maxLength
    ? description.substring(0, maxLength) + '...'
    : description;
}

/**
 * Reusable HTML table for ticket details (request type, priority, optional subject).
 */
function ticketDetailsTable({ subject, requestType, priority }) {
  const formattedType = formatRequestType(requestType);
  const formattedPriority = formatPriority(priority);

  let rows = '';
  if (subject) {
    rows += `
      <tr>
        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 140px;">Subject</td>
        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">${escapeHtml(subject)}</td>
      </tr>`;
  }

  rows += `
      <tr>
        <td style="padding: 12px; background-color: ${subject ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 140px;">Request Type</td>
        <td style="padding: 12px; background-color: ${subject ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e5e7eb;">${escapeHtml(formattedType)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; background-color: ${subject ? '#f9fafb' : '#ffffff'}; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Priority Level</td>
        <td style="padding: 12px; background-color: ${subject ? '#f9fafb' : '#ffffff'}; border-bottom: 1px solid #e5e7eb;">${escapeHtml(formattedPriority)}</td>
      </tr>`;

  return `<table style="width: 100%; margin: 20px 0; border-collapse: collapse;">${rows}</table>`;
}

// ==========================================
// Ticket Notification Emails
// ==========================================

export async function sendTicketCommentEmail({ to, recipientName, authorName, ticketSubject, ticketId, commentContent, commentContentHtml, isPortal = false, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const ticketUrl = await getTicketUrl(ticketId, isPortal, organizationId);
  const { text: displayText, html: displayHtml } = prepareCommentContent(commentContent, commentContentHtml);
  const resolvedHtml = displayHtml ? await resolveS3ImageUrls(displayHtml, EMAIL_IMAGE_TTL) : null;

  return sendEmail({
    to,
    subject: `Re: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${escapeHtml(authorName)}</strong> commented on the ticket:`],
      quote: resolvedHtml
        ? { content: resolvedHtml, isHtml: true }
        : { content: displayText },
      button: { text: 'View Ticket', url: ticketUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${authorName} commented on the ticket "${ticketSubject}":`],
      quote: { content: displayText },
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

export async function sendTicketAssignmentEmail({ to, recipientName, ticketSubject, ticketId, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const ticketUrl = await getTicketUrl(ticketId, false, organizationId);

  return sendEmail({
    to,
    subject: `Ticket assigned: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: ['A ticket has been assigned to you:'],
      quote: { content: ticketSubject },
      button: { text: 'View Ticket', url: ticketUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`A ticket has been assigned to you: "${ticketSubject}"`],
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

export async function sendMentionEmail({ to, recipientName, authorName, ticketSubject, ticketId, commentContent, commentContentHtml, isPortal = false, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const ticketUrl = await getTicketUrl(ticketId, isPortal, organizationId);
  const { text: displayText, html: displayHtml } = prepareCommentContent(commentContent, commentContentHtml);
  const resolvedHtml = displayHtml ? await resolveS3ImageUrls(displayHtml, EMAIL_IMAGE_TTL) : null;

  return sendEmail({
    to,
    subject: `${authorName} mentioned you in: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${escapeHtml(authorName)}</strong> mentioned you in a comment:`],
      quote: resolvedHtml
        ? { content: resolvedHtml, borderColor: '#8b5cf6', isHtml: true }
        : { content: displayText, borderColor: '#8b5cf6' },
      button: { text: 'View Ticket', url: ticketUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${authorName} mentioned you in a comment on "${ticketSubject}":`],
      quote: { content: displayText },
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

export async function sendTicketSubmittedEmail({ to, recipientName, inboxName, ticketSubject, requestType, priorityLevel, description, ticketId, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const baseUrl = await getFrontendUrl(organizationId);
  const ticketUrl = `${baseUrl}/portal/tickets/${ticketId}`;
  const displayDescription = truncateDescription(description);
  const formattedRequestType = formatRequestType(requestType);
  const formattedPriority = formatPriority(priorityLevel);

  const { messageId, references, inReplyTo } = await buildThreadingChain(ticketId, { type: 'submitted', domain: sender?.domain });

  const result = await sendEmail({
    to,
    subject: `Request received: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    messageId,
    references,
    inReplyTo,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `Thank you for contacting Support for <strong>${escapeHtml(inboxName)}</strong>. Your request for <strong>${escapeHtml(ticketSubject)}</strong> has been received and is under review. Requests are prioritized and addressed based on urgency.`,
        { html: ticketDetailsTable({ requestType, priority: priorityLevel }) },
        '<strong>Description</strong>'
      ],
      quote: { content: displayDescription },
      button: { text: 'View Ticket', url: ticketUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `Thank you for contacting Support for ${inboxName}. Your request for "${ticketSubject}" has been received and is under review. Requests are prioritized and addressed based on urgency.`,
        `Request Type: ${formattedRequestType}`,
        `Priority Level: ${formattedPriority}`,
        'Description:'
      ],
      quote: { content: displayDescription },
      buttonText: 'View ticket',
      buttonUrl: ticketUrl
    })
  });

  if (result.success && !result.mock) {
    await storeOutboundEmail({
      messageId, ticketId, to,
      subject: `Request received: ${ticketSubject}`,
      emailType: 'ticket_submitted',
    });
  }

  return result;
}

export async function sendNewTicketAssignedEmail({ to, recipientName, clientName, inboxName, ticketSubject, requestType, priorityLevel, description, ticketId, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const baseUrl = await getFrontendUrl(organizationId);
  const ticketUrl = `${baseUrl}/admin/tickets/${ticketId}`;
  const displayDescription = truncateDescription(description);
  const formattedRequestType = formatRequestType(requestType);
  const formattedPriority = formatPriority(priorityLevel);

  return sendEmail({
    to,
    subject: `New ticket: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `A new support request has been submitted by <strong>${escapeHtml(clientName)}</strong> for <strong>${escapeHtml(inboxName)}</strong>.`,
        { html: ticketDetailsTable({ subject: ticketSubject, requestType, priority: priorityLevel }) },
        '<strong>Description</strong>'
      ],
      quote: { content: displayDescription },
      button: { text: 'View Ticket', url: ticketUrl },
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `A new support request has been submitted by ${clientName} for ${inboxName}.`,
        `Subject: ${ticketSubject}`,
        `Request Type: ${formattedRequestType}`,
        `Priority Level: ${formattedPriority}`,
        'Description:'
      ],
      quote: { content: displayDescription },
      buttonText: 'View ticket',
      buttonUrl: ticketUrl
    })
  });
}

// ==========================================
// Public Ticket Confirmation Email
// ==========================================

export async function sendPublicTicketConfirmationEmail({ to, recipientName, inboxName, ticketSubject, description, ticketId, magicLinkUrl, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const displayDescription = truncateDescription(description);
  const { messageId, references, inReplyTo } = await buildThreadingChain(ticketId, { type: 'submitted', domain: sender?.domain });

  const result = await sendEmail({
    to,
    subject: `Re: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    messageId,
    references,
    inReplyTo,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `Your request for <strong>${escapeHtml(inboxName)}</strong> has been submitted and is under review.`,
        '<strong>Description</strong>',
      ],
      quote: { content: displayDescription },
      button: { text: 'View Your Ticket', url: magicLinkUrl },
      showLinkFallback: true,
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `Your request for ${inboxName} has been submitted and is under review.`,
        'Description:',
      ],
      quote: { content: displayDescription },
      buttonText: 'View your ticket',
      buttonUrl: magicLinkUrl,
    })
  });

  if (result.success && !result.mock) {
    await storeOutboundEmail({
      messageId, ticketId, to,
      subject: `Re: ${ticketSubject}`,
      emailType: 'ticket_submitted',
    });
  }

  return result;
}

// ==========================================
// Threaded Email Replies
// ==========================================

export async function sendThreadedTicketReply({
  ticketId, to, recipientName, ticketSubject, commentContent, commentContentHtml, commentId, branding = {}, organizationId, projectId
}) {
  const sender = await resolveSender(organizationId, projectId);
  const { text: displayText, html: displayHtml } = prepareCommentContent(commentContent, commentContentHtml);
  const resolvedHtml = displayHtml ? await resolveS3ImageUrls(displayHtml, EMAIL_IMAGE_TTL) : null;
  const { messageId, references, inReplyTo } = await buildThreadingChain(ticketId, { type: 'reply', domain: sender?.domain });

  // Get all email participants for this ticket (CC them on the reply)
  const participants = await prisma.ticketEmailParticipant.findMany({
    where: { ticketId },
    select: { email: true },
  });

  // CC all participants except the primary recipient and our own domain
  const ccAddresses = participants
    .map(p => p.email)
    .filter(email =>
      email.toLowerCase() !== to.toLowerCase() &&
      !email.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`)
    );

  const result = await sendEmail({
    to,
    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
    subject: `Re: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    messageId,
    references,
    inReplyTo,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: resolvedHtml
        ? [{ html: resolvedHtml }]
        : [escapeHtml(displayText)],
      branding,
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [displayText],
    }),
  });

  if (result.success && !result.mock) {
    await storeOutboundEmail({
      messageId, ticketId, to, commentId,
      subject: `Re: ${ticketSubject}`,
      emailType: 'ticket_reply',
    });
  }

  return result;
}

export async function sendAutoReplyEmail({ ticketId, to, ticketSubject, autoReplyHtml, inboundMessageId, branding = {}, organizationId, projectId }) {
  const sender = await resolveSender(organizationId, projectId);
  const { messageId, references, inReplyTo } = await buildThreadingChain(ticketId, {
    type: 'auto-reply',
    extraMessageIds: inboundMessageId ? [inboundMessageId] : [],
    domain: sender?.domain,
  });

  const result = await sendEmail({
    to,
    subject: `Re: ${ticketSubject}`,
    ...(sender ? { from: sender.from } : {}),
    fromName: branding.appName,
    messageId,
    references,
    inReplyTo,
    html: baseTemplate(autoReplyHtml, branding),
    text: '', // HTML-only; email clients will render HTML
  });

  if (result.success && !result.mock) {
    await storeOutboundEmail({
      messageId, ticketId, to,
      subject: `Re: ${ticketSubject}`,
      emailType: 'auto_reply',
    });
  }

  return result;
}
