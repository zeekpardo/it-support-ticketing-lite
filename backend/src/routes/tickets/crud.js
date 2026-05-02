import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireStaff, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { findTicketOrFail, findTicketWithAccess, getAssignedInboxIds } from '../../utils/entityHelpers.js';
import { createNotification } from '../../services/notificationService.js';
import { sendTicketSubmittedEmail, getOrgBranding } from '../../lib/email/index.js';
import { sanitizeUrl } from '../../utils/sanitize.js';
import { resolveS3ImageUrls, resolveAttachmentUrl } from '../../utils/resolveS3Urls.js';
import {
  USER_SELECT, USER_SELECT_BRIEF, MEMBER_WITH_USER, MEMBER_WITH_USER_BRIEF,
  MEMBER_WITH_ROLE_AND_USER, INBOX_SELECT_BRIEF, STAGE_SELECT,
} from '../../utils/prismaFragments.js';

const router = express.Router();

// Get staff members for assignment dropdown
router.get('/staff/list', requireStaff, asyncHandler(async (req, res) => {
  const staffMembers = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { not: 'client' },
    },
    include: {
      user: { select: USER_SELECT },
    },
  });

  res.json(staffMembers);
}));

// Get all tickets for organization (staff only, scoped by inbox access)
router.get('/', requireStaff, asyncHandler(async (req, res) => {
  const { inboxId, status, stageId, ownerId, clientId } = req.query;

  const where = {
    organizationId: req.organization.id,
  };

  // Members only see tickets from their assigned inboxes
  const role = req.membership.role;
  if (role !== 'owner' && role !== 'manager') {
    const assignedIds = await getAssignedInboxIds(req.membership.id);
    where.inboxId = inboxId ? { in: assignedIds.includes(inboxId) ? [inboxId] : [] } : { in: assignedIds };
  } else if (inboxId) {
    where.inboxId = inboxId;
  }

  if (status) where.status = status;
  if (stageId) where.stageId = stageId;
  if (ownerId) where.ownerId = ownerId;
  if (clientId) where.clientId = clientId;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      stage: { select: STAGE_SELECT },
      client: { select: MEMBER_WITH_USER },
      owner: { select: MEMBER_WITH_USER },
      _count: {
        select: { comments: true, timeEntries: true, attachments: true },
      },
    },
  });

  res.json(tickets);
}));

// Get single ticket with details (staff only, scoped by inbox access)
router.get('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketWithAccess(req.params.id, req.organization.id, req.membership, {
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      stage: { select: STAGE_SELECT },
      client: { select: MEMBER_WITH_USER },
      owner: { select: MEMBER_WITH_USER },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: MEMBER_WITH_ROLE_AND_USER },
          attachments: true,
        },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: MEMBER_WITH_USER_BRIEF },
        },
      },
      timeEntries: {
        orderBy: { startTime: 'desc' },
        include: {
          user: { select: USER_SELECT_BRIEF },
        },
      },
    },
  });

  const totalMinutes = ticket.timeEntries.reduce(
    (sum, entry) => sum + (entry.durationMins || 0),
    0
  );

  const attachments = await Promise.all(ticket.attachments.map(resolveAttachmentUrl));
  const comments = await Promise.all(ticket.comments.map(async (c) => ({
    ...c,
    contentHtml: c.contentHtml ? await resolveS3ImageUrls(c.contentHtml) : null,
    attachments: c.attachments ? await Promise.all(c.attachments.map(resolveAttachmentUrl)) : [],
  })));

  const descriptionHtml = ticket.descriptionHtml
    ? await resolveS3ImageUrls(ticket.descriptionHtml)
    : null;

  res.json({
    ...ticket,
    attachments,
    descriptionHtml,
    comments,
    totalTimeMinutes: totalMinutes,
  });
}));

