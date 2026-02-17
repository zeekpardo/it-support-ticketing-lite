import express from 'express';
import crypto from 'crypto';
import { prisma, auth } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner } from '../middleware/auth.js';
import { asyncHandler, withUpload } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { resolveFileUrl } from '../lib/storage.js';
import { markPublicTicketEmail, consumePublicTicketContext, sendPublicTicketConfirmationEmail, getOrgBranding, getFrontendUrl } from '../lib/email/index.js';
import { createTicketAttachments } from '../utils/entityHelpers.js';
import { uploadAttachments } from '../middleware/upload.js';
import { createNotification } from '../services/notificationService.js';

const generateId = () => crypto.randomBytes(16).toString('hex');
const generateToken = () => crypto.randomBytes(16).toString('hex');

const DEFAULT_APP_NAME = process.env.APP_NAME || 'Groovi Support';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

// ==========================================
// Admin routes (authenticated, org-scoped)
// ==========================================

export const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(requireOrganization);
adminRouter.use(requireOwner);

// GET /api/org-public-form — Get current form status
adminRouter.get('/', asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organization.id },
    select: { publicFormToken: true, publicFormEnabled: true },
  });
  res.json({
    token: org.publicFormToken,
    enabled: org.publicFormEnabled,
  });
}));

// POST /api/org-public-form — Generate a new token
adminRouter.post('/', asyncHandler(async (req, res) => {
  const token = generateToken();
  const updated = await prisma.organization.update({
    where: { id: req.organization.id },
    data: { publicFormToken: token, publicFormEnabled: true },
    select: { publicFormToken: true, publicFormEnabled: true },
  });
  res.json({ token: updated.publicFormToken, enabled: updated.publicFormEnabled });
}));

// PATCH /api/org-public-form — Enable/disable
adminRouter.patch('/', asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new ValidationError('"enabled" must be a boolean');
  }
  const updated = await prisma.organization.update({
    where: { id: req.organization.id },
    data: { publicFormEnabled: enabled },
    select: { publicFormToken: true, publicFormEnabled: true },
  });
  res.json({ token: updated.publicFormToken, enabled: updated.publicFormEnabled });
}));

// DELETE /api/org-public-form — Revoke token
adminRouter.delete('/', asyncHandler(async (req, res) => {
  await prisma.organization.update({
    where: { id: req.organization.id },
    data: { publicFormToken: null, publicFormEnabled: false },
  });
  res.json({ success: true });
}));

// ==========================================
// Public routes (no auth required)
// ==========================================

export const publicRouter = express.Router();

