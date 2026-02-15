import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireStaff, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { findTicketOrFail } from '../../utils/entityHelpers.js';
import { createNotification } from '../../services/notificationService.js';
import { sanitizeUrl } from '../../utils/sanitize.js';
import { getPresignedUrl } from '../../lib/storage.js';
import {
  USER_SELECT, USER_SELECT_BRIEF, MEMBER_WITH_USER, MEMBER_WITH_USER_BRIEF,
  MEMBER_WITH_ROLE_AND_USER, PROJECT_SELECT_BRIEF, STAGE_SELECT,
} from '../../utils/prismaFragments.js';

const router = express.Router();

/**
 * Replace all s3:{key} image sources in HTML with presigned URLs.
 */
async function resolveHtmlImageUrls(html) {
  const s3Pattern = /src="s3:([^"]+)"/g;
  const matches = [...html.matchAll(s3Pattern)];
  if (matches.length === 0) return html;

  const replacements = await Promise.all(
    matches.map(async (match) => {
      try {
        const url = await getPresignedUrl(match[1]);
        return { original: match[0], replacement: `src="${url}"` };
      } catch {
        return { original: match[0], replacement: 'src=""' };
      }
    })
  );

  let resolved = html;
  for (const { original, replacement } of replacements) {
    resolved = resolved.replace(original, replacement);
  }
  return resolved;
}

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

// Get all tickets for organization (staff only)
router.get('/', requireStaff, asyncHandler(async (req, res) => {
  const { projectId, status, stageId, ownerId, clientId } = req.query;

  const where = {
    organizationId: req.organization.id,
  };

  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (stageId) where.stageId = stageId;
  if (ownerId) where.ownerId = ownerId;
  if (clientId) where.clientId = clientId;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: PROJECT_SELECT_BRIEF },
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

// Get single ticket with details (staff only)
router.get('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      project: { select: PROJECT_SELECT_BRIEF },
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

  // Resolve presigned URLs for S3-stored attachments
  const resolveUrl = async (att) => {
    if (att.fileUrl?.startsWith('s3:')) {
      try {
        return { ...att, fileUrl: await getPresignedUrl(att.fileUrl.slice(3)) };
      } catch { return att; }
    }
    return att;
  };

  const attachments = await Promise.all(ticket.attachments.map(resolveUrl));
  const comments = await Promise.all(ticket.comments.map(async (c) => ({
    ...c,
    contentHtml: c.contentHtml ? await resolveHtmlImageUrls(c.contentHtml) : null,
    attachments: c.attachments ? await Promise.all(c.attachments.map(resolveUrl)) : [],
  })));

  // Resolve s3: image URLs in description HTML
  const descriptionHtml = ticket.descriptionHtml
    ? await resolveHtmlImageUrls(ticket.descriptionHtml)
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
    projectId, clientId, firstName, lastName, email, phone,
    subject, requestType, priorityLevel, description,
    screenRecordingLink, dueDate, stageId,
  } = req.body;

  if (!projectId || !clientId || !firstName || !lastName || !email || !subject || !description) {
    throw new ValidationError('Project, client, contact info, subject, and description are required');
  }

  // Verify project belongs to org and get default assignee + due date settings
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.organization.id },
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

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get default stage for the project (or use provided stageId)
  let ticketStageId = stageId;
  if (!ticketStageId) {
    const defaultStage = await prisma.ticketStage.findFirst({
      where: { projectId, isDefault: true },
    });
    ticketStageId = defaultStage?.id || null;
  } else {
    const stage = await prisma.ticketStage.findFirst({
      where: { id: stageId, projectId },
    });
    if (!stage) {
      throw new ValidationError('Invalid stage for this project');
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
      LOW: project.dueDateLowDays,
      MEDIUM: project.dueDateMediumDays,
      HIGH: project.dueDateHighDays,
      URGENT: project.dueDateUrgentDays,
    };
    const dueDays = priorityDueDaysMap[effectivePriority];
    if (dueDays != null) {
      calculatedDueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: req.organization.id,
      projectId,
      clientId,
      stageId: ticketStageId,
      ownerId: project.defaultAssigneeId,
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
      project: { select: PROJECT_SELECT_BRIEF },
      stage: { select: STAGE_SELECT },
      client: { select: MEMBER_WITH_USER },
    },
  });

  // Notify the assigned staff member (non-blocking)
  if (project.defaultAssigneeId) {
    try {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: project.defaultAssigneeId,
        organizationId: req.organization.id,
        data: {
          ticketId: ticket.id,
          ticketSubject: subject,
          projectName: project.name,
          requestType: requestType || 'GENERAL_INQUIRY',
          priorityLevel: priorityLevel || 'MEDIUM',
          description,
          clientName: `${firstName} ${lastName}`.trim(),
        },
        entityType: 'ticket',
        entityId: ticket.id,
      });
    } catch (notifError) {
      console.error('Error sending new ticket notification:', notifError);
    }
  }

  res.status(201).json(ticket);
}));

// Update ticket (staff only)
router.put('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

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
      project: { select: PROJECT_SELECT_BRIEF },
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

  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

  const stage = await prisma.ticketStage.findFirst({
    where: { id: stageId, projectId: ticket.projectId },
  });

  if (!stage) {
    throw new ValidationError('Invalid stage for this project');
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

  await findTicketOrFail(req.params.id, req.organization.id);

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json(updated);
}));

// Assign ticket owner
router.put('/:id/assign', requireStaff, asyncHandler(async (req, res) => {
  const { ownerId } = req.body;

  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

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
