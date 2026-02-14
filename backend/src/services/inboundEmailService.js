import { prisma } from '../lib/auth.js';
import { sanitizeEmailBody } from '../utils/htmlSanitizer.js';
import crypto from 'crypto';

const generateId = () => crypto.randomBytes(16).toString('hex');

/**
 * Fetch full email content from Resend's Received Emails API.
 * The webhook only includes metadata; body/headers require a separate API call.
 */
async function fetchReceivedEmail(emailId) {
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

    // Also check References header for threading
    if (!inReplyTo && references) {
      const referencedIds = references.split(/\s+/).filter(Boolean);
      for (const refId of referencedIds.reverse()) {
        const handled = await handleEmailReply(inboundEmail, refId);
        if (handled) {
          console.log('[InboundEmail] Processed as reply via References header');
          return;
        }
      }
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
    await createTicketFromEmail(inboundEmail, emailRule, attachments, { allToAddresses, allCcAddresses, from });
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

/**
 * Find email rule matching the recipient address and/or sender domain
 * Priority order: EXACT_ADDRESS > DOMAIN > CATCH_ALL
 */
async function findMatchingEmailRule(toAddress, fromAddress) {
  const fromDomain = '@' + fromAddress.split('@')[1];

  // Get all active rules, ordered by priority (highest first)
  const rules = await prisma.emailRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
    include: {
      project: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          defaultAssigneeId: true,
          dueDateLowDays: true,
          dueDateMediumDays: true,
          dueDateHighDays: true,
          dueDateUrgentDays: true,
        },
      },
    },
  });

  // Try to match rules in priority order
  for (const rule of rules) {
    if (rule.matchType === 'EXACT_ADDRESS') {
      if (rule.matchValue && rule.matchValue.toLowerCase() === toAddress.toLowerCase()) {
        console.log('[InboundEmail] Matched EXACT_ADDRESS rule:', rule.matchValue);
        return rule;
      }
    } else if (rule.matchType === 'DOMAIN') {
      if (rule.matchValue && rule.matchValue.toLowerCase() === fromDomain.toLowerCase()) {
        console.log('[InboundEmail] Matched DOMAIN rule:', rule.matchValue);
        return rule;
      }
    }
  }

  // Fall back to catch-all rule
  const catchAllRule = rules.find((r) => r.matchType === 'CATCH_ALL');
  if (catchAllRule) {
    console.log('[InboundEmail] Matched CATCH_ALL rule');
  }
  return catchAllRule || null;
}

/**
 * Create a support ticket from an inbound email
 */
async function createTicketFromEmail(inboundEmail, emailRule, attachments, { allToAddresses = [], allCcAddresses = [], from: rawFrom } = {}) {
  const { from, fromName, subject, htmlBody, textBody } = inboundEmail;
  const { project } = emailRule;
  const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'groovi.support';

  // Parse sender name into first/last name
  const { firstName, lastName } = parseFullName(fromName || from);

  // Find or create client member
  const client = await findOrCreateClient(from, firstName, lastName, project.organizationId, project.id);

  // Get default stage for project
  const defaultStage = await prisma.ticketStage.findFirst({
    where: { projectId: project.id, isDefault: true },
  });

  // Sanitize email body for description
  const description = sanitizeEmailBody(htmlBody || textBody || '');

  // Calculate due date based on default priority (MEDIUM)
  const dueDays = project.dueDateMediumDays;
  const dueDate = dueDays != null ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000) : null;

  // Create ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: project.organizationId,
      projectId: project.id,
      clientId: client.id,
      stageId: defaultStage?.id || null,
      ownerId: project.defaultAssigneeId,
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
    organizationId: project.organizationId,
    projectId: project.id,
    primaryClientId: client.id,
  });

  // TODO: Handle attachments (save to disk, create TicketAttachment records)
  // TODO: Send notification to assignee if any

  console.log('[InboundEmail] Created ticket:', ticket.id);
  return ticket;
}

/**
 * Handle email reply - add as comment to existing ticket
 * Returns true if successfully handled as a reply, false otherwise
 */
async function handleEmailReply(inboundEmail, inReplyToMessageId) {
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

  console.log('[InboundEmail] Created comment from participant reply:', comment.id, 'on ticket:', ticket.id);
  return true;
}

/**
 * Find existing client or create new one with project assignment
 */
