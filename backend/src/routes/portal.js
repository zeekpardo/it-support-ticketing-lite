import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireClient } from '../middleware/auth.js';
import { createNotification, sendCommentNotifications } from '../services/notificationService.js';
import { uploadAttachments } from '../middleware/upload.js';
import { asyncHandler, withUpload } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { createTicketAttachments } from '../utils/entityHelpers.js';
import { sanitizeCommentHtml } from '../utils/htmlSanitizer.js';
import { USER_SELECT_BRIEF, PROJECT_SELECT_BRIEF, MEMBER_WITH_USER_BRIEF, MEMBER_WITH_ROLE_AND_USER_BRIEF } from '../utils/prismaFragments.js';
import { getPresignedUrl } from '../lib/storage.js';

const router = express.Router();

// All routes require authentication, organization context, and client role
router.use(authenticate);
router.use(requireOrganization);
router.use(requireClient);

// Get projects assigned to client
router.get('/projects', asyncHandler(async (req, res) => {
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      memberId: req.membership.id
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
          description: true,
          isActive: true,
          _count: {
            select: {
              tickets: {
                where: { clientId: req.membership.id }
              }
            }
          }
        }
      }
    }
  });

  // Filter to only active projects
  const projects = assignments
    .filter(a => a.project.isActive)
    .map(a => ({
      ...a.project,
      ticketCount: a.project._count.tickets
    }));

  res.json(projects);
}));

// Get client's own tickets
router.get('/tickets', asyncHandler(async (req, res) => {
  const { projectId, status } = req.query;

  const where = {
    organizationId: req.organization.id,
    clientId: req.membership.id
  };

  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      project: {
        select: PROJECT_SELECT_BRIEF
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
router.get('/tickets/:id', asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    include: {
      project: {
        select: PROJECT_SELECT_BRIEF
      },
      owner: {
        select: MEMBER_WITH_USER_BRIEF
      },
      // Only include public comments (isInternal = false)
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
    attachments: c.attachments ? await Promise.all(c.attachments.map(resolveUrl)) : [],
  })));

  // Resolve s3: image URLs in description HTML
  let descriptionHtml = ticket.descriptionHtml;
  if (descriptionHtml) {
    const s3Pattern = /src="s3:([^"]+)"/g;
    const matches = [...descriptionHtml.matchAll(s3Pattern)];
    if (matches.length > 0) {
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
      for (const { original, replacement } of replacements) {
        descriptionHtml = descriptionHtml.replace(original, replacement);
      }
    }
  }

  res.json({ ...ticket, attachments, descriptionHtml, comments });
}));

// Submit new ticket
router.post('/tickets', asyncHandler(async (req, res) => {
  const {
    projectId,
    subject,
    requestType,
    priorityLevel,
    description,
    screenRecordingLink
  } = req.body;

  if (!projectId || !subject || !description) {
    throw new ValidationError('Project, subject, and description are required');
  }

  // Verify client has access to this project and get project details
  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: {
        memberId: req.membership.id,
        projectId
      }
    },
    include: {
      project: {
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

  if (!assignment || !assignment.project.isActive) {
    throw new ForbiddenError('You do not have access to this project');
  }

  // Get contact info from user's profile
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { name: true, email: true, phone: true }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Parse first and last name from user's full name
  const nameParts = (user.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Calculate due date based on priority and project settings
  const effectivePriority = priorityLevel || 'MEDIUM';
  const priorityDueDaysMap = {
    LOW: assignment.project.dueDateLowDays,
    MEDIUM: assignment.project.dueDateMediumDays,
    HIGH: assignment.project.dueDateHighDays,
    URGENT: assignment.project.dueDateUrgentDays
  };
  const dueDays = priorityDueDaysMap[effectivePriority];
  const dueDate = dueDays != null ? new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000) : null;

  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: req.organization.id,
      projectId,
      clientId: req.membership.id,
      ownerId: assignment.project.defaultAssigneeId, // Auto-assign to project default
      firstName,
      lastName,
      email: user.email,
      phone: user.phone,
      subject,
      requestType: requestType || 'GENERAL_SUPPORT',
      priorityLevel: effectivePriority,
      description,
      screenRecordingLink,
      dueDate
    },
    include: {
      project: { select: PROJECT_SELECT_BRIEF }
    }
  });

  // Send notifications (non-blocking)
  try {
    const notificationData = {
      ticketId: ticket.id,
      ticketSubject: subject,
      projectName: ticket.project.name,
      requestType: requestType || 'GENERAL_SUPPORT',
      priorityLevel: effectivePriority,
      description,
      clientName: user.name || user.email,
    };

    // 1. Send confirmation to client
    await createNotification(prisma, {
      type: 'TICKET_SUBMITTED',
      recipientId: req.membership.id,
      organizationId: req.organization.id,
      data: notificationData,
      entityType: 'ticket',
      entityId: ticket.id,
    });

    // 2. Notify the assigned staff member
    if (assignment.project.defaultAssigneeId) {
      await createNotification(prisma, {
        type: 'NEW_TICKET_ASSIGNED',
        recipientId: assignment.project.defaultAssigneeId,
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
// POST /api/portal/tickets/:id/attachments
router.post('/tickets/:id/attachments', withUpload(uploadAttachments, async (req, res) => {
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

// Add public message to ticket (supports file attachments via multipart/form-data)
router.post('/tickets/:id/messages', withUpload(uploadAttachments, async (req, res) => {
  const { content, contentHtml: rawContentHtml } = req.body;

  if (!content && !rawContentHtml) {
    throw new ValidationError('Content is required');
  }

  // Verify client owns this ticket
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id,
    },
    select: { id: true, subject: true, ownerId: true, clientId: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const contentHtml = rawContentHtml ? sanitizeCommentHtml(rawContentHtml) : null;

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: req.params.id,
      authorId: req.membership.id,
      content: content || '',
      contentHtml,
      isInternal: false,
    },
    include: {
      author: { select: MEMBER_WITH_ROLE_AND_USER_BRIEF },
    },
  });

  const attachments = await createTicketAttachments(
    req.params.id, req.membership.id, req.files, comment.id
  );

  try {
    await sendCommentNotifications(prisma, {
      ticket,
      comment,
      authorName: comment.author.user.name,
      authorMemberId: req.membership.id,
      content: content || '',
      contentHtml,
      isInternal: false,
      organizationId: req.organization.id,
    });
  } catch (notifError) {
    console.error('Error sending comment notifications:', notifError);
  }

  res.status(201).json({ ...comment, attachments });
}));

// Get mentionable members for a ticket (staff members that client can mention)
router.get('/tickets/:id/mentionable-members', asyncHandler(async (req, res) => {
  // Verify client owns this ticket
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

  // Get all staff members (owner, manager, member roles) that the client can mention
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

// Get dashboard stats for client
router.get('/dashboard', asyncHandler(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    select: { status: true }
  });

  const stats = {
    total: tickets.length,
    newRequest: tickets.filter(t => t.status === 'NEW_REQUEST').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    waitingForInfo: tickets.filter(t => t.status === 'WAITING_FOR_INFO').length,
    review: tickets.filter(t => t.status === 'REVIEW').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length
  };

  // Get recent tickets
  const recentTickets = await prisma.supportTicket.findMany({
    where: {
      organizationId: req.organization.id,
      clientId: req.membership.id
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      project: { select: { id: true, name: true } }
    }
  });

  res.json({ stats, recentTickets });
}));

export default router;