// Create ticket (staff can create on behalf of clients)
router.post('/', requireStaff, asyncHandler(async (req, res) => {
  const {
    inboxId, clientId, firstName, lastName, email, phone,
    subject, requestType, priorityLevel, description,
    screenRecordingLink, dueDate, stageId,
  } = req.body;

  if (!inboxId || !clientId || !firstName || !lastName || !email || !subject || !description) {
    throw new ValidationError('Inbox, client, contact info, subject, and description are required');
  }

  // Verify inbox belongs to org and get default assignee + due date settings
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId: req.organization.id },
    select: {
      id: true,
      name: true,
      defaultAssigneeId: true,
      dueDateLowDays: true,
      dueDateMediumDays: true,
      dueDateHighDays: true,
      dueDateUrgentDays: true,
    },
  });

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  // Get default stage for the inbox (or use provided stageId)
  let ticketStageId = stageId;
  if (!ticketStageId) {
    const defaultStage = await prisma.ticketStage.findFirst({
      where: { inboxId, isDefault: true },
    });
    ticketStageId = defaultStage?.id || null;
  } else {
    const stage = await prisma.ticketStage.findFirst({
      where: { id: stageId, inboxId },
    });
    if (!stage) {
      throw new ValidationError('Invalid stage for this inbox');
    }
  }

  // Verify client is a member of org
  const client = await prisma.member.findFirst({
    where: { id: clientId, organizationId: req.organization.id, role: 'client' },
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  // Calculate due date: use provided dueDate, or auto-calculate from priority
  let calculatedDueDate = dueDate ? new Date(dueDate) : null;
  if (!calculatedDueDate) {
    const effectivePriority = priorityLevel || 'MEDIUM';
    const priorityDueDaysMap = {
      LOW: inbox.dueDateLowDays,
      MEDIUM: inbox.dueDateMediumDays,
      HIGH: inbox.dueDateHighDays,
      URGENT: inbox.dueDateUrgentDays,
    };
    const dueDays = priorityDueDaysMap[effectivePriority];
    if (dueDays != null) {
      calculatedDueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: req.organization.id,
      inboxId,
      clientId,
      stageId: ticketStageId,
      ownerId: inbox.defaultAssigneeId,
      firstName,
      lastName,
      email,
      phone,
      subject,
      requestType: requestType || 'GENERAL_INQUIRY',
      priorityLevel: priorityLevel || 'MEDIUM',
      description,
      screenRecordingLink: sanitizeUrl(screenRecordingLink, 'screenRecordingLink'),
      dueDate: calculatedDueDate,
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      stage: { select: STAGE_SELECT },
      client: { select: MEMBER_WITH_USER },
    },
  });

  // Notify the assigned staff member (non-blocking)
  if (inbox.defaultAssigneeId) {
    try {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: inbox.defaultAssigneeId,
        organizationId: req.organization.id,
        data: {
          ticketId: ticket.id,
          ticketSubject: subject,
          inboxName: inbox.name,
          requestType: requestType || 'GENERAL_INQUIRY',
          priorityLevel: priorityLevel || 'MEDIUM',
          description,
          clientName: `${firstName} ${lastName}`.trim(),
          projectId: inbox.id,
        },
        entityType: 'ticket',
        entityId: ticket.id,
      });
    } catch (notifError) {
      console.error('Error sending new ticket notification:', notifError);
    }
  }

  // Email the client a confirmation (non-blocking)
  try {
    const branding = await getOrgBranding(req.organization.id);
    await sendTicketSubmittedEmail({
      to: email,
      recipientName: `${firstName} ${lastName}`.trim(),
      inboxName: inbox.name,
      ticketSubject: subject,
      requestType: requestType || 'GENERAL_INQUIRY',
      priorityLevel: priorityLevel || 'MEDIUM',
      description,
      ticketId: ticket.id,
      branding,
      organizationId: req.organization.id,
      projectId: inboxId,
    });
  } catch (emailError) {
    console.error('[Ticket] Error sending confirmation email to client:', emailError);
  }

  res.status(201).json(ticket);
}));

// Update ticket (staff only, scoped by inbox access)
router.put('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketWithAccess(req.params.id, req.organization.id, req.membership);

  const {
    firstName, lastName, email, phone, subject, requestType,
    priorityLevel, description, screenRecordingLink, status, ownerId, dueDate,
  } = req.body;

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: {
      firstName: firstName ?? ticket.firstName,
      lastName: lastName ?? ticket.lastName,
      email: email ?? ticket.email,
      phone: phone !== undefined ? phone : ticket.phone,
      subject: subject ?? ticket.subject,
      requestType: requestType ?? ticket.requestType,
      priorityLevel: priorityLevel ?? ticket.priorityLevel,
      description: description ?? ticket.description,
      screenRecordingLink: screenRecordingLink !== undefined ? sanitizeUrl(screenRecordingLink, 'screenRecordingLink') : ticket.screenRecordingLink,
      status: status ?? ticket.status,
      ownerId: ownerId !== undefined ? ownerId : ticket.ownerId,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : ticket.dueDate,
    },
    include: {
      inbox: { select: INBOX_SELECT_BRIEF },
      client: { select: MEMBER_WITH_USER },
      owner: { select: MEMBER_WITH_USER },
    },
  });

  res.json(updated);
}));

// Update ticket stage (for Kanban drag-drop)
router.put('/:id/stage', requireStaff, asyncHandler(async (req, res) => {
  const { stageId } = req.body;

  if (!stageId) {
    throw new ValidationError('stageId is required');
  }

  const ticket = await findTicketWithAccess(req.params.id, req.organization.id, req.membership);

  const stage = await prisma.ticketStage.findFirst({
    where: { id: stageId, inboxId: ticket.inboxId },
  });

  if (!stage) {
    throw new ValidationError('Invalid stage for this inbox');
  }

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { stageId },
    include: {
      stage: { select: STAGE_SELECT },
    },
  });

  res.json(updated);
}));

// Update ticket status (DEPRECATED - kept for backward compatibility)
router.put('/:id/status', requireStaff, asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const validStatuses = ['NEW_REQUEST', 'IN_PROGRESS', 'WAITING_FOR_INFO', 'REVIEW', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status');
  }

  await findTicketWithAccess(req.params.id, req.organization.id, req.membership);

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json(updated);
}));

// Assign ticket owner
router.put('/:id/assign', requireStaff, asyncHandler(async (req, res) => {
  const { ownerId } = req.body;

  const ticket = await findTicketWithAccess(req.params.id, req.organization.id, req.membership);

  if (ownerId) {
    const owner = await prisma.member.findFirst({
      where: {
        id: ownerId,
        organizationId: req.organization.id,
        role: { not: 'client' },
      },
    });

    if (!owner) {
      throw new NotFoundError('Staff member not found');
    }
  }

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { ownerId: ownerId || null },
    include: {
      owner: { select: MEMBER_WITH_USER },
    },
  });

  if (ownerId && ownerId !== req.membership.id) {
    try {
      await createNotification(prisma, {
        type: 'TICKET_ASSIGNED',
        recipientId: ownerId,
        organizationId: req.organization.id,
        data: {
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          projectId: ticket.inboxId,
        },
        entityType: 'ticket',
        entityId: ticket.id,
      });
    } catch (notifError) {
      console.error('Error sending assignment notification:', notifError);
    }
  }

  res.json(updated);
}));

// Delete ticket (admin/owner only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  await prisma.supportTicket.delete({
    where: { id: req.params.id },
  });

  res.json({ message: 'Ticket deleted' });
}));

export default router;
