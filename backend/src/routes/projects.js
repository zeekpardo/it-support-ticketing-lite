import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Get all projects for organization
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const canSeeInactive = ['admin', 'owner'].includes(req.membership.role);

    const where = {
      organizationId: req.organization.id
    };

    // Only show active projects unless admin requests inactive ones
    if (!includeInactive || !canSeeInactive) {
      where.isActive = true;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { timeEntries: true }
        }
      }
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        _count: {
          select: { timeEntries: true }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project (all members can create, but admins have more control)
router.post('/', async (req, res) => {
  try {
    const { name, projectCode, clientName, description } = req.body;

    if (!name || !projectCode) {
      return res.status(400).json({ error: 'Name and project code are required' });
    }

    // Check if project code already exists in this org
    const existing = await prisma.project.findFirst({
      where: {
        organizationId: req.organization.id,
        projectCode
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Project code already exists' });
    }

    const project = await prisma.project.create({
      data: {
        organizationId: req.organization.id,
        name,
        projectCode,
        clientName,
        description
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project (admin/owner only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, projectCode, clientName, description, isActive } = req.body;

    // Check if new project code conflicts with existing
    if (projectCode && projectCode !== project.projectCode) {
      const existing = await prisma.project.findFirst({
        where: {
          organizationId: req.organization.id,
          projectCode,
          NOT: { id: req.params.id }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Project code already exists' });
      }
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : project.name,
        projectCode: projectCode !== undefined ? projectCode : project.projectCode,
        clientName: clientName !== undefined ? clientName : project.clientName,
        description: description !== undefined ? description : project.description,
        isActive: isActive !== undefined ? isActive : project.isActive
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project (soft delete - admin/owner only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        _count: {
          select: { timeEntries: true }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If project has time entries, soft delete
    if (project._count.timeEntries > 0) {
      await prisma.project.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });
      res.json({ message: 'Project archived (has time entries)' });
    } else {
      // If no time entries, hard delete
      await prisma.project.delete({
        where: { id: req.params.id }
      });
      res.json({ message: 'Project deleted' });
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get project statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const where = {
      projectId: req.params.id,
      organizationId: req.organization.id,
      isRunning: false
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      select: {
        durationMins: true,
        userId: true
      }
    });

    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMins || 0), 0);
    const uniqueUsers = new Set(entries.map(e => e.userId)).size;

    res.json({
      project,
      stats: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        entryCount: entries.length,
        uniqueUsers
      }
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Failed to fetch project statistics' });
  }
});

export default router;
