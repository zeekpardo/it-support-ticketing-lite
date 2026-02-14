import { Resend } from 'resend';
import { prisma } from './auth.js';

// Lazy-load Resend client to avoid initialization errors when API key is not set
let resend = null;
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'Groovi Support <noreply@resend.dev>';
const APP_NAME = process.env.APP_NAME || 'Groovi Support';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'groovi.support';

/**
 * Generate a unique Message-ID for email threading
 * Format: <ticketId.timestamp.random@domain>
 */
function generateMessageId(ticketId, type = 'ticket') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `<${ticketId}.${timestamp}.${random}@${EMAIL_DOMAIN}>`;
}

// ==========================================
// Email Template System (DRY & Modular)
// ==========================================

/**
 * Base email wrapper - provides consistent styling for all emails
 */
function baseTemplate(content) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      ${content}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
    </div>
  `;
}

/**
 * Primary action button component
 */
function buttonComponent(text, url, color = '#2563eb') {
  return `
    <p style="margin: 30px 0;">
      <a href="${url}" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        ${text}
      </a>
    </p>
  `;
}

/**
 * Link fallback text component
 */
function linkFallback(url) {
  return `
    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #6b7280; word-break: break-all;">${url}</p>
  `;
}

/**
 * Quote/content block component (for comments, descriptions, etc.)
 */
function quoteBlock(content, borderColor = '#2563eb') {
  return `
    <div style="background-color: #f9fafb; border-left: 4px solid ${borderColor}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; white-space: pre-wrap;">${content}</p>
    </div>
  `;
}

/**
 * Greeting component
 */
function greeting(name) {
  return `<p>Hi ${name || 'there'},</p>`;
}

/**
 * Header/title component
 */
function headerComponent(text) {
  return `<h2>${text}</h2>`;
}

/**
 * Build HTML email from components
 */
function buildHtmlEmail({ header, greeting: greetingName, paragraphs = [], quote, button, showLinkFallback = false }) {
  let content = '';

  if (header) {
    content += headerComponent(header);
  }

  if (greetingName !== false) {
    content += greeting(greetingName);
  }

  for (const p of paragraphs) {
    if (typeof p === 'string') {
      content += `<p>${p}</p>`;
    } else {
      // Allow custom HTML
      content += p.html;
    }
  }

  if (quote) {
    content += quoteBlock(quote.content, quote.borderColor);
  }

  if (button) {
    content += buttonComponent(button.text, button.url, button.color);
  }

  if (showLinkFallback && button) {
    content += linkFallback(button.url);
  }

  return baseTemplate(content);
}

/**
 * Build plain text email
 */
function buildTextEmail({ greeting: greetingName, paragraphs = [], quote, buttonText, buttonUrl }) {
  let text = '';

  if (greetingName !== false) {
    text += `Hi ${greetingName || 'there'},\n\n`;
  }

  for (const p of paragraphs) {
    if (typeof p === 'string') {
      text += `${p}\n\n`;
    } else if (p.text) {
      text += `${p.text}\n\n`;
    }
  }

  if (quote) {
    text += `${quote.content}\n\n`;
  }

  if (buttonText && buttonUrl) {
    text += `${buttonText}: ${buttonUrl}`;
  }

  return text.trim();
}

/**
 * Send an email using Resend with optional threading headers
 */
export async function sendEmail({ to, subject, html, text, messageId, references, inReplyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] No RESEND_API_KEY set, logging email instead:');
    console.log({ to, subject, text: text?.substring(0, 200), messageId });
    return { success: true, mock: true };
  }

  try {
    const client = getResendClient();

    // Build headers for email threading
    const headers = {};
    if (messageId) {
      headers['Message-ID'] = messageId;
    }
    if (references) {
      headers['References'] = references;
    }
    if (inReplyTo) {
      headers['In-Reply-To'] = inReplyTo;
    }

    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
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

/**
 * Send email verification email
 */
export async function sendVerificationEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Verify your email - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: 'Verify your email address',
      greeting: user.name,
      paragraphs: [
        `Thanks for signing up for ${APP_NAME}! Please verify your email address by clicking the button below:`,
        "If you didn't create an account, you can safely ignore this email."
      ],
      button: { text: 'Verify Email', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: user.name,
      paragraphs: [
        { text: `Verify your email address\n\nThanks for signing up for ${APP_NAME}! Please verify your email by visiting:` },
        "If you didn't create an account, you can safely ignore this email."
      ],
      buttonText: 'Verify your email',
      buttonUrl: url
    })
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Reset your password - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: 'Reset your password',
      greeting: user.name,
      paragraphs: [
        'We received a request to reset your password. Click the button below to choose a new one:',
        'This link will expire in 1 hour.',
        "If you didn't request a password reset, you can safely ignore this email."
      ],
      button: { text: 'Reset Password', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: user.name,
      paragraphs: [
        'Reset your password\n\nWe received a request to reset your password. Visit this link to choose a new one:',
        'This link will expire in 1 hour.',
        "If you didn't request a password reset, you can safely ignore this email."
      ],
      buttonText: 'Reset password',
      buttonUrl: url
    })
  });
}

/**
 * Send organization invitation email
 */
export async function sendInvitationEmail({ email, inviterName, organizationName, inviteUrl }) {
  return sendEmail({
    to: email,
    subject: `You've been invited to ${organizationName} - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: "You've been invited!",
      greeting: null,
      paragraphs: [
        `<strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${APP_NAME}.`
      ],
      button: { text: 'Accept Invitation', url: inviteUrl },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: null,
      paragraphs: [
        "You've been invited!",
        `${inviterName} has invited you to join ${organizationName} on ${APP_NAME}.`
      ],
      buttonText: 'Accept the invitation',
      buttonUrl: inviteUrl
    })
  });
}