async function findOrgByFormToken(token) {
  const org = await prisma.organization.findUnique({
    where: { publicFormToken: token },
    select: {
      id: true,
      name: true,
      appName: true,
      primaryColor: true,
      logo: true,
      publicFormEnabled: true,
      inboxes: {
        where: { isActive: true },
        select: { id: true, name: true, inboxCode: true, defaultAssigneeId: true, dueDateLowDays: true, dueDateMediumDays: true, dueDateHighDays: true, dueDateUrgentDays: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!org || !org.publicFormEnabled) {
    throw new NotFoundError('This form is no longer available');
  }

  return org;
}

// GET /api/public/org-form/:token — Form config + branding + inboxes
publicRouter.get('/:token', asyncHandler(async (req, res) => {
  const org = await findOrgByFormToken(req.params.token);

  res.json({
    organizationName: org.name,
    inboxes: org.inboxes.map(i => ({ id: i.id, name: i.name })),
    branding: {
      appName: org.appName || DEFAULT_APP_NAME,
      primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
      logoUrl: await resolveFileUrl(org.logo),
    },
  });
}));

// POST /api/public/org-form/:token — Submit ticket
publicRouter.post('/:token', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, subject, description, priorityLevel: rawPriority, inboxId, screenRecordingLink } = req.body;
  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const priorityLevel = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'MEDIUM';

  if (!firstName || !lastName || !email || !subject || !description || !inboxId) {
    throw new ValidationError('First name, last name, email, subject, description, and inbox are required');
  }

  const org = await findOrgByFormToken(req.params.token);
  const inbox = org.inboxes.find(i => i.id === inboxId);
  if (!inbox) {
    throw new ValidationError('Selected inbox is not available');
  }

  const orgId = org.id;

  // Find or create user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let userId;
  let memberId;

  if (existingUser) {
    userId = existingUser.id;

    const existingMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    if (existingMember) {
      memberId = existingMember.id;

      // Add inbox assignment if missing
      const existingAssignment = await prisma.inboxAssignment.findUnique({
        where: { memberId_inboxId: { memberId, inboxId: inbox.id } },
      });

      if (!existingAssignment) {
        await prisma.inboxAssignment.create({
          data: { id: generateId(), memberId, inboxId: inbox.id },
        });
      }
    } else {
      const member = await prisma.member.create({
        data: { id: generateId(), organizationId: orgId, userId, role: 'client' },
      });
      memberId = member.id;

      await prisma.inboxAssignment.create({
        data: { id: generateId(), memberId, inboxId: inbox.id },
      });
    }
  } else {
    userId = generateId();
    const txResult = await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: userId, name: `${firstName} ${lastName}`, email, emailVerified: true, role: 'user' },
      });

      const member = await tx.member.create({
        data: { id: generateId(), organizationId: orgId, userId, role: 'client' },
      });

      await tx.inboxAssignment.create({
        data: { id: generateId(), memberId: member.id, inboxId: inbox.id },
      });

      return { memberId: member.id };
    });
    memberId = txResult.memberId;
  }

  // Get default stage for inbox
  const defaultStage = await prisma.ticketStage.findFirst({
    where: { inboxId: inbox.id, isDefault: true },
  });

  // Calculate due date based on priority
  const dueDaysMap = { LOW: inbox.dueDateLowDays, MEDIUM: inbox.dueDateMediumDays, HIGH: inbox.dueDateHighDays, URGENT: inbox.dueDateUrgentDays };
  const dueDays = dueDaysMap[priorityLevel];
  const dueDate = dueDays != null ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000) : null;

  // Create ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: orgId,
      inboxId: inbox.id,
      clientId: memberId,
      ownerId: inbox.defaultAssigneeId,
      stageId: defaultStage?.id || null,
      firstName,
      lastName,
      email,
      subject,
      requestType: 'GENERAL_SUPPORT',
      priorityLevel,
      description,
      screenRecordingLink: screenRecordingLink || null,
      dueDate,
    },
  });

  // Send confirmation email with magic link
  const branding = await getOrgBranding(orgId);
  const emailContext = {
    to: email,
    recipientName: firstName,
    inboxName: inbox.name,
    ticketSubject: subject,
    description,
    ticketId: ticket.id,
    branding,
  };

  markPublicTicketEmail(email, emailContext);

  try {
    const baseUrl = await getFrontendUrl(orgId);
    const callbackUrl = baseUrl + `/portal/tickets/${ticket.id}`;
    await auth.api.signInMagicLink({
      body: { email, callbackURL: callbackUrl },
      headers: req.headers,
    });
  } catch (err) {
    console.error('Failed to send magic link for org public form ticket:', err);
    consumePublicTicketContext(email);
    const baseUrl = await getFrontendUrl(orgId);
    const portalUrl = baseUrl + `/portal/tickets/${ticket.id}`;
    void sendPublicTicketConfirmationEmail({ ...emailContext, magicLinkUrl: portalUrl });
  }

  // Notify staff (default assignee)
  if (inbox.defaultAssigneeId) {
    try {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: inbox.defaultAssigneeId,
        organizationId: orgId,
        data: {
          ticketId: ticket.id,
          ticketSubject: subject,
          inboxName: inbox.name,
          requestType: 'GENERAL_SUPPORT',
          priorityLevel,
          description,
          clientName: `${firstName} ${lastName}`,
          projectId: inbox.id,
        },
        entityType: 'ticket',
        entityId: ticket.id,
      });
    } catch (notifError) {
      console.error('Error sending ticket assignment notification:', notifError);
    }
  }

  res.status(201).json({ success: true, ticketId: ticket.id });
}));

// POST /api/public/org-form/:token/attachments/:ticketId — Upload attachments
publicRouter.post('/:token/attachments/:ticketId', withUpload(uploadAttachments, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ValidationError('No files provided');
  }

  const org = await findOrgByFormToken(req.params.token);

  // Verify ticket belongs to this org
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.ticketId,
      organizationId: org.id,
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const attachments = await createTicketAttachments(
    ticket.id, ticket.clientId, req.files
  );

  res.status(201).json(attachments);
}));
