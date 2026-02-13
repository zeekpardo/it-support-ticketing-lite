import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireStaff, requireAdmin } from '../middleware/auth.js';
import { createNotification, notifyMultiple, parseMentions } from '../services/notificationService.js';
import { uploadAttachments, deleteUploadedFile } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { findTicketOrFail } from '../utils/entityHelpers.js';
import { USER_SELECT, USER_SELECT_BRIEF, MEMBER_WITH_USER, MEMBER_WITH_USER_BRIEF, MEMBER_WITH_ROLE_AND_USER, PROJECT_SELECT_BRIEF } from '../utils/prismaFragments.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Get all tickets for organization (staff only)
router.get('/', requireStaff, asyncHandler(async (req, res) => {
  const { projectId, status, stageId, ownerId, clientId } = req.query;

  const where = {
    organizationId: req.organization.id
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
      project: {
        select: PROJECT_SELECT_BRIEF
      },
      stage: {
        select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true }
      },
      client: {
        select: MEMBER_WITH_USER
      },
      owner: {
        select: MEMBER_WITH_USER
      },
      _count: {
        select: { comments: true, timeEntries: true, attachments: true }
      }
    }
  });

  res.json(tickets);
}));

// Get single ticket with details (staff only)
router.get('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      project: {
        select: PROJECT_SELECT_BRIEF
      },
      stage: {
        select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true }
      },
      client: {
        select: MEMBER_WITH_USER
      },
      owner: {
        select: MEMBER_WITH_USER
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: MEMBER_WITH_ROLE_AND_USER
          },
          attachments: true
        }
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: MEMBER_WITH_USER_BRIEF
          }
        }
      },
      timeEntries: {
        orderBy: { startTime: 'desc' },
        include: {
          user: { select: USER_SELECT_BRIEF }
        }
      }
    }
  });

  // Calculate total time spent
  const totalMinutes = ticket.timeEntries.reduce(
    (sum, entry) => sum + (entry.durationMins || 0),
    0
  );

  res.json({
    ...ticket,
    totalTimeMinutes: totalMinutes
  });
}));

// Create ticket (staff can create on behalf of clients)
router.post('/', requireStaff, asyncHandler(async (req, res) => {
  const {
    projectId,
    clientId,
    firstName,
    lastName,
    email,
    phone,
    subject,
    requestType,
    priorityLevel,
    description,
    screenRecordingLink,
    dueDate,
    stageId
  } = req.body;

  if (!projectId || !clientId || !firstName || !lastName || !email || !subject || !description) {
    throw new ValidationError('Project, client, contact info, subject, and description are required');
  }

  // Verify project belongs to org and get default assignee + due date settings
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.organization.id },
    select: {
      id: true,
      defaultAssigneeId: true,
      dueDateLowDays: true,
      dueDateMediumDays: true,
      dueDateHighDays: true,
      dueDateUrgentDays: true
    }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get default stage for the project (or use provided stageId)
  let ticketStageId = stageId;
  if (!ticketStageId) {
    const defaultStage = await prisma.ticketStage.findFirst({
      where: { projectId, isDefault: true }
    });
    ticketStageId = defaultStage?.id || null;
  } else {
    // Verify stageId belongs to this project
    const stage = await prisma.ticketStage.findFirst({
      where: { id: stageId, projectId }
    });
    if (!stage) {
      throw new ValidationError('Invalid stage for this project');
    }
  }

  // Verify client is a member of org
  const client = await prisma.member.findFirst({
    where: { id: clientId, organizationId: req.organization.id, role: 'client' }
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
      URGENT: project.dueDateUrgentDays
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
      ownerId: project.defaultAssigneeId, // Auto-assign to project default
      firstName,
      lastName,
      email,
      phone,
      subject,
      requestType: requestType || 'GENERAL_INQUIRY',
      priorityLevel: priorityLevel || 'MEDIUM',
      description,
      screenRecordingLink,
      dueDate: calculatedDueDate
    },
    include: {
      project: { select: PROJECT_SELECT_BRIEF },
      stage: { select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true } },
      client: {
        select: MEMBER_WITH_USER
      }
    }
  });

  res.status(201).json(ticket);
}));

// Update ticket (staff only)
router.put('/:id', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

  const {
    firstName,
    lastName,
    email,
    phone,
    subject,
    requestType,
    priorityLevel,
    description,
    screenRecordingLink,
    status,
    ownerId,
    dueDate
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
      screenRecordingLink: screenRecordingLink !== undefined ? screenRecordingLink : ticket.screenRecordingLink,
      status: status ?? ticket.status,
      ownerId: ownerId !== undefined ? ownerId : ticket.ownerId,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : ticket.dueDate
    },
    include: {
      project: { select: PROJECT_SELECT_BRIEF },
      client: {
        select: MEMBER_WITH_USER
      },
      owner: {
        select: MEMBER_WITH_USER
      }
    }
  });

  res.json(updated);
}));