/**
 * Send magic link email for passwordless authentication
 */
export async function sendMagicLinkEmail({ email, url }) {
  return sendEmail({
    to: email,
    subject: `Sign in to ${APP_NAME}`,
    html: buildHtmlEmail({
      header: `Sign in to ${APP_NAME}`,
      greeting: null,
      paragraphs: [
        'Click the button below to sign in to your account. This link will expire in 5 minutes.',
        "If you didn't request this link, you can safely ignore this email."
      ],
      button: { text: 'Sign In', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: null,
      paragraphs: [
        `Sign in to ${APP_NAME}`,
        'Click the link below to sign in to your account. This link will expire in 5 minutes.',
        "If you didn't request this link, you can safely ignore this email."
      ],
      buttonText: 'Sign in',
      buttonUrl: url
    })
  });
}

// ==========================================
// Ticket Notification Emails
// ==========================================

/**
 * Helper to clean and truncate comment content for emails
 */
function prepareCommentContent(content, maxLength = 500) {
  // Strip @mentions from content for email display
  const cleanContent = content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  // Truncate long comments
  return cleanContent.length > maxLength
    ? cleanContent.substring(0, maxLength) + '...'
    : cleanContent;
}

/**
 * Helper to build ticket URL
 */
function getTicketUrl(ticketId, isPortal = false) {
  return isPortal
    ? `${FRONTEND_URL}/portal/tickets/${ticketId}`
    : `${FRONTEND_URL}/admin/tickets/${ticketId}`;
}

/**
 * Send ticket comment notification email
 */
export async function sendTicketCommentEmail({ to, recipientName, authorName, ticketSubject, ticketId, commentContent, isPortal = false }) {
  const ticketUrl = getTicketUrl(ticketId, isPortal);
  const displayContent = prepareCommentContent(commentContent);

  return sendEmail({
    to,
    subject: `Re: ${ticketSubject}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${authorName}</strong> commented on the ticket:`],
      quote: { content: displayContent },
      button: { text: 'View Ticket', url: ticketUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${authorName} commented on the ticket "${ticketSubject}":`],
      quote: { content: displayContent },
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

/**
 * Send ticket assignment notification email
 */
export async function sendTicketAssignmentEmail({ to, recipientName, ticketSubject, ticketId }) {
  const ticketUrl = getTicketUrl(ticketId, false);

  return sendEmail({
    to,
    subject: `Ticket assigned: ${ticketSubject}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: ['A ticket has been assigned to you:'],
      quote: { content: ticketSubject },
      button: { text: 'View Ticket', url: ticketUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`A ticket has been assigned to you: "${ticketSubject}"`],
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

/**
 * Send mention notification email
 */
export async function sendMentionEmail({ to, recipientName, authorName, ticketSubject, ticketId, commentContent, isPortal = false }) {
  const ticketUrl = getTicketUrl(ticketId, isPortal);
  const displayContent = prepareCommentContent(commentContent);

  return sendEmail({
    to,
    subject: `${authorName} mentioned you in: ${ticketSubject}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${authorName}</strong> mentioned you in a comment:`],
      quote: { content: displayContent, borderColor: '#8b5cf6' },
      button: { text: 'View Ticket', url: ticketUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${authorName} mentioned you in a comment on "${ticketSubject}":`],
      quote: { content: displayContent },
      buttonText: 'View the ticket',
      buttonUrl: ticketUrl
    })
  });
}

/**
 * Send software access request notification email (to staff)
 */
export async function sendAccessRequestEmail({ to, recipientName, requesterName, softwareName, projectId, projectSoftwareId }) {
  const requestUrl = `${FRONTEND_URL}/admin/projects/${projectId}/software/${projectSoftwareId}`;

  return sendEmail({
    to,
    subject: `Software access request: ${softwareName}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [`<strong>${requesterName}</strong> has requested access to <strong>${softwareName}</strong>.`],
      button: { text: 'Review Request', url: requestUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`${requesterName} has requested access to ${softwareName}.`],
      buttonText: 'Review the request',
      buttonUrl: requestUrl
    })
  });
}

/**
 * Send ticket submission confirmation email (to client)
 */
export async function sendTicketSubmittedEmail({ to, recipientName, projectName, ticketSubject, requestType, priorityLevel, description, ticketId }) {
  const ticketUrl = `${FRONTEND_URL}/portal/tickets/${ticketId}`;

  // Format request type for display (e.g., "GENERAL_SUPPORT" -> "General Support")
  const formattedRequestType = requestType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Format priority level for display
  const formattedPriority = priorityLevel.charAt(0) + priorityLevel.slice(1).toLowerCase();

  // Truncate description if too long
  const displayDescription = description.length > 500
    ? description.substring(0, 500) + '...'
    : description;

  // Generate Message-ID for threading
  const messageId = generateMessageId(ticketId, 'submitted');

  // Get previous outbound emails for this ticket for threading
  const previousEmails = await prisma.outboundEmail.findMany({
    where: { ticketId },
    orderBy: { sentAt: 'asc' },
    select: { messageId: true }
  });

  const references = previousEmails.map(e => e.messageId).join(' ');
  const inReplyTo = previousEmails[previousEmails.length - 1]?.messageId;

  const result = await sendEmail({
    to,
    subject: `Request received: ${ticketSubject}`,
    messageId,
    references,
    inReplyTo,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `Thank you for contacting Support for <strong>${projectName}</strong>. Your request for <strong>${ticketSubject}</strong> has been received and is under review. Requests are prioritized and addressed based on urgency.`,
        { html: `
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 140px;">Request Type</td>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">${formattedRequestType}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Priority Level</td>
              <td style="padding: 12px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">${formattedPriority}</td>
            </tr>
          </table>
        ` },
        '<strong>Description</strong>'
      ],
      quote: { content: displayDescription },
      button: { text: 'View Ticket', url: ticketUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `Thank you for contacting Support for ${projectName}. Your request for "${ticketSubject}" has been received and is under review. Requests are prioritized and addressed based on urgency.`,
        `Request Type: ${formattedRequestType}`,
        `Priority Level: ${formattedPriority}`,
        'Description:'
      ],
      quote: { content: displayDescription },
      buttonText: 'View ticket',
      buttonUrl: ticketUrl
    })
  });

  // Store outbound email for future threading
  if (result.success && !result.mock) {
    await prisma.outboundEmail.create({
      data: {
        messageId,
        ticketId,
        to,
        subject: `Request received: ${ticketSubject}`,
        emailType: 'ticket_submitted',
        sentAt: new Date(),
      }
    });
  }

  return result;
}

