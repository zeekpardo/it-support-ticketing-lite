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
        },
        defaultAssignee: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true } }
          }
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
          select: { timeEntries: true, tickets: true }
        },
        defaultAssignee: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true } }
          }
        },
        projectAssignments: {
          where: {
            member: {
              role: 'client'
            }
          },
          include: {
            member: {
              select: {
                id: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Transform projectAssignments to a cleaner clients array
    const clients = project.projectAssignments.map(pa => ({
      id: pa.member.id,
      userId: pa.member.user.id,
      name: pa.member.user.name,
      email: pa.member.user.email
    }));

    res.json({
      ...project,
      clients,
      projectAssignments: undefined // Remove raw assignments from response
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Default stages for new projects
const DEFAULT_STAGES = [
  { name: 'New Requests', slug: 'new_request', color: 'purple', position: 0, isDefault: true, isResolved: false },
  { name: 'In Progress', slug: 'in_progress', color: 'blue', position: 1, isDefault: false, isResolved: false },
  { name: 'Waiting for Info', slug: 'waiting_for_info', color: 'amber', position: 2, isDefault: false, isResolved: false },
  { name: 'Review', slug: 'review', color: 'cyan', position: 3, isDefault: false, isResolved: false },
  { name: 'Resolved', slug: 'resolved', color: 'green', position: 4, isDefault: false, isResolved: true }
];

// Create project (all members can create, but admins have more control)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      projectCode,
      clientName,
      description,
      defaultAssigneeId,
      dueDateLowDays,
      dueDateMediumDays,
      dueDateHighDays,
      dueDateUrgentDays
    } = req.body;

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

    // Validate defaultAssigneeId if provided
    if (defaultAssigneeId) {
      const assignee = await prisma.member.findFirst({
        where: {
          id: defaultAssigneeId,
          organizationId: req.organization.id,
          role: { in: ['owner', 'manager', 'member'] }
        }
      });
      if (!assignee) {
        return res.status(400).json({ error: 'Invalid default assignee' });
      }
    }

    // Create project with default stages in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          organizationId: req.organization.id,
          name,
          projectCode,
          clientName,
          description,
          defaultAssigneeId,
          dueDateLowDays: dueDateLowDays ?? null,
          dueDateMediumDays: dueDateMediumDays ?? null,
          dueDateHighDays: dueDateHighDays ?? null,
          dueDateUrgentDays: dueDateUrgentDays ?? null
        },
        include: {
          defaultAssignee: {
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true } }
            }
          }
        }
      });

      // Create default stages for the new project
      await tx.ticketStage.createMany({
        data: DEFAULT_STAGES.map(stage => ({
          ...stage,
          projectId: newProject.id
        }))
      });

      return newProject;
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

    const {
      name,
      projectCode,
      clientName,
      description,
      isActive,
      defaultAssigneeId,
      dueDateLowDays,
      dueDateMediumDays,
      dueDateHighDays,
      dueDateUrgentDays
    } = req.body;

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

    // Validate defaultAssigneeId if provided (null is allowed to clear it)
    if (defaultAssigneeId) {
      const assignee = await prisma.member.findFirst({
        where: {
          id: defaultAssigneeId,
          organizationId: req.organization.id,
          role: { in: ['owner', 'manager', 'member'] }
        }
      });
      if (!assignee) {
        return res.status(400).json({ error: 'Invalid default assignee' });
      }
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name : project.name,
        projectCode: projectCode !== undefined ? projectCode : project.projectCode,
        clientName: clientName !== undefined ? clientName : project.clientName,
        description: description !== undefined ? description : project.description,
        isActive: isActive !== undefined ? isActive : project.isActive,
        defaultAssigneeId: defaultAssigneeId !== undefined ? defaultAssigneeId : project.defaultAssigneeId,
        dueDateLowDays: dueDateLowDays !== undefined ? dueDateLowDays : project.dueDateLowDays,
        dueDateMediumDays: dueDateMediumDays !== undefined ? dueDateMediumDays : project.dueDateMediumDays,
        dueDateHighDays: dueDateHighDays !== undefined ? dueDateHighDays : project.dueDateHighDays,
        dueDateUrgentDays: dueDateUrgentDays !== undefined ? dueDateUrgentDays : project.dueDateUrgentDays
      },
      include: {
        defaultAssignee: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true } }
          }
        }
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

// ==========================================
// Ticket Stage Routes (nested under projects)
// ==========================================

// Helper to generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .substring(0, 50);
}

// Get all stages for a project
router.get('/:projectId/stages', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stages = await prisma.ticketStage.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { position: 'asc' },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    });

    res.json(stages);
  } catch (error) {
    console.error('Error fetching stages:', error);
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
});

// Create a new stage
router.post('/:projectId/stages', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, color, isDefault, isResolved } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color are required' });
    }

    const slug = generateSlug(name);

    // Check for duplicate slug
    const existingStage = await prisma.ticketStage.findFirst({
      where: {
        projectId: req.params.projectId,
        slug
      }
    });

    if (existingStage) {
      return res.status(400).json({ error: 'A stage with a similar name already exists' });
    }

    // Get the highest position
    const maxPositionStage = await prisma.ticketStage.findFirst({
      where: { projectId: req.params.projectId },
      orderBy: { position: 'desc' }
    });

    const newPosition = maxPositionStage ? maxPositionStage.position + 1 : 0;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.ticketStage.updateMany({
        where: { projectId: req.params.projectId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const stage = await prisma.ticketStage.create({
      data: {
        projectId: req.params.projectId,
        name,
        slug,
        color,
        position: newPosition,
        isDefault: isDefault || false,
        isResolved: isResolved || false
      },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    });

    res.status(201).json(stage);
  } catch (error) {
    console.error('Error creating stage:', error);
    res.status(500).json({ error: 'Failed to create stage' });
  }
});