// Update ticket stage (for Kanban drag-drop) - NEW ENDPOINT
router.put('/:id/stage', requireStaff, asyncHandler(async (req, res) => {
  const { stageId } = req.body;

  if (!stageId) {
    throw new ValidationError('stageId is required');
  }

  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

  // Verify stage belongs to the same project
  const stage = await prisma.ticketStage.findFirst({
    where: {
      id: stageId,
      projectId: ticket.projectId
    }
  });

  if (!stage) {
    throw new ValidationError('Invalid stage for this project');
  }

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { stageId },
    include: {
      stage: { select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true } }
    }
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
    data: { status }
  });

  res.json(updated);
}));

// Assign ticket owner
router.put('/:id/assign', requireStaff, asyncHandler(async (req, res) => {
  const { ownerId } = req.body;

  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

  // If ownerId provided, verify they're a staff member
  if (ownerId) {
    const owner = await prisma.member.findFirst({
      where: {
        id: ownerId,
        organizationId: req.organization.id,
        role: { not: 'client' }
      }
    });

    if (!owner) {
      throw new NotFoundError('Staff member not found');
    }
  }

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { ownerId: ownerId || null },
    include: {
      owner: {
        select: MEMBER_WITH_USER
      }
    }
  });

  // Send notification to the newly assigned owner (if different from current user)
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
      // Don't fail the request if notification fails
    }
  }

  res.json(updated);
}));

// Delete ticket (admin/owner only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  await prisma.supportTicket.delete({
    where: { id: req.params.id }
  });

  res.json({ message: 'Ticket deleted' });
}));

// === COMMENTS ===

// Get ticket comments
router.get('/:id/comments', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: MEMBER_WITH_ROLE_AND_USER
      },
      attachments: true
    }
  });

  res.json(comments);
}));

// Add comment to ticket (supports file attachments via multipart/form-data)
router.post('/:id/comments', requireStaff, (req, res) => {
  uploadAttachments(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const { content, isInternal: isInternalStr } = req.body;
      const isInternal = isInternalStr === 'true' || isInternalStr === true;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const ticket = await findTicketOrFail(req.params.id, req.organization.id);

      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: req.params.id,
          authorId: req.membership.id,
          content,
          isInternal: isInternal || false
        },
        include: {
          author: {
            select: MEMBER_WITH_ROLE_AND_USER
          }
        }
      });

      // Create attachments linked to this comment
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = await Promise.all(
          req.files.map(file =>
            prisma.ticketAttachment.create({
              data: {
                ticketId: req.params.id,
                commentId: comment.id,
                fileName: file.originalname,
                fileSize: file.size,
                fileType: file.mimetype,
                fileUrl: `/uploads/attachments/${file.filename}`,
                uploadedById: req.membership.id
              }
            })
          )
        );
      }

      // Send notifications for comment (non-blocking)
      try {
        const authorName = comment.author.user.name;
        const notificationData = {
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          authorName,
          commentId: comment.id,
          commentContent: content,
        };

        // 1. Parse @mentions and notify mentioned users
        const mentionedMemberIds = parseMentions(content);
        if (mentionedMemberIds.length > 0) {
          const mentionedMembers = await prisma.member.findMany({
            where: { id: { in: mentionedMemberIds } },
            select: { id: true, role: true },
          });

          for (const member of mentionedMembers) {
            if (member.id === req.membership.id) continue;

            const isClient = member.role === 'client';
            if (isClient && isInternal) continue;

            await createNotification(prisma, {
              type: isClient ? 'MENTION_CLIENT' : 'MENTION',
              recipientId: member.id,
              organizationId: req.organization.id,
              data: notificationData,
              entityType: 'comment',
              entityId: comment.id,
            });
          }
        }

        // 2. Notify ticket owner if they weren't mentioned and aren't the author
        if (ticket.ownerId &&
            ticket.ownerId !== req.membership.id &&
            !mentionedMemberIds.includes(ticket.ownerId)) {
          await createNotification(prisma, {
            type: 'TICKET_COMMENT',
            recipientId: ticket.ownerId,
            organizationId: req.organization.id,
            data: notificationData,
            entityType: 'comment',
            entityId: comment.id,
          });
        }

        // 3. Notify ticket client if it's a public comment and they weren't mentioned
        if (!isInternal &&
            ticket.clientId !== req.membership.id &&
            !mentionedMemberIds.includes(ticket.clientId)) {
          await createNotification(prisma, {
            type: 'TICKET_COMMENT_CLIENT',
            recipientId: ticket.clientId,
            organizationId: req.organization.id,
            data: notificationData,
            entityType: 'comment',
            entityId: comment.id,
          });
        }
      } catch (notifError) {
        console.error('Error sending comment notifications:', notifError);
      }

      res.status(201).json({ ...comment, attachments });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });
});

