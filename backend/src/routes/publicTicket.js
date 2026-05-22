import express from 'express';
import crypto from 'crypto';
import { prisma, auth } from '../lib/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { resolveFileUrl, uploadFile, generateStorageKey, isStorageConfigured } from '../lib/storage.js';
import { markPublicTicketEmail, consumePublicTicketContext, sendPublicTicketConfirmationEmail, getOrgBranding, getFrontendUrl } from '../lib/email/index.js';
import { createTicketAttachments } from '../utils/entityHelpers.js';
import { uploadAttachments } from '../middleware/upload.js';
import { withUpload } from '../middleware/asyncHandler.js';
import { createNotification } from '../services/notificationService.js';
import { sanitizeCommentHtml } from '../utils/htmlSanitizer.js';

const router = express.Router();

const generateId = () => crypto.randomBytes(16).toString('hex');

const DEFAULT_APP_NAME = process.env.APP_NAME || 'Groovi Support';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

// Find inbox by signup token (must be enabled and active)
async function findInboxByToken(token) {
  const inbox = await prisma.inbox.findUnique({
    where: { clientSignupToken: token },
    include: {
      organization: {
        select: { id: true, name: true, appName: true, primaryColor: true, logo: true },
      },
    },
  });

  if (!inbox || !inbox.clientSignupEnabled || !inbox.isActive) {
    throw new NotFoundError('This form is no longer available');
  }

  return inbox;
}

// GET /:token — Form config + branding
router.get('/:token', asyncHandler(async (req, res) => {
  const inbox = await findInboxByToken(req.params.token);
  const org = inbox.organization;

  res.json({
    inboxId: inbox.id,
    inboxName: inbox.name,
    allowedEmailDomains: inbox.allowedEmailDomains || [],
    branding: {
      appName: org.appName || DEFAULT_APP_NAME,
      primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
      logoUrl: await resolveFileUrl(org.logo),
    },
  });
}));

// POST /:token — Submit ticket
router.post('/:token', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, subject, description, descriptionHtml: rawDescriptionHtml, priorityLevel: rawPriority } = req.body;
  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const priorityLevel = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'MEDIUM';

  // Validate required fields
  if (!firstName || !lastName || !email || !subject || !description) {
    throw new ValidationError('First name, last name, email, subject, and description are required');
  }

  const inbox = await findInboxByToken(req.params.token);
  const orgId = inbox.organizationId;

  // Validate email domain
  if (inbox.allowedEmailDomains && inbox.allowedEmailDomains.length > 0) {
    const emailDomain = email.toLowerCase().split('@')[1];
    if (!inbox.allowedEmailDomains.includes(emailDomain)) {
      throw new ValidationError(`Email domain "${emailDomain}" is not allowed. Accepted domains: ${inbox.allowedEmailDomains.join(', ')}`);
    }
  }

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
      // Existing user, not in org — create client member + inbox assignment
      const member = await prisma.member.create({
        data: { id: generateId(), organizationId: orgId, userId, role: 'client' },
      });
      memberId = member.id;

      await prisma.inboxAssignment.create({
        data: { id: generateId(), memberId, inboxId: inbox.id },
      });
    }
  } else {
    // New user — create without password (passwordless)
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
      descriptionHtml: rawDescriptionHtml ? sanitizeCommentHtml(rawDescriptionHtml) : null,
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

  // Stash context so the magic link callback sends the confirmation email
  markPublicTicketEmail(email, emailContext);

  try {
    const baseUrl = await getFrontendUrl(orgId);
    const callbackUrl = baseUrl + `/portal/tickets/${ticket.id}`;
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: callbackUrl,
      },
      headers: req.headers,
    });
  } catch (err) {
    console.error('Failed to send magic link for public ticket:', err);
    // Magic link failed — consume any stale context and send confirmation directly
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

// POST /:token/attachments/:ticketId — Upload attachments to a public ticket
router.post('/:token/attachments/:ticketId', withUpload(uploadAttachments, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ValidationError('No files provided');
  }

  const inbox = await findInboxByToken(req.params.token);

  // Verify ticket belongs to this inbox
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.ticketId,
      inboxId: inbox.id,
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

// POST /:token/description-image — Upload inline image for new ticket description (no ticket ID yet)
import multer from 'multer';
const uploadDescriptionImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
  },
}).single('image');

router.post('/:token/description-image', withUpload(uploadDescriptionImage, async (req, res) => {
  if (!req.file) throw new ValidationError('No image provided');
  if (!isStorageConfigured()) throw new ValidationError('File storage is not configured');

  await findInboxByToken(req.params.token);

  const key = generateStorageKey('inline-images', req.file.originalname);
  await uploadFile(req.file.buffer, key, req.file.mimetype);

  res.status(201).json({ key });
}));

export default router;
