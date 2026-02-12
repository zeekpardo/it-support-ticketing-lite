import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(requireOrganization);

// ==========================================
// Helper Functions
// ==========================================

// Check if user has access to a project (assigned or admin)
const hasProjectAccess = async (projectId, memberId, memberRole) => {
  // Admins/owners have access to all projects
  if (memberRole === 'owner' || memberRole === 'manager') {
    return true;
  }

  // Check project assignment
  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId }
    }
  });

  return !!assignment;
};

// Check if user is a software owner for a project software
const isSoftwareOwner = async (projectSoftwareId, memberId) => {
  const admin = await prisma.projectSoftwareAdmin.findFirst({
    where: { projectSoftwareId, memberId, role: 'OWNER' }
  });
  return !!admin;
};

// Check if user is a software admin (owner or admin role)
const isSoftwareAdmin = async (projectSoftwareId, memberId) => {
  const admin = await prisma.projectSoftwareAdmin.findFirst({
    where: { projectSoftwareId, memberId }
  });
  return !!admin;
};

// ==========================================
// Global Catalog (Read-only for org users)
// ==========================================

// Get approved software from global catalog
router.get('/catalog', requireStaff, async (req, res) => {
  try {
    const { categoryId, search } = req.query;

    const where = { status: 'APPROVED' };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const software = await prisma.softwareCatalog.findMany({
      where,
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(software);
  } catch (error) {
    console.error('Error fetching catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// Get categories from global catalog
router.get('/catalog/categories', requireStaff, async (req, res) => {
  try {
    const categories = await prisma.softwareCategory.findMany({
      orderBy: { name: 'asc' }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Submit new software for approval
router.post('/submit', requireAdmin, async (req, res) => {
  try {
    const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check for duplicate name
    const existing = await prisma.softwareCatalog.findUnique({
      where: { name }
    });

    if (existing) {
      return res.status(400).json({ error: 'Software with this name already exists' });
    }

    const software = await prisma.softwareCatalog.create({
      data: {
        name,
        description,
        iconUrl,
        vendor,
        websiteUrl,
        categoryId: categoryId || null,
        status: 'PENDING',
        submittedById: req.user.id
      },
      include: {
        category: true
      }
    });

    res.status(201).json(software);
  } catch (error) {
    console.error('Error submitting software:', error);
    res.status(500).json({ error: 'Failed to submit software' });
  }
});

// ==========================================
// Project Software Management
// ==========================================

// Get project's software list
router.get('/projects/:projectId/software', async (req, res) => {
  try {
    const { projectId } = req.params;

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

    const software = await prisma.projectSoftware.findMany({
      where: { projectId },
      include: {
        software: {
          include: { category: true }
        },
        addedBy: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        _count: {
          select: { admins: true, accessRequests: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(software);
  } catch (error) {
    console.error('Error fetching project software:', error);
    res.status(500).json({ error: 'Failed to fetch project software' });
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

    // Check access
    const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId },
      include: {
        software: {
          include: { category: true }
        },
        addedBy: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        admins: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        },
        accessRequests: {
          include: {
            requester: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            },
            reviewer: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    res.json(software);
  } catch (error) {
    console.error('Error fetching project software detail:', error);
    res.status(500).json({ error: 'Failed to fetch software detail' });
  }
});

// Add software from catalog to project
router.post('/projects/:projectId/software/:softwareId', requireAdmin, async (req, res) => {
  try {
    const { projectId, softwareId } = req.params;
    const { notes } = req.body;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify software exists and is approved
    const catalogSoftware = await prisma.softwareCatalog.findUnique({
      where: { id: softwareId }
    });

    if (!catalogSoftware) {
      return res.status(404).json({ error: 'Software not found in catalog' });
    }

    if (catalogSoftware.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Software is not approved' });
    }

    // Check if already added
    const existing = await prisma.projectSoftware.findUnique({
      where: {
        projectId_softwareId: { projectId, softwareId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Software already added to project' });
    }

    // Create project software and make the adder an OWNER
    const projectSoftware = await prisma.projectSoftware.create({
      data: {
        projectId,
        softwareId,
        notes,
        addedById: req.membership.id,
        admins: {
          create: {
            memberId: req.membership.id,
            role: 'OWNER'
          }
        }
      },
      include: {
        software: {
          include: { category: true }
        },
        addedBy: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        admins: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      }
    });

    res.status(201).json(projectSoftware);
  } catch (error) {
    console.error('Error adding software to project:', error);
    res.status(500).json({ error: 'Failed to add software to project' });
  }
});

// Update project software (notes)
router.put('/projects/:projectId/software/:id', requireAdmin, async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { notes } = req.body;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existing = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Check if user is software owner or org admin
    const isOwner = await isSoftwareOwner(id, req.membership.id);
    if (!isOwner && req.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only software owner or org owner can update' });
    }

    const software = await prisma.projectSoftware.update({
      where: { id },
      data: { notes },
      include: {
        software: {
          include: { category: true }
        }
      }
    });

    res.json(software);
  } catch (error) {
    console.error('Error updating project software:', error);
    res.status(500).json({ error: 'Failed to update software' });
  }
});

// Remove software from project
router.delete('/projects/:projectId/software/:id', requireAdmin, async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existing = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Check if user is software owner or org admin
    const isOwner = await isSoftwareOwner(id, req.membership.id);
    if (!isOwner && req.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only software owner or org owner can remove' });
    }

    await prisma.projectSoftware.delete({
      where: { id }
    });

    res.json({ message: 'Software removed from project' });
  } catch (error) {
    console.error('Error removing project software:', error);
    res.status(500).json({ error: 'Failed to remove software' });
  }
});

// ==========================================
// Project Software Admins
// ==========================================

// Get software admins
router.get('/projects/:projectId/software/:id/admins', async (req, res) => {
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

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    const admins = await prisma.projectSoftwareAdmin.findMany({
      where: { projectSoftwareId: id },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Add software admin
router.post('/projects/:projectId/software/:id/admins', requireAdmin, async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { memberId, role = 'ADMIN' } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Check if user is software owner or org admin
    const isOwner = await isSoftwareOwner(id, req.membership.id);
    if (!isOwner && req.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only software owner or org owner can add admins' });
    }

    // Verify member exists in organization
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.organizationId !== req.organization.id) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check if already an admin
    const existing = await prisma.projectSoftwareAdmin.findUnique({
      where: {
        projectSoftwareId_memberId: { projectSoftwareId: id, memberId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Member is already an admin' });
    }

    const admin = await prisma.projectSoftwareAdmin.create({
      data: {
        projectSoftwareId: id,
        memberId,
        role
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.status(201).json(admin);
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({ error: 'Failed to add admin' });
  }
});

// Update admin role
router.put('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, async (req, res) => {
  try {
    const { projectId, id, adminId } = req.params;
    const { role } = req.body;

    if (!role || !['OWNER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (OWNER or ADMIN)' });
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Check if user is software owner or org admin
    const isOwner = await isSoftwareOwner(id, req.membership.id);
    if (!isOwner && req.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only software owner or org owner can update admins' });
    }

    const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
      where: { id: adminId }
    });

    if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const admin = await prisma.projectSoftwareAdmin.update({
      where: { id: adminId },
      data: { role },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(admin);
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// Remove admin
router.delete('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, async (req, res) => {
  try {
    const { projectId, id, adminId } = req.params;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Check if user is software owner or org admin
    const isOwner = await isSoftwareOwner(id, req.membership.id);
    if (!isOwner && req.membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only software owner or org owner can remove admins' });
    }

    const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
      where: { id: adminId }
    });

    if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Prevent removing the last owner
    if (existingAdmin.role === 'OWNER') {
      const ownerCount = await prisma.projectSoftwareAdmin.count({
        where: { projectSoftwareId: id, role: 'OWNER' }
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner. Transfer ownership first.' });
      }
    }

    await prisma.projectSoftwareAdmin.delete({
      where: { id: adminId }
    });

    res.json({ message: 'Admin removed' });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

// ==========================================
// Access Requests
// ==========================================

// Get all pending access requests for a project's software
router.get('/projects/:projectId/software/:id/requests', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { status } = req.query;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Only admins or software admins can view requests
    const isAdmin = await isSoftwareAdmin(id, req.membership.id);
    if (!isAdmin && req.membership.role !== 'owner' && req.membership.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = { projectSoftwareId: id };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where,
      include: {
        requester: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        reviewer: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get all pending requests across all projects in the organization
router.get('/requests/pending', requireStaff, async (req, res) => {
  try {
    const { projectId } = req.query;

    const where = {
      status: 'PENDING',
      projectSoftware: {
        project: {
          organizationId: req.organization.id
        }
      }
    };

    // Optionally filter by project
    if (projectId) {
      where.projectSoftware.projectId = projectId;
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where,
      include: {
        projectSoftware: {
          include: {
            software: true,
            project: {
              select: { id: true, name: true, projectCode: true, defaultAssigneeId: true }
            }
          }
        },
        requester: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        assignee: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching all pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get all pending requests across all software in a project
router.get('/projects/:projectId/requests', requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where: {
        status: 'PENDING',
        projectSoftware: { projectId }
      },
      include: {
        projectSoftware: {
          include: {
            software: true
          }
        },
        requester: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching project requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Assign a request to a staff member
router.put('/requests/:requestId/assign', requireStaff, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { assigneeId } = req.body;

    // Find the request and verify it belongs to this organization
    const request = await prisma.softwareAccessRequest.findFirst({
      where: {
        id: requestId,
        projectSoftware: {
          project: {
            organizationId: req.organization.id
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // If assigneeId provided, verify the member exists and is staff
    if (assigneeId) {
      const assignee = await prisma.member.findFirst({
        where: {
          id: assigneeId,
          organizationId: req.organization.id,
          role: { in: ['owner', 'manager', 'member'] }
        }
      });

      if (!assignee) {
        return res.status(400).json({ error: 'Invalid assignee' });
      }
    }

    const updated = await prisma.softwareAccessRequest.update({
      where: { id: requestId },
      data: { assigneeId: assigneeId || null },
      include: {
        projectSoftware: {
          include: {
            software: true,
            project: {
              select: { id: true, name: true, projectCode: true }
            }
          }
        },
        requester: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        assignee: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error assigning request:', error);
    res.status(500).json({ error: 'Failed to assign request' });
  }
});

// Review access request (approve/decline)
router.put('/projects/:projectId/software/:id/requests/:requestId', async (req, res) => {
  try {
    const { projectId, id, requestId } = req.params;
    const { status, reviewNotes } = req.body;

    if (!status || !['APPROVED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (APPROVED or DECLINED)' });
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const software = await prisma.projectSoftware.findFirst({
      where: { id, projectId }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in project' });
    }

    // Only admins or software admins can review
    const isAdmin = await isSoftwareAdmin(id, req.membership.id);
    if (!isAdmin && req.membership.role !== 'owner' && req.membership.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const request = await prisma.softwareAccessRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.projectSoftwareId !== id) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    const updated = await prisma.softwareAccessRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewNotes,
        reviewerId: req.membership.id
      },
      include: {
        requester: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        reviewer: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error reviewing request:', error);
    res.status(500).json({ error: 'Failed to review request' });
  }
});

export default router;