/**
 * Send new ticket notification email (to assignee/staff)
 */
export async function sendNewTicketAssignedEmail({ to, recipientName, clientName, projectName, ticketSubject, requestType, priorityLevel, description, ticketId }) {
  const ticketUrl = `${FRONTEND_URL}/admin/tickets/${ticketId}`;

  // Format request type for display (e.g., "GENERAL_SUPPORT" -> "General Support")
  const formattedRequestType = requestType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Format priority level for display
  const formattedPriority = priorityLevel.charAt(0) + priorityLevel.slice(1).toLowerCase();

  // Truncate description if too long
  const displayDescription = description.length > 500
    ? description.substring(0, 500) + '...'
    : description;

  return sendEmail({
    to,
    subject: `New ticket: ${ticketSubject}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        `A new support request has been submitted by <strong>${clientName}</strong> for <strong>${projectName}</strong>.`,
        { html: `
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 140px;">Subject</td>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">${ticketSubject}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Request Type</td>
              <td style="padding: 12px; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">${formattedRequestType}</td>
            </tr>
            <tr>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Priority Level</td>
              <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">${formattedPriority}</td>
            </tr>
          </table>
        ` },
        '<strong>Description</strong>'
      ],
      quote: { content: displayDescription },
      button: { text: 'View Ticket', url: ticketUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [
        `A new support request has been submitted by ${clientName} for ${projectName}.`,
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

/**
 * Send software access status update email (to client)
 */
export async function sendAccessStatusEmail({ to, recipientName, softwareName, status }) {
  const requestsUrl = `${FRONTEND_URL}/portal/software/requests`;

  const statusMessages = {
    APPROVED: { verb: 'approved', color: '#22c55e' },
    DECLINED: { verb: 'declined', color: '#ef4444' },
    REVOKED: { verb: 'revoked', color: '#ef4444' },
  };

  const { verb, color } = statusMessages[status] || { verb: 'updated', color: '#6b7280' };

  return sendEmail({
    to,
    subject: `Software access ${verb}: ${softwareName}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [
        { html: `<p>Your access request for <strong>${softwareName}</strong> has been <span style="color: ${color}; font-weight: 600;">${verb}</span>.</p>` }
      ],
      button: { text: 'View My Requests', url: requestsUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [`Your access request for ${softwareName} has been ${verb}.`],
      buttonText: 'View your requests',
      buttonUrl: requestsUrl
    })
  });
}