// Get mentionable members for a ticket (staff + ticket client)
router.get('/:id/mentionable-members', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      client: {
        select: MEMBER_WITH_ROLE_AND_USER
      }
    }
  });

  // Get all staff members (owner, manager, member roles)
  const staffMembers = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] }
    },
    select: MEMBER_WITH_ROLE_AND_USER
  });

  // Combine staff + ticket client, ensuring no duplicates and excluding current user
  const members = staffMembers.filter(m => m.id !== req.membership.id);
  if (ticket.client && ticket.client.id !== req.membership.id && !members.some(m => m.id === ticket.client.id)) {
    members.push(ticket.client);
  }

  res.json(members);
}));

// === TIME ENTRIES ===

// Get time entries for ticket
router.get('/:id/time-entries', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const timeEntries = await prisma.timeEntry.findMany({
    where: { ticketId: req.params.id },
    orderBy: { startTime: 'desc' },
    include: {
      user: { select: USER_SELECT },
      project: { select: PROJECT_SELECT_BRIEF }
    }
  });

  res.json(timeEntries);
}));

// Start timer for ticket (creates a time entry linked to ticket)
router.post('/:id/time-entries', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      project: true
    }
  });

  // Stop any running timers for this user
  const runningEntries = await prisma.timeEntry.findMany({
    where: {
      userId: req.user.id,
      organizationId: req.organization.id,
      isRunning: true
    }
  });

  for (const entry of runningEntries) {
    const endTime = new Date();
    const durationMins = Math.round((endTime - entry.startTime) / 60000);
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { isRunning: false, endTime, durationMins }
    });
  }

  // Create new time entry linked to ticket
  const timeEntry = await prisma.timeEntry.create({
    data: {
      organizationId: req.organization.id,
      userId: req.user.id,
      projectId: ticket.projectId,
      ticketId: ticket.id,
      taskName: `Ticket: ${ticket.subject}`,
      startTime: new Date(),
      isRunning: true
    },
    include: {
      user: { select: USER_SELECT_BRIEF },
      project: { select: PROJECT_SELECT_BRIEF },
      ticket: { select: { id: true, subject: true } }
    }
  });

  res.status(201).json(timeEntry);
}));

// === ATTACHMENTS ===

// Get ticket attachments
router.get('/:id/attachments', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: {
        select: MEMBER_WITH_USER_BRIEF
      }
    }
  });

  res.json(attachments);
}));

// Upload ticket attachments
// POST /api/tickets/:id/attachments
router.post('/:id/attachments', requireStaff, (req, res) => {
  uploadAttachments(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    try {
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id: req.params.id,
          organizationId: req.organization.id
        }
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const attachments = await Promise.all(
        req.files.map(file =>
          prisma.ticketAttachment.create({
            data: {
              ticketId: req.params.id,
              fileName: file.originalname,
              fileSize: file.size,
              fileType: file.mimetype,
              fileUrl: `/uploads/attachments/${file.filename}`,
              uploadedById: req.membership.id
            },
            include: {
              uploadedBy: {
                select: MEMBER_WITH_USER_BRIEF
              }
            }
          })
        )
      );

      res.status(201).json(attachments);
    } catch (error) {
      console.error('Error uploading attachments:', error);
      res.status(500).json({ error: 'Failed to upload attachments' });
    }
  });
});

// Delete attachment
router.delete('/:id/attachments/:attachmentId', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const attachment = await prisma.ticketAttachment.findFirst({
    where: {
      id: req.params.attachmentId,
      ticketId: req.params.id
    }
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }

  if (attachment.fileUrl?.startsWith('/uploads/')) {
    deleteUploadedFile(attachment.fileUrl);
  }

  await prisma.ticketAttachment.delete({
    where: { id: req.params.attachmentId }
  });

  res.json({ message: 'Attachment deleted' });
}));

// Get staff members for assignment dropdown
router.get('/staff/list', requireStaff, asyncHandler(async (req, res) => {
  const staffMembers = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { not: 'client' }
    },
    include: {
      user: { select: USER_SELECT }
    }
  });

  res.json(staffMembers);
}));

export default router;
