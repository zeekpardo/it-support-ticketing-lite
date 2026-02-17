import express from 'express';
import multer from 'multer';
import { prisma } from '../../lib/auth.js';
import { uploadAttachments } from '../../middleware/upload.js';
import { asyncHandler, withUpload } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { createTicketAttachments } from '../../utils/entityHelpers.js';
import { sanitizeUrl } from '../../utils/sanitize.js';
import { createNotification } from '../../services/notificationService.js';
import { INBOX_SELECT_BRIEF, MEMBER_WITH_USER_BRIEF, MEMBER_WITH_ROLE_AND_USER_BRIEF } from '../../utils/prismaFragments.js';
import { uploadFile, generateAttachmentKey, isStorageConfigured } from '../../lib/storage.js';
import { resolveS3ImageUrls, resolveAttachmentUrl } from '../../utils/resolveS3Urls.js';

const router = express.Router();

// Get client's own tickets
router.get('/', asyncHandler(async (req, res) => {
  const { inboxId, status } = req.query;

  const where = {
    organizationId: req.organization.id,
    clientId: req.membership.id
  };

  if (inboxId) where.inboxId = inboxId;
  if (status) where.status = status;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      inbox: {
        select: INBOX_SELECT_BRIEF
      },
      owner: {
        select: MEMBER_WITH_USER_BRIEF
      },
      _count: {
        select: {
          comments: { where: { isInternal: false } }
        }
      }
    }
  });

  res.json(tickets);
}));

// Get single ticket (client can only see their own)
router.get('/:id', asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    include: {
      inbox: {
        select: INBOX_SELECT_BRIEF
      },
      owner: {
        select: MEMBER_WITH_USER_BRIEF
      },
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: MEMBER_WITH_ROLE_AND_USER_BRIEF
          },
          attachments: true
        }
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          fileType: true,
          fileUrl: true,
          isInline: true,
          createdAt: true
        }
      }
    }
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const attachments = await Promise.all(ticket.attachments.map(resolveAttachmentUrl));
  const comments = await Promise.all(ticket.comments.map(async (c) => ({
    ...c,
    contentHtml: c.contentHtml ? await resolveS3ImageUrls(c.contentHtml) : null,
    attachments: c.attachments ? await Promise.all(c.attachments.map(resolveAttachmentUrl)) : [],
  })));

  const descriptionHtml = ticket.descriptionHtml
    ? await resolveS3ImageUrls(ticket.descriptionHtml)
    : null;

  res.json({ ...ticket, attachments, descriptionHtml, comments });
}));

// Submit new ticket
router.post('/', asyncHandler(async (req, res) => {
  const {
    inboxId,
    subject,
    requestType,
    priorityLevel,
    description,
    screenRecordingLink
  } = req.body;

  if (!inboxId || !subject || !description) {
    throw new ValidationError('Inbox, subject, and description are required');
  }

  // Verify client has access to this inbox and get inbox details
  const assignment = await prisma.inboxAssignment.findUnique({
    where: {
      memberId_inboxId: {
        memberId: req.membership.id,
        inboxId
      }
    },
    include: {
      inbox: {
        select: {
          id: true,
          isActive: true,
          defaultAssigneeId: true,
          dueDateLowDays: true,
          dueDateMediumDays: true,
          dueDateHighDays: true,
          dueDateUrgentDays: true
        }
      }
    }
  });

  if (!assignment || !assignment.inbox.isActive) {
    throw new ForbiddenError('You do not have access to this inbox');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { name: true, email: true, phone: true }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const nameParts = (user.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const effectivePriority = priorityLevel || 'MEDIUM';
  const priorityDueDaysMap = {
    LOW: assignment.inbox.dueDateLowDays,
    MEDIUM: assignment.inbox.dueDateMediumDays,
    HIGH: assignment.inbox.dueDateHighDays,
    URGENT: assignment.inbox.dueDateUrgentDays
  };
  const dueDays = priorityDueDaysMap[effectivePriority];
  const dueDate = dueDays != null ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000) : null;

  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: req.organization.id,
      inboxId,
      clientId: req.membership.id,
      ownerId: assignment.inbox.defaultAssigneeId,
      firstName,
      lastName,
      email: user.email,
      phone: user.phone,
      subject,
      requestType: requestType || 'GENERAL_SUPPORT',
      priorityLevel: effectivePriority,
      description,
      screenRecordingLink: sanitizeUrl(screenRecordingLink, 'screenRecordingLink'),
      dueDate
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF }
    }
  });

  // Send notifications (non-blocking)
  try {
    const notificationData = {
      ticketId: ticket.id,
      ticketSubject: subject,
      inboxName: ticket.inbox.name,
      requestType: requestType || 'GENERAL_SUPPORT',
      priorityLevel: effectivePriority,
      description,
      clientName: user.name || user.email,
      projectId: inboxId,
    };

    await createNotification(prisma, {
      type: 'TICKET_SUBMITTED',
      recipientId: req.membership.id,
      organizationId: req.organization.id,
      data: notificationData,
      entityType: 'ticket',
      entityId: ticket.id,
    });

    if (assignment.inbox.defaultAssigneeId) {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: assignment.inbox.defaultAssigneeId,
        organizationId: req.organization.id,
        data: notificationData,
        entityType: 'ticket',
        entityId: ticket.id,
      });
    }
  } catch (notifError) {
    console.error('Error sending ticket submission notification:', notifError);
  }

  res.status(201).json(ticket);
}));

// Upload attachments to a portal ticket
router.post('/:id/attachments', withUpload(uploadAttachments, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ValidationError('No files provided');
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id,
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const attachments = await createTicketAttachments(
    req.params.id, req.membership.id, req.files
  );

  res.status(201).json(attachments);
}));

// Upload inline image for rich text editor (portal)
const uploadInlineImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  }
}).single('image');

router.post('/:id/inline-image', withUpload(uploadInlineImage, async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No image provided');
  }

  if (!isStorageConfigured()) {
    throw new ValidationError('File storage is not configured');
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id,
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const key = generateAttachmentKey(req.params.id, req.file.originalname);
  await uploadFile(req.file.buffer, key, req.file.mimetype);

  await prisma.ticketAttachment.create({
    data: {
      ticketId: req.params.id,
      uploadedById: req.membership.id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileUrl: `s3:${key}`,
      isInline: true,
    },
  });

  res.status(201).json({ key });
}));

// Get mentionable members for a ticket
router.get('/:id/mentionable-members', asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id
    }
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const staffMembers = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] }
    },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true } }
    }
  });

  res.json(staffMembers);
}));

export default router;