/**
 * Send software renewal reminder email (to software admins)
 */
export async function sendRenewalReminderEmail({
  to, recipientName, softwareName, daysUntilRenewal, renewalDate,
  cost, billingCycle, projectName, projectId, projectSoftwareId
}) {
  const softwareUrl = `${FRONTEND_URL}/admin/projects/${projectId}/software/${projectSoftwareId}`;
  const urgencyColor = daysUntilRenewal <= 3 ? '#ef4444' : '#f59e0b';

  const paragraphs = [
    { html: `<p><strong>${softwareName}</strong> for project <strong>${projectName}</strong> renews on <span style="color: ${urgencyColor}; font-weight: 600;">${renewalDate}</span> (in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}).</p>` }
  ];

  if (cost) {
    paragraphs.push(`Cost: $${cost} (${billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly'})`);
  }

  const textParagraphs = [
    `${softwareName} for project ${projectName} renews on ${renewalDate} (in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}).`
  ];

  if (cost) {
    textParagraphs.push(`Cost: $${cost} (${billingCycle === 'MONTHLY' ? 'Monthly' : 'Yearly'})`);
  }

  return sendEmail({
    to,
    subject: `Software renewal in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}: ${softwareName}`,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs,
      button: { text: 'View Software Details', url: softwareUrl }
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: textParagraphs,
      buttonText: 'View software details',
      buttonUrl: softwareUrl
    })
  });
}

