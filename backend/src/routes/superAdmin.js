import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to require super admin (Better Auth admin role)
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Get all users with their organization memberships and project assignments
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0, search } = req.query;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          banReason: true,
          banExpires: true,
          createdAt: true,
          members: {
            select: {
              id: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              projectAssignments: {
                select: {
                  project: {
                    select: {
                      id: true,
                      name: true,
                      projectCode: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ==========================================
// Software Catalog Management
// ==========================================

// Get all software with filters
router.get('/software', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, categoryId, search } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

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

    const [software, total] = await Promise.all([
      prisma.softwareCatalog.findMany({
        where,
        include: {
          category: true,
          submittedBy: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { projectSoftware: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.softwareCatalog.count({ where })
    ]);

    res.json({ software, total });
  } catch (error) {
    console.error('Error fetching software catalog:', error);
    res.status(500).json({ error: 'Failed to fetch software catalog' });
  }
});

// ==========================================
// Software Categories Management
// (Must be defined BEFORE /software/:id routes)
// ==========================================

// Get all categories
router.get('/software/categories', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const categories = await prisma.softwareCategory.findMany({
      include: {
        _count: {
          select: { software: true }
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

// Create category
router.post('/software/categories', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await prisma.softwareCategory.findUnique({
      where: { name }
    });

    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const category = await prisma.softwareCategory.create({
      data: { name, description }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/software/categories/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = await prisma.softwareCategory.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name && name !== existing.name) {
      const duplicate = await prisma.softwareCategory.findUnique({
        where: { name }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Category with this name already exists' });
      }
    }

    const category = await prisma.softwareCategory.update({
      where: { id },
      data: { name, description }
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/software/categories/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.softwareCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { software: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (existing._count.software > 0) {
      return res.status(400).json({
        error: `Cannot delete category with ${existing._count.software} software items. Reassign or remove them first.`
      });
    }

    await prisma.softwareCategory.delete({
      where: { id }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ==========================================
// Software Item Routes (with :id param)
// ==========================================

// Get single software by ID
router.get('/software/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const software = await prisma.softwareCatalog.findUnique({
      where: { id },
      include: {
        category: true,
        submittedBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { projectSoftware: true }
        }
      }
    });

    if (!software) {
      return res.status(404).json({ error: 'Software not found' });
    }

    res.json(software);
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).json({ error: 'Failed to fetch software' });
  }
});

// Create new software (auto-approved when created by super admin)
router.post('/software', authenticate, requireSuperAdmin, async (req, res) => {
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
        status: 'APPROVED', // Super admin created = auto-approved
        submittedById: req.user.id
      },
      include: {
        category: true
      }
    });

    res.status(201).json(software);
  } catch (error) {
    console.error('Error creating software:', error);
    res.status(500).json({ error: 'Failed to create software' });
  }
});

// Update software
router.put('/software/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

    // Check if exists
    const existing = await prisma.softwareCatalog.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Check for duplicate name (if name changed)
    if (name && name !== existing.name) {
      const duplicate = await prisma.softwareCatalog.findUnique({
        where: { name }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Software with this name already exists' });
      }
    }

    const software = await prisma.softwareCatalog.update({
      where: { id },
      data: {
        name,
        description,
        iconUrl,
        vendor,
        websiteUrl,
        categoryId: categoryId || null
      },
      include: {
        category: true
      }
    });

    res.json(software);
  } catch (error) {
    console.error('Error updating software:', error);
    res.status(500).json({ error: 'Failed to update software' });
  }
});

// Delete software
router.delete('/software/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.softwareCatalog.findUnique({
      where: { id },
      include: {
        _count: { select: { projectSoftware: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Warn if software is in use by projects
    if (existing._count.projectSoftware > 0) {
      return res.status(400).json({
        error: `Cannot delete software that is used by ${existing._count.projectSoftware} project(s). Remove from projects first.`
      });
    }

    await prisma.softwareCatalog.delete({
      where: { id }
    });

    res.json({ message: 'Software deleted successfully' });
  } catch (error) {
    console.error('Error deleting software:', error);
    res.status(500).json({ error: 'Failed to delete software' });
  }
});

// Approve pending software
router.put('/software/:id/approve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.softwareCatalog.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Software is not pending approval' });
    }

    const software = await prisma.softwareCatalog.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        category: true,
        submittedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(software);
  } catch (error) {
    console.error('Error approving software:', error);
    res.status(500).json({ error: 'Failed to approve software' });
  }
});

// Reject pending software
router.put('/software/:id/reject', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.softwareCatalog.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Software not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Software is not pending approval' });
    }

    const software = await prisma.softwareCatalog.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: {
        category: true,
        submittedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(software);
  } catch (error) {
    console.error('Error rejecting software:', error);
    res.status(500).json({ error: 'Failed to reject software' });
  }
});

export default router;
