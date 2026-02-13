import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireClient } from '../middleware/auth.js';
import { createNotification, parseMentions } from '../services/notificationService.js';
import { uploadAttachments } from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication, organization context, and client role
router.use(authenticate);
router.use(requireOrganization);
router.use(requireClient);

// Get projects assigned to client
router.get('/projects', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error fetching client projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get client's own tickets
router.get('/tickets', async (req, res) => {
  try {
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
          select: { id: true, name: true, projectCode: true }
        },
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        },
        _count: {
          select: {
            comments: { where: { isInternal: false } }
          }
        }
      }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching client tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket (client can only see their own)
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
        clientId: req.membership.id
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        },
        // Only include public comments (isInternal = false)
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true } }
              }
            }
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
            createdAt: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Submit new ticket
router.post('/tickets', async (req, res) => {
  try {
    const {
      projectId,
      subject,
      requestType,
      priorityLevel,
      description,
      screenRecordingLink
    } = req.body;

    if (!projectId || !subject || !description) {
      return res.status(400).json({
        error: 'Project, subject, and description are required'
      });
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
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Get contact info from user's profile
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true, phone: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
        project: { select: { id: true, name: true, projectCode: true } }
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
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Upload attachments to a portal ticket
// POST /api/portal/tickets/:id/attachments
router.post('/tickets/:id/attachments', (req, res) => {
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
          organizationId: req.organization.id,
          clientId: req.membership.id
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

// Add public message to ticket
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify client owns this ticket
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
        clientId: req.membership.id
      },
      select: {
        id: true,
        subject: true,
        ownerId: true,
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: req.params.id,
        authorId: req.membership.id,
        content,
        isInternal: false // Client comments are always public
      },
      include: {
        author: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true } }
          }
        }
      }
    });

    // Send notifications (non-blocking)
    try {
      const authorName = comment.author.user.name;
      const notificationData = {
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        authorName,
        commentId: comment.id,
        commentContent: content, // For email notifications
      };

      // 1. Parse @mentions and notify mentioned staff members
      const mentionedMemberIds = parseMentions(content);
      if (mentionedMemberIds.length > 0) {
        for (const memberId of mentionedMemberIds) {
          if (memberId === req.membership.id) continue; // Don't notify self

          await createNotification(prisma, {
            type: 'MENTION',
            recipientId: memberId,
            organizationId: req.organization.id,
            data: notificationData,
            entityType: 'comment',
            entityId: comment.id,
          });
        }
      }

      // 2. Notify ticket owner if they weren't mentioned
      if (ticket.ownerId && !mentionedMemberIds.includes(ticket.ownerId)) {
        await createNotification(prisma, {
          type: 'TICKET_COMMENT',
          recipientId: ticket.ownerId,
          organizationId: req.organization.id,
          data: notificationData,
          entityType: 'comment',
          entityId: comment.id,
        });
      }
    } catch (notifError) {
      console.error('Error sending comment notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Get mentionable members for a ticket (staff members that client can mention)
router.get('/tickets/:id/mentionable-members', async (req, res) => {
  try {
    // Verify client owns this ticket
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
        clientId: req.membership.id
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
  } catch (error) {
    console.error('Error fetching mentionable members:', error);
    res.status(500).json({ error: 'Failed to fetch mentionable members' });
  }
});

// Get dashboard stats for client
router.get('/dashboard', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

export default router;