// Update a stage
router.put('/:projectId/stages/:stageId', requireAdmin, async (req, res) => {
  try {
    const stage = await prisma.ticketStage.findFirst({
      where: {
        id: req.params.stageId,
        projectId: req.params.projectId,
        project: { organizationId: req.organization.id }
      }
    });

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const { name, color, isDefault, isResolved } = req.body;

    // If name is changing, generate new slug and check for duplicates
    let slug = stage.slug;
    if (name && name !== stage.name) {
      slug = generateSlug(name);
      const existingStage = await prisma.ticketStage.findFirst({
        where: {
          projectId: req.params.projectId,
          slug,
          NOT: { id: stage.id }
        }
      });

      if (existingStage) {
        return res.status(400).json({ error: 'A stage with a similar name already exists' });
      }
    }

    // If setting as default, unset other defaults
    if (isDefault && !stage.isDefault) {
      await prisma.ticketStage.updateMany({
        where: { projectId: req.params.projectId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updated = await prisma.ticketStage.update({
      where: { id: stage.id },
      data: {
        name: name !== undefined ? name : stage.name,
        slug,
        color: color !== undefined ? color : stage.color,
        isDefault: isDefault !== undefined ? isDefault : stage.isDefault,
        isResolved: isResolved !== undefined ? isResolved : stage.isResolved
      },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// Reorder stages
router.put('/:projectId/stages/reorder', requireAdmin, async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.projectId,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { stageIds } = req.body;

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return res.status(400).json({ error: 'stageIds array is required' });
    }

    // Verify all stages belong to this project
    const stages = await prisma.ticketStage.findMany({
      where: { projectId: req.params.projectId }
    });

    const projectStageIds = new Set(stages.map(s => s.id));
    const allValid = stageIds.every(id => projectStageIds.has(id));

    if (!allValid || stageIds.length !== stages.length) {
      return res.status(400).json({ error: 'Invalid stage IDs provided' });
    }

    // Update positions in a transaction
    await prisma.$transaction(
      stageIds.map((stageId, index) =>
        prisma.ticketStage.update({
          where: { id: stageId },
          data: { position: index }
        })
      )
    );

    // Return updated stages
    const updatedStages = await prisma.ticketStage.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { position: 'asc' },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    });

    res.json(updatedStages);
  } catch (error) {
    console.error('Error reordering stages:', error);
    res.status(500).json({ error: 'Failed to reorder stages' });
  }
});

// Delete a stage (requires moving tickets to another stage)
router.delete('/:projectId/stages/:stageId', requireAdmin, async (req, res) => {
  try {
    const stage = await prisma.ticketStage.findFirst({
      where: {
        id: req.params.stageId,
        projectId: req.params.projectId,
        project: { organizationId: req.organization.id }
      },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    });

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Check if this is the last stage
    const stageCount = await prisma.ticketStage.count({
      where: { projectId: req.params.projectId }
    });

    if (stageCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining stage' });
    }

    const { moveTicketsToStageId } = req.body;

    // If stage has tickets, require a destination stage
    if (stage._count.tickets > 0) {
      if (!moveTicketsToStageId) {
        return res.status(400).json({
          error: 'This stage has tickets. Please specify moveTicketsToStageId to move them to another stage.'
        });
      }

      // Verify destination stage exists and belongs to same project
      const destinationStage = await prisma.ticketStage.findFirst({
        where: {
          id: moveTicketsToStageId,
          projectId: req.params.projectId
        }
      });

      if (!destinationStage) {
        return res.status(400).json({ error: 'Destination stage not found' });
      }

      if (destinationStage.id === stage.id) {
        return res.status(400).json({ error: 'Cannot move tickets to the same stage being deleted' });
      }

      // Move tickets to destination stage
      await prisma.supportTicket.updateMany({
        where: { stageId: stage.id },
        data: { stageId: moveTicketsToStageId }
      });
    }

    // If deleted stage was default, make another stage default
    if (stage.isDefault) {
      const nextStage = await prisma.ticketStage.findFirst({
        where: {
          projectId: req.params.projectId,
          NOT: { id: stage.id }
        },
        orderBy: { position: 'asc' }
      });

      if (nextStage) {
        await prisma.ticketStage.update({
          where: { id: nextStage.id },
          data: { isDefault: true }
        });
      }
    }

    // Delete the stage
    await prisma.ticketStage.delete({
      where: { id: stage.id }
    });

    // Reorder remaining stages to fill the gap
    const remainingStages = await prisma.ticketStage.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { position: 'asc' }
    });

    await prisma.$transaction(
      remainingStages.map((s, index) =>
        prisma.ticketStage.update({
          where: { id: s.id },
          data: { position: index }
        })
      )
    );

    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Error deleting stage:', error);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

// Export DEFAULT_STAGES for use in other modules
export { DEFAULT_STAGES };

export default router;
