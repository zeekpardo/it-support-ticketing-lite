import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Helper to check if user has access to a project (assigned or is a client in the org)
const hasProjectAccess = async (projectId, memberId, memberRole) => {
  // Clients can access projects they're assigned to
  if (memberRole === 'client') {
    const assignment = await prisma.projectAssignment.findUnique({
      where: {
        memberId_projectId: { memberId, projectId }
      }
    });
    return !!assignment;
  }
  // Staff can access all projects in the org
  return true;
};

// Get project's software catalog (for portal users)
router.get('/projects/:projectId/software', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { categoryId, filter } = req.query;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access
    const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Build where clause for project software
    const where = { projectId };

    // Filter by category if provided
    if (categoryId) {
      where.software = {
        categoryId: categoryId
      };
    }

    // Filter by "my-software" - only show software where user has approved access
    if (filter === 'my-software') {
      where.accessRequests = {
        some: {
          requesterId: req.membership.id,
          status: 'APPROVED'
        }
      };
    }

    const projectSoftware = await prisma.projectSoftware.findMany({
      where,
      orderBy: { software: { name: 'asc' } },
      include: {
        software: {
          include: {
            category: { select: { id: true, name: true } }
          }
        },
        // Include user's own access request status
        accessRequests: {
          where: { requesterId: req.membership.id },
          select: { id: true, status: true, createdAt: true }
        }
      }
    });

    // Transform to flatten structure and include user's request status
    const result = projectSoftware.map(ps => ({
      id: ps.id,
      softwareId: ps.software.id,
      name: ps.software.name,
      description: ps.software.description,
      iconUrl: ps.software.iconUrl,
      vendor: ps.software.vendor,
      websiteUrl: ps.software.websiteUrl,
      category: ps.software.category,
      notes: ps.notes, // Project-specific notes
      myAccessRequest: ps.accessRequests[0] || null
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching software catalog:', error);
    res.status(500).json({ error: 'Failed to fetch software catalog' });
  }
});

// Get categories (global categories used by project's software)
router.get('/projects/:projectId/software/categories', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Get categories that have software added to this project
    const categories = await prisma.softwareCategory.findMany({
      where: {
        software: {
          some: {
            projectSoftware: {
              some: { projectId }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get own access request history across all projects
router.get('/my-requests', async (req, res) => {
  try {
    const { status, projectId } = req.query;

    const where = {
      requesterId: req.membership.id,
      projectSoftware: {
        project: {
          organizationId: req.organization.id
        }
      }
    };

    if (status) {
      where.status = status;
    }

    if (projectId) {
      where.projectSoftware.projectId = projectId;
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where,
      include: {
        projectSoftware: {
          include: {
            project: {
              select: { id: true, name: true, projectCode: true }
            },
            software: {
              select: {
                id: true,
                name: true,
                iconUrl: true,
                vendor: true
              }
            }
          }
        },
        reviewer: {
          select: {
            id: true,
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform to flatten structure
    const result = requests.map(r => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      reviewNotes: r.reviewNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      projectSoftwareId: r.projectSoftwareId,
      project: r.projectSoftware.project,
      software: r.projectSoftware.software,
      reviewer: r.reviewer
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// Get single project software detail
router.get('/projects/:projectId/software/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const projectSoftware = await prisma.projectSoftware.findFirst({
      where: { id, projectId },
      include: {
        software: {
          include: {
            category: { select: { id: true, name: true } }
          }
        },
        // Include user's own access request
        accessRequests: {
          where: { requesterId: req.membership.id },
          select: { id: true, status: true, reason: true, reviewNotes: true, createdAt: true, updatedAt: true }
        }
      }
    });

    if (!projectSoftware) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Transform to flatten structure
    const result = {
      id: projectSoftware.id,
      softwareId: projectSoftware.software.id,
      name: projectSoftware.software.name,
      description: projectSoftware.software.description,
      iconUrl: projectSoftware.software.iconUrl,
      vendor: projectSoftware.software.vendor,
      websiteUrl: projectSoftware.software.websiteUrl,
      category: projectSoftware.software.category,
      notes: projectSoftware.notes,
      myAccessRequest: projectSoftware.accessRequests[0] || null
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).json({ error: 'Failed to fetch software' });
  }
});

// Submit access request
router.post('/projects/:projectId/software/:id/request', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // Verify project belongs to organization and get default assignee
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id },
      select: { id: true, defaultAssigneeId: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const projectSoftware = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!projectSoftware) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Check if already has a request
    const existingRequest = await prisma.softwareAccessRequest.findFirst({
      where: {
        projectSoftwareId: id,
        requesterId: req.membership.id
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return res.status(400).json({ error: 'You already have a pending request for this software' });
      }
      if (existingRequest.status === 'APPROVED') {
        return res.status(400).json({ error: 'You already have access to this software' });
      }
      // If declined, allow re-requesting by updating the existing request
      const updated = await prisma.softwareAccessRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: 'PENDING',
          reason: req.body.reason || null,
          assigneeId: project.defaultAssigneeId,
          reviewerId: null,
          reviewNotes: null
        },
        include: {
          projectSoftware: {
            include: {
              software: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      // Notify assignee about re-submitted request
      if (project.defaultAssigneeId) {
        try {
          await createNotification(prisma, {
            type: 'ACCESS_REQUEST_SUBMITTED',
            recipientId: project.defaultAssigneeId,
            organizationId: req.organization.id,
            data: {
              requesterName: req.user.name,
              softwareName: updated.projectSoftware.software.name,
              projectId,
              projectSoftwareId: id,
            },
            entityType: 'access_request',
            entityId: updated.id,
          });
        } catch (notifError) {
          console.error('Error sending access request notification:', notifError);
        }
      }

      return res.json({
        id: updated.id,
        status: updated.status,
        reason: updated.reason,
        createdAt: updated.createdAt,
        software: updated.projectSoftware.software
      });
    }

    const { reason } = req.body;

    const request = await prisma.softwareAccessRequest.create({
      data: {
        projectSoftwareId: id,
        requesterId: req.membership.id,
        reason,
        assigneeId: project.defaultAssigneeId
      },
      include: {
        projectSoftware: {
          include: {
            software: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Notify assignee about new request
    if (project.defaultAssigneeId) {
      try {
        await createNotification(prisma, {
          type: 'ACCESS_REQUEST_SUBMITTED',
          recipientId: project.defaultAssigneeId,
          organizationId: req.organization.id,
          data: {
            requesterName: req.user.name,
            softwareName: request.projectSoftware.software.name,
            projectId,
            projectSoftwareId: id,
          },
          entityType: 'access_request',
          entityId: request.id,
        });
      } catch (notifError) {
        console.error('Error sending access request notification:', notifError);
      }
    }

    res.status(201).json({
      id: request.id,
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
      software: request.projectSoftware.software
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create access request' });
  }
});

export default router;
