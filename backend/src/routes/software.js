import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Helper function to check if user is a software owner for org software
const isOrgSoftwareOwner = async (orgSoftwareId, memberId) => {
  const admin = await prisma.softwareAdmin.findFirst({
    where: { organizationSoftwareId: orgSoftwareId, memberId, role: 'OWNER' }
  });
  return !!admin;
};

// Helper function to check if user is a software admin (owner or admin)
const isOrgSoftwareAdminOrOwner = async (orgSoftwareId, memberId) => {
  const admin = await prisma.softwareAdmin.findFirst({
    where: { organizationSoftwareId: orgSoftwareId, memberId }
  });
  return !!admin;
};

// ==========================================
// GLOBAL CATALOG (Read-only for org users)
// ==========================================

// Get global software catalog (approved items only)
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

    // Check which software the organization has already added
    const orgSoftware = await prisma.organizationSoftware.findMany({
      where: { organizationId: req.organization.id },
      select: { softwareId: true }
    });
    const addedSoftwareIds = new Set(orgSoftware.map(os => os.softwareId));

    // Add 'isAdded' flag to each software item
    const softwareWithStatus = software.map(s => ({
      ...s,
      isAdded: addedSoftwareIds.has(s.id)
    }));

    res.json(softwareWithStatus);
  } catch (error) {
    console.error('Error fetching catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// Get global software categories
router.get('/catalog/categories', requireStaff, async (req, res) => {
  try {
    const categories = await prisma.softwareCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            software: {
              where: { status: 'APPROVED' }
            }
          }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single global software detail
router.get('/catalog/:id', requireStaff, async (req, res) => {
  try {
    const software = await prisma.softwareCatalog.findFirst({
      where: { id: req.params.id, status: 'APPROVED' },
      include: { category: true }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Check if organization has added this software
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        organizationId: req.organization.id,
        softwareId: req.params.id
      }
    });

    res.json({
      ...software,
      isAdded: !!orgSoftware,
      organizationSoftwareId: orgSoftware?.id || null
    });
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).json({ error: 'Failed to fetch software' });
  }
});

// Submit new software for approval
router.post('/submit', requireAdmin, async (req, res) => {
  try {
    const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Software name is required' });
    }

    // Check if software with this name already exists
    const existing = await prisma.softwareCatalog.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      return res.status(400).json({ error: 'Software with this name already exists in the catalog' });
    }

    const software = await prisma.softwareCatalog.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        iconUrl: iconUrl?.trim() || null,
        vendor: vendor?.trim() || null,
        websiteUrl: websiteUrl?.trim() || null,
        categoryId: categoryId || null,
        status: 'PENDING',
        submittedById: req.user.id
      },
      include: { category: true }
    });

    res.status(201).json(software);
  } catch (error) {
    console.error('Error submitting software:', error);
    res.status(500).json({ error: 'Failed to submit software' });
  }
});

// ==========================================
// ORGANIZATION SOFTWARE
// ==========================================

// Get organization's software list
router.get('/organization', requireStaff, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findMany({
      where: { organizationId: req.organization.id },
      include: {
        software: {
          include: { category: true }
        },
        addedBy: {
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        },
        _count: {
          select: { admins: true, accessRequests: true }
        }
      },
      orderBy: { software: { name: 'asc' } }
    });

    res.json(orgSoftware);
  } catch (error) {
    console.error('Error fetching organization software:', error);
    res.status(500).json({ error: 'Failed to fetch organization software' });
  }
});

// Add software from global catalog to organization
router.post('/organization/:softwareId', requireAdmin, async (req, res) => {
  try {
    const { softwareId } = req.params;
    const { notes } = req.body;

    // Verify software exists and is approved
    const software = await prisma.softwareCatalog.findFirst({
      where: { id: softwareId, status: 'APPROVED' }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found in catalog' });
    }

    // Check if already added
    const existing = await prisma.organizationSoftware.findFirst({
      where: { organizationId: req.organization.id, softwareId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Software already added to organization' });
    }

    // Create organization software and add current user as owner
    const orgSoftware = await prisma.organizationSoftware.create({
      data: {
        organizationId: req.organization.id,
        softwareId,
        notes: notes?.trim() || null,
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
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        },
        admins: {
          include: {
            member: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      }
    });

    res.status(201).json(orgSoftware);
  } catch (error) {
    console.error('Error adding software to organization:', error);
    res.status(500).json({ error: 'Failed to add software to organization' });
  }
});

// Get single organization software detail
router.get('/organization/:id', requireStaff, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
      include: {
        software: {
          include: { category: true }
        },
        addedBy: {
          select: {
            id: true,
            user: { select: { id: true, name: true } }
          }
        },
        admins: {
          include: {
            member: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true, image: true } }
              }
            }
          },
          orderBy: { role: 'asc' }
        },
        accessRequests: {
          include: {
            requester: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true } }
              }
            },
            reviewer: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    res.json(orgSoftware);
  } catch (error) {
    console.error('Error fetching organization software:', error);
    res.status(500).json({ error: 'Failed to fetch organization software' });
  }
});