async function findOrCreateClient(email, firstName, lastName, organizationId, projectId) {
  // Try to find existing user by email
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      members: {
        where: { organizationId },
        take: 1,
      },
    },
  });

  if (existingUser?.members?.[0]) {
    const member = existingUser.members[0];

    // Ensure client is assigned to this project
    await ensureProjectAssignment(member.id, projectId);

    console.log('[InboundEmail] Using existing client:', email);
    return member;
  }

  // Create new user and client member
  const userId = generateId();
  const newUser = await prisma.user.create({
    data: {
      id: userId,
      name: `${firstName} ${lastName}`.trim() || email,
      email,
      emailVerified: false,
      role: 'user',
    },
  });

  const member = await prisma.member.create({
    data: {
      id: generateId(),
      organizationId,
      userId: newUser.id,
      role: 'client',
    },
  });

  // Assign to project
  await prisma.projectAssignment.create({
    data: {
      memberId: member.id,
      projectId,
    },
  });

  console.log('[InboundEmail] Created new client:', email);
  return member;
}

/**
 * Ensure a member is assigned to a project
 */
async function ensureProjectAssignment(memberId, projectId) {
  const existing = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId },
    },
  });

  if (!existing) {
    await prisma.projectAssignment.create({
      data: { memberId, projectId },
    });
    console.log('[InboundEmail] Assigned client to project');
  }
}

/**
 * Store all email participants (FROM, TO, CC) for a ticket.
 * Creates client accounts for external participants and tracks them for threaded replies.
 */
async function storeEmailParticipants(ticketId, { from, toAddresses, ccAddresses, emailDomain, organizationId, projectId, primaryClientId }) {
  const participants = [];

  // Add the sender as 'from' participant
  const fromAddress = parseEmailAddress(from);
  const fromNameParsed = parseEmailName(from);
  if (fromAddress) {
    participants.push({ email: fromAddress, name: fromNameParsed, type: 'from', memberId: primaryClientId });
  }

  // Add TO recipients (excluding our own domain)
  for (const addr of toAddresses) {
    const email = parseEmailAddress(addr);
    const name = parseEmailName(addr);
    if (email && !email.toLowerCase().endsWith(`@${emailDomain}`)) {
      participants.push({ email, name, type: 'to' });
    }
  }

  // Add CC recipients (excluding our own domain)
  for (const addr of ccAddresses) {
    const email = parseEmailAddress(addr);
    const name = parseEmailName(addr);
    if (email && !email.toLowerCase().endsWith(`@${emailDomain}`)) {
      participants.push({ email, name, type: 'cc' });
    }
  }

  // Deduplicate by email (sender takes priority)
  const seen = new Set();
  const uniqueParticipants = [];
  for (const p of participants) {
    const key = p.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParticipants.push(p);
    }
  }

  // Create participant records and client accounts for non-sender participants
  for (const p of uniqueParticipants) {
    let memberId = p.memberId || null;

    // For TO/CC participants without a memberId, find or create a client account
    if (!memberId && p.type !== 'from') {
      try {
        const { firstName, lastName } = parseFullName(p.name || p.email);
        const member = await findOrCreateClient(p.email, firstName, lastName, organizationId, projectId);
        memberId = member.id;
      } catch (err) {
        console.warn('[InboundEmail] Could not create client for participant:', p.email, err.message);
      }
    }

    try {
      await prisma.ticketEmailParticipant.upsert({
        where: { ticketId_email: { ticketId, email: p.email.toLowerCase() } },
        create: {
          ticketId,
          email: p.email.toLowerCase(),
          name: p.name || null,
          memberId,
          type: p.type,
        },
        update: {},  // Don't overwrite if already exists
      });
    } catch (err) {
      console.warn('[InboundEmail] Could not store participant:', p.email, err.message);
    }
  }

  if (uniqueParticipants.length > 1) {
    console.log(`[InboundEmail] Stored ${uniqueParticipants.length} email participants for ticket`);
  }
}

/**
 * Parse email address from "Name <email@domain.com>" format
 * Returns just the email address
 */
function parseEmailAddress(emailString) {
  if (!emailString) return '';

  const match = emailString.match(/<(.+)>/);
  return match ? match[1].trim() : emailString.trim();
}

/**
 * Parse name from "Name <email@domain.com>" format
 * Returns the name part, or null if not present
 */
function parseEmailName(emailString) {
  if (!emailString) return null;

  const match = emailString.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, '') : null;
}

/**
 * Parse full name into first and last name
 */
function parseFullName(fullName) {
  if (!fullName) {
    return { firstName: '', lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}
