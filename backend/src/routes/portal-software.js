import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireClient } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication, organization context, and client role
router.use(authenticate);
router.use(requireOrganization);
router.use(requireClient);

// Get organization's software catalog (for clients)
router.get('/', async (req, res) => {
  try {
    const { categoryId, filter } = req.query;

    // Build where clause for organization software
    const where = {
      organizationId: req.organization.id
    };

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

    const orgSoftware = await prisma.organizationSoftware.findMany({
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
    const result = orgSoftware.map(os => ({
      id: os.id,
      softwareId: os.software.id,
      name: os.software.name,
      description: os.software.description,
      iconUrl: os.software.iconUrl,
      vendor: os.software.vendor,
      websiteUrl: os.software.websiteUrl,
      category: os.software.category,
      notes: os.notes, // Organization-specific notes
      myAccessRequest: os.accessRequests[0] || null
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching software catalog:', error);
    res.status(500).json({ error: 'Failed to fetch software catalog' });
  }
});

// Get categories (global categories used by org's software)
router.get('/categories', async (req, res) => {
  try {
    // Get categories that have software added by this organization
    const categories = await prisma.softwareCategory.findMany({
      where: {
        software: {
          some: {
            organizationSoftware: {
              some: {
                organizationId: req.organization.id
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            software: {
              where: {
                organizationSoftware: {
                  some: {
                    organizationId: req.organization.id
                  }
                }
              }
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

// Get own access request history
router.get('/my-requests', async (req, res) => {
  try {
    const { status } = req.query;

    const where = {
      requesterId: req.membership.id,
      organizationSoftware: {
        organizationId: req.organization.id
      }
    };

    if (status) {
      where.status = status;
    }

    const requests = await prisma.softwareAccessRequest.findMany({
      where,
      include: {
        organizationSoftware: {
          include: {
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
      organizationSoftwareId: r.organizationSoftwareId,
      software: r.organizationSoftware.software,
      reviewer: r.reviewer
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch access requests' });
  }
});

// Get single organization software detail
router.get('/:id', async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      },
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

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Transform to flatten structure
    const result = {
      id: orgSoftware.id,
      softwareId: orgSoftware.software.id,
      name: orgSoftware.software.name,
      description: orgSoftware.software.description,
      iconUrl: orgSoftware.software.iconUrl,
      vendor: orgSoftware.software.vendor,
      websiteUrl: orgSoftware.software.websiteUrl,
      category: orgSoftware.software.category,
      notes: orgSoftware.notes,
      myAccessRequest: orgSoftware.accessRequests[0] || null
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).json({ error: 'Failed to fetch software' });
  }
});

// Submit access request
router.post('/:id/request', async (req, res) => {
  try {
    const orgSoftware = await prisma.organizationSoftware.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id
      }
    });

    if (!orgSoftware) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Check if already has a request
    const existingRequest = await prisma.softwareAccessRequest.findFirst({
      where: {
        organizationSoftwareId: req.params.id,
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
          reviewerId: null,
          reviewNotes: null
        },
        include: {
          organizationSoftware: {
            include: {
              software: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      return res.json({
        id: updated.id,
        status: updated.status,
        reason: updated.reason,
        createdAt: updated.createdAt,
        software: updated.organizationSoftware.software
      });
    }

    const { reason } = req.body;

    const request = await prisma.softwareAccessRequest.create({
      data: {
        organizationSoftwareId: req.params.id,
        requesterId: req.membership.id,
        reason
      },
      include: {
        organizationSoftware: {
          include: {
            software: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(201).json({
      id: request.id,
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
      software: request.organizationSoftware.software
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create access request' });
  }
});

export default router;