// Update organization software (notes only - requires owner)
router.put('/organization/:id', requireAdmin, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is owner
    const isOwner = await isOrgSoftwareOwner(req.params.id, req.membership.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only software owners can update software details' });
    }

    const { notes } = req.body;

    const updated = await prisma.organizationSoftware.update({
      where: { id: req.params.id },
      data: { notes: notes?.trim() || null },
      include: {
        software: {
          include: { category: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating organization software:', error);
    res.status(500).json({ error: 'Failed to update organization software' });
  }
});

// Remove software from organization (requires owner)
router.delete('/organization/:id', requireAdmin, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is owner
    const isOwner = await isOrgSoftwareOwner(req.params.id, req.membership.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only software owners can remove software from organization' });
    }

    await prisma.organizationSoftware.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing organization software:', error);
    res.status(500).json({ error: 'Failed to remove organization software' });
  }
});

// ==========================================
// SOFTWARE ADMINS
// ==========================================

// Get admins for organization software
router.get('/organization/:id/admins', requireStaff, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    const admins = await prisma.softwareAdmin.findMany({
      where: { organizationSoftwareId: req.params.id },
      include: {
        member: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        }
      },
      orderBy: { role: 'asc' }
    });

    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Add admin (requires owner)
router.post('/organization/:id/admins', requireAdmin, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is owner
    const isOwner = await isOrgSoftwareOwner(req.params.id, req.membership.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only software owners can add admins' });
    }

    const { memberId, role } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    if (role && !['OWNER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be OWNER or ADMIN' });
    }

    // Verify member exists in org and is not a client
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: req.organization.id,
        role: { in: ['owner', 'manager', 'member'] }
      }
    });

    if (!member) {
      return res.status(400).json({ error: 'Invalid member or member is a client' });
    }

    // Check if already an admin
    const existingAdmin = await prisma.softwareAdmin.findFirst({
      where: { organizationSoftwareId: req.params.id, memberId }
    });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Member is already an admin for this software' });
    }

    const admin = await prisma.softwareAdmin.create({
      data: {
        organizationSoftwareId: req.params.id,
        memberId,
        role: role || 'ADMIN'
      },
      include: {
        member: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true, image: true } }
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

// Update admin role (requires owner)
router.put('/organization/:id/admins/:adminId', requireAdmin, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is owner
    const isOwner = await isOrgSoftwareOwner(req.params.id, req.membership.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only software owners can update admin roles' });
    }

    const admin = await prisma.softwareAdmin.findFirst({
      where: { id: req.params.adminId, organizationSoftwareId: req.params.id }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const { role } = req.body;

    if (!role || !['OWNER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be OWNER or ADMIN' });
    }

    const updated = await prisma.softwareAdmin.update({
      where: { id: req.params.adminId },
      data: { role },
      include: {
        member: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true, image: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// Remove admin (requires owner)
router.delete('/organization/:id/admins/:adminId', requireAdmin, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is owner
    const isOwner = await isOrgSoftwareOwner(req.params.id, req.membership.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only software owners can remove admins' });
    }

    const admin = await prisma.softwareAdmin.findFirst({
      where: { id: req.params.adminId, organizationSoftwareId: req.params.id }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Prevent removing the last owner
    if (admin.role === 'OWNER') {
      const ownerCount = await prisma.softwareAdmin.count({
        where: { organizationSoftwareId: req.params.id, role: 'OWNER' }
      });

      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner' });
      }
    }

    await prisma.softwareAdmin.delete({
      where: { id: req.params.adminId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

// ==========================================
// ACCESS REQUESTS
// ==========================================

// Get all pending access requests across organization
router.get('/requests', requireAdmin, async (req, res) => {
  try {
    const requests = await prisma.softwareAccessRequest.findMany({
      where: {
        status: 'PENDING',
        organizationSoftware: {
          organizationId: req.organization.id
        }
      },
      include: {
        organizationSoftware: {
          include: {
            software: {
              select: { id: true, name: true, iconUrl: true }
            }
          }
        },
        requester: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// Get access requests for specific organization software
router.get('/organization/:id/requests', requireStaff, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    const { status } = req.query;

    const where = { organizationSoftwareId: req.params.id };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        reviewer: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// Review (approve/decline) access request
router.put('/organization/:id/requests/:requestId', requireStaff, async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Organization software not found' });
    }

    // Check if user is a software admin or owner
    const isAdmin = await isOrgSoftwareAdminOrOwner(req.params.id, req.membership.id);
    // Also allow org admins to review
    const isOrgAdmin = ['owner', 'manager'].includes(req.membership.role);

    if (!isAdmin && !isOrgAdmin) {
      return res.status(403).json({ error: 'Only software admins can review access requests' });
    }

    const request = await prisma.softwareAccessRequest.findFirst({
      where: { id: req.params.requestId, organizationSoftwareId: req.params.id }
    });

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    const { status, reviewNotes } = req.body;

    if (!status || !['APPROVED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or DECLINED' });
    }

    const updated = await prisma.softwareAccessRequest.update({
      where: { id: req.params.requestId },
      data: {
        status,
        reviewNotes,
        reviewerId: req.membership.id
      },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        reviewer: {
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
    console.error('Error reviewing request:', error);
    res.status(500).json({ error: 'Failed to review access request' });
  }
});

export default router;
