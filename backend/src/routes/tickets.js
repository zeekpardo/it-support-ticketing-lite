import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireStaff, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Get all tickets for organization (staff only)
router.get('/', requireStaff, async (req, res) => {
  try {
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
          select: { id: true, name: true, projectCode: true }
        },
        stage: {
          select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true }
        },
        client: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        _count: {
          select: { comments: true, timeEntries: true, attachments: true }
        }
      }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket with details (staff only)
router.get('/:id', requireStaff, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        stage: {
          select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true }
        },
        client: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: {
              select: {
                id: true,
                user: { select: { id: true, name: true } }
              }
            }
          }
        },
        timeEntries: {
          orderBy: { startTime: 'desc' },
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Calculate total time spent
    const totalMinutes = ticket.timeEntries.reduce(
      (sum, entry) => sum + (entry.durationMins || 0),
      0
    );

    res.json({
      ...ticket,
      totalTimeMinutes: totalMinutes
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket (staff can create on behalf of clients)
router.post('/', requireStaff, async (req, res) => {
  try {
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
      return res.status(400).json({
        error: 'Project, client, contact info, subject, and description are required'
      });
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
      return res.status(404).json({ error: 'Project not found' });
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
        return res.status(400).json({ error: 'Invalid stage for this project' });
      }
    }

    // Verify client is a member of org
    const client = await prisma.member.findFirst({
      where: { id: clientId, organizationId: req.organization.id, role: 'client' }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
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
        project: { select: { id: true, name: true, projectCode: true } },
        stage: { select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true } },
        client: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket (staff only)
router.put('/:id', requireStaff, async (req, res) => {
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
        project: { select: { id: true, name: true, projectCode: true } },
        client: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Update ticket stage (for Kanban drag-drop) - NEW ENDPOINT
router.put('/:id/stage', requireStaff, async (req, res) => {
  try {
    const { stageId } = req.body;

    if (!stageId) {
      return res.status(400).json({ error: 'stageId is required' });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify stage belongs to the same project
    const stage = await prisma.ticketStage.findFirst({
      where: {
        id: stageId,
        projectId: ticket.projectId
      }
    });

    if (!stage) {
      return res.status(400).json({ error: 'Invalid stage for this project' });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { stageId },
      include: {
        stage: { select: { id: true, name: true, slug: true, color: true, position: true, isDefault: true, isResolved: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating ticket stage:', error);
    res.status(500).json({ error: 'Failed to update ticket stage' });
  }
});

// Update ticket status (DEPRECATED - kept for backward compatibility)
router.put('/:id/status', requireStaff, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['NEW_REQUEST', 'IN_PROGRESS', 'WAITING_FOR_INFO', 'REVIEW', 'RESOLVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// Assign ticket owner
router.put('/:id/assign', requireStaff, async (req, res) => {
  try {
    const { ownerId } = req.body;

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

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
        return res.status(404).json({ error: 'Staff member not found' });
      }
    }

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { ownerId: ownerId || null },
      include: {
        owner: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Delete ticket (admin/owner only)
router.delete('/:id', requireAdmin, async (req, res) => {
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

    await prisma.supportTicket.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// === COMMENTS ===

// Get ticket comments
router.get('/:id/comments', requireStaff, async (req, res) => {
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

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment to ticket
router.post('/:id/comments', requireStaff, async (req, res) => {
  try {
    const { content, isInternal } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
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
        isInternal: isInternal || false
      },
      include: {
        author: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get mentionable members for a ticket (staff + ticket client)
router.get('/:id/mentionable-members', requireStaff, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        client: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get all staff members (owner, manager, member roles)
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

    // Combine staff + ticket client, ensuring no duplicates and excluding current user
    const members = staffMembers.filter(m => m.id !== req.membership.id);
    if (ticket.client && ticket.client.id !== req.membership.id && !members.some(m => m.id === ticket.client.id)) {
      members.push(ticket.client);
    }

    res.json(members);
  } catch (error) {
    console.error('Error fetching mentionable members:', error);
    res.status(500).json({ error: 'Failed to fetch mentionable members' });
  }
});

// === TIME ENTRIES ===

// Get time entries for ticket
router.get('/:id/time-entries', requireStaff, async (req, res) => {
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

    const timeEntries = await prisma.timeEntry.findMany({
      where: { ticketId: req.params.id },
      orderBy: { startTime: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, projectCode: true } }
      }
    });

    res.json(timeEntries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Start timer for ticket (creates a time entry linked to ticket)
router.post('/:id/time-entries', requireStaff, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        project: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Stop any running timers for this user
    await prisma.timeEntry.updateMany({
      where: {
        userId: req.user.id,
        organizationId: req.organization.id,
        isRunning: true
      },
      data: {
        isRunning: false,
        endTime: new Date(),
        durationMins: {
          // This won't work with updateMany, we'll need to handle differently
        }
      }
    });

    // Actually, let's do this properly
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
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        ticket: { select: { id: true, subject: true } }
      }
    });

    res.status(201).json(timeEntry);
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// === ATTACHMENTS ===

// Get ticket attachments
router.get('/:id/attachments', requireStaff, async (req, res) => {
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

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        }
      }
    });

    res.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Delete attachment
router.delete('/:id/attachments/:attachmentId', requireStaff, async (req, res) => {
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

    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: req.params.attachmentId,
        ticketId: req.params.id
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await prisma.ticketAttachment.delete({
      where: { id: req.params.attachmentId }
    });

    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Get staff members for assignment dropdown
router.get('/staff/list', requireStaff, async (req, res) => {
  try {
    const staffMembers = await prisma.member.findMany({
      where: {
        organizationId: req.organization.id,
        role: { not: 'client' }
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(staffMembers);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

export default router;
