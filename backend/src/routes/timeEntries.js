import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Get time entries (members see own, admins/owners see all)
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, projectId, userId } = req.query;
    const canViewAll = ['admin', 'owner'].includes(req.membership.role);

    const where = {
      organizationId: req.organization.id
    };

    // Members can only see their own entries
    if (!canViewAll) {
      where.userId = req.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get single time entry
router.get('/:id', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        project: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    // Members can only view their own entries
    const canViewAll = ['admin', 'owner'].includes(req.membership.role);
    if (!canViewAll && entry.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Error fetching time entry:', error);
    res.status(500).json({ error: 'Failed to fetch time entry' });
  }
});

// Create time entry (manual entry or start timer)
router.post('/', async (req, res) => {
  try {
    const { projectId, taskName, startTime, endTime, notes, isRunning } = req.body;

    if (!projectId || !taskName) {
      return res.status(400).json({ error: 'Project ID and task name are required' });
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: req.organization.id,
        isActive: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If starting a timer, stop any running timers for this user
    if (isRunning) {
      await prisma.timeEntry.updateMany({
        where: {
          userId: req.user.id,
          organizationId: req.organization.id,
          isRunning: true
        },
        data: {
          isRunning: false,
          endTime: new Date(),
          durationMins: null // Will be calculated on stop
        }
      });
    }

    // Calculate duration for manual entries
    let durationMins = null;
    if (!isRunning && startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      durationMins = Math.round((end - start) / 60000);
    }

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: req.organization.id,
        userId: req.user.id,
        projectId,
        taskName,
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : null,
        durationMins,
        isRunning: isRunning || false,
        notes
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Update time entry
router.put('/:id', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    // Check permission
    const canEditAll = ['admin', 'owner'].includes(req.membership.role);
    if (!canEditAll && entry.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { projectId, taskName, startTime, endTime, notes } = req.body;

    // Verify project if changing
    if (projectId && projectId !== entry.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId: req.organization.id,
          isActive: true
        }
      });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    // Calculate duration
    let durationMins = entry.durationMins;
    const newStartTime = startTime ? new Date(startTime) : entry.startTime;
    const newEndTime = endTime ? new Date(endTime) : entry.endTime;
    if (newStartTime && newEndTime) {
      durationMins = Math.round((newEndTime - newStartTime) / 60000);
    }

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        projectId: projectId || entry.projectId,
        taskName: taskName || entry.taskName,
        startTime: newStartTime,
        endTime: newEndTime,
        durationMins,
        notes: notes !== undefined ? notes : entry.notes
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Stop running timer
router.post('/:id/stop', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
        isRunning: true
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Running timer not found' });
    }

    // Only the owner of the timer or admin can stop it
    const canEditAll = ['admin', 'owner'].includes(req.membership.role);
    if (!canEditAll && entry.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const endTime = new Date();
    const durationMins = Math.round((endTime - entry.startTime) / 60000);

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        isRunning: false,
        endTime,
        durationMins
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Get currently running timer for user
router.get('/running/current', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user.id,
        organizationId: req.organization.id,
        isRunning: true
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true }
        },
        ticket: {
          select: {
            id: true,
            subject: true,
            project: {
              select: { id: true, name: true, projectCode: true }
            }
          }
        }
      }
    });

    res.json(entry);
  } catch (error) {
    console.error('Error fetching running timer:', error);
    res.status(500).json({ error: 'Failed to fetch running timer' });
  }
});

// Delete time entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    // Check permission
    const canDeleteAll = ['admin', 'owner'].includes(req.membership.role);
    if (!canDeleteAll && entry.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.timeEntry.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Time entry deleted' });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

export default router;