// ==========================================
// Threaded Email Replies
// ==========================================

/**
 * Send a threaded email reply for email-originated tickets.
 * Used when smart channel detection determines the client prefers email.
 * Sends a natural email (just the comment content) with proper threading headers.
 */
export async function sendThreadedTicketReply({
  ticketId, to, recipientName, ticketSubject, commentContent, commentId
}) {
  const displayContent = prepareCommentContent(commentContent);
  const messageId = generateMessageId(ticketId, 'reply');

  // Build threading chain from ALL emails on this ticket
  // 1. The initial inbound email (created the ticket)
  const initialInbound = await prisma.inboundEmail.findUnique({
    where: { ticketId },
    select: { messageId: true },
  });

  // 2. Inbound email replies (linked via comments on this ticket)
  const inboundReplies = await prisma.inboundEmail.findMany({
    where: { comment: { ticketId }, status: 'PROCESSED' },
    select: { messageId: true },
  });

  // 3. Previous outbound emails
  const outboundEmails = await prisma.outboundEmail.findMany({
    where: { ticketId },
    orderBy: { sentAt: 'asc' },
    select: { messageId: true },
  });

  // Combine all message IDs for References header
  const allMessageIds = [
    initialInbound?.messageId,
    ...inboundReplies.map(e => e.messageId),
    ...outboundEmails.map(e => e.messageId),
  ].filter(Boolean);

  const references = allMessageIds.join(' ') || undefined;
  const inReplyTo = allMessageIds[allMessageIds.length - 1] || undefined;

  // Send natural email reply (no "X commented" wrapper, no View Ticket button)
  const result = await sendEmail({
    to,
    subject: `Re: ${ticketSubject}`,
    messageId,
    references,
    inReplyTo,
    html: buildHtmlEmail({
      greeting: recipientName,
      paragraphs: [displayContent],
    }),
    text: buildTextEmail({
      greeting: recipientName,
      paragraphs: [displayContent],
    }),
  });

  // Store outbound email for future threading + reply routing
  if (result.success && !result.mock) {
    await prisma.outboundEmail.create({
      data: {
        messageId,
        ticketId,
        commentId: commentId || null,
        to,
        subject: `Re: ${ticketSubject}`,
        emailType: 'ticket_reply',
        sentAt: new Date(),
      },
    });
  }

  return result;
}

// ==========================================
// User Account Emails
// ==========================================

/**
 * Send welcome email when admin creates a user account
 */
export async function sendWelcomeEmail({ to, name, organizationName, email, temporaryPassword }) {
  const loginUrl = `${FRONTEND_URL}/sign-in`;

  return sendEmail({
    to,
    subject: `Welcome to ${organizationName} - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: `Welcome to ${organizationName}!`,
      greeting: name,
      paragraphs: [
        `An account has been created for you on <strong>${APP_NAME}</strong> by your organization administrator.`,
        'You can sign in using the credentials below:',
        { html: `
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px;">
            <tr>
              <td style="padding: 12px; font-weight: 600; width: 140px;">Email:</td>
              <td style="padding: 12px;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: 600; border-top: 1px solid #e5e7eb;">Password:</td>
              <td style="padding: 12px; border-top: 1px solid #e5e7eb; font-family: monospace;">${temporaryPassword}</td>
            </tr>
          </table>
        ` },
        '<strong style="color: #f59e0b;">⚠️ For security, please change your password after your first login.</strong>'
      ],
      button: { text: 'Sign In', url: loginUrl },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: name,
      paragraphs: [
        `Welcome to ${organizationName}!`,
        `An account has been created for you on ${APP_NAME} by your organization administrator.`,
        'You can sign in using these credentials:',
        `Email: ${email}`,
        `Password: ${temporaryPassword}`,
        '⚠️ For security, please change your password after your first login.'
      ],
      buttonText: 'Sign in',
      buttonUrl: loginUrl
    })
  });
}
