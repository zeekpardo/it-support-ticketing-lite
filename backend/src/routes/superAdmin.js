import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { ForbiddenError } from '../utils/errors.js';
import { uploadIcon, deleteUploadedFile } from '../middleware/upload.js';
import { USER_SELECT } from '../utils/prismaFragments.js';

const router = express.Router();

// Middleware to require super admin (Better Auth admin role)
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Get all users with their organization memberships and project assignments
router.get('/users', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
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
}));

// ==========================================
// Software Catalog Management
// ==========================================

// Get all software with filters
router.get('/software', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, status, categoryId, search } = req.query;

  const where = {};

  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;

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
          select: USER_SELECT
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
}));

// ==========================================
// Software Categories Management
// (Must be defined BEFORE /software/:id routes)
// ==========================================

// Get all categories
router.get('/software/categories', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const categories = await prisma.softwareCategory.findMany({
    include: {
      _count: {
        select: { software: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.json(categories);
}));

// Create category
router.post('/software/categories', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ValidationError('Name is required');
  }

  const existing = await prisma.softwareCategory.findUnique({
    where: { name }
  });

  if (existing) {
    throw new ValidationError('Category with this name already exists');
  }

  const category = await prisma.softwareCategory.create({
    data: { name, description }
  });

  res.status(201).json(category);
}));

// Update category
router.put('/software/categories/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const existing = await prisma.softwareCategory.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  if (name && name !== existing.name) {
    const duplicate = await prisma.softwareCategory.findUnique({
      where: { name }
    });
    if (duplicate) {
      throw new ValidationError('Category with this name already exists');
    }
  }

  const category = await prisma.softwareCategory.update({
    where: { id },
    data: { name, description }
  });

  res.json(category);
}));

// Delete category
router.delete('/software/categories/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.softwareCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { software: true } }
    }
  });

  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  if (existing._count.software > 0) {
    throw new ValidationError(`Cannot delete category with ${existing._count.software} software items. Reassign or remove them first.`);
  }

  await prisma.softwareCategory.delete({
    where: { id }
  });

  res.json({ message: 'Category deleted successfully' });
}));

// ==========================================
// Software Item Routes (with :id param)
// ==========================================

// Get single software by ID
router.get('/software/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const software = await prisma.softwareCatalog.findUnique({
    where: { id },
    include: {
      category: true,
      submittedBy: {
        select: USER_SELECT
      },
      _count: {
        select: { projectSoftware: true }
      }
    }
  });

  if (!software) {
    throw new NotFoundError('Software not found');
  }

  res.json(software);
}));

// Create new software (auto-approved when created by super admin)
router.post('/software', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

  if (!name) {
    throw new ValidationError('Name is required');
  }

  // Check for duplicate name
  const existing = await prisma.softwareCatalog.findUnique({
    where: { name }
  });

  if (existing) {
    throw new ValidationError('Software with this name already exists');
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
}));

// Update software
router.put('/software/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

  // Check if exists
  const existing = await prisma.softwareCatalog.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Software not found');
  }

  // Check for duplicate name (if name changed)
  if (name && name !== existing.name) {
    const duplicate = await prisma.softwareCatalog.findUnique({
      where: { name }
    });
    if (duplicate) {
      throw new ValidationError('Software with this name already exists');
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
}));

// Upload software icon - LEAVE as multer callback pattern
// POST /api/super-admin/software/:id/icon
router.post('/software/:id/icon', authenticate, requireSuperAdmin, (req, res) => {
  uploadIcon(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const { id } = req.params;

      const existing = await prisma.softwareCatalog.findUnique({
        where: { id },
        select: { iconUrl: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Software not found' });
      }

      if (existing.iconUrl?.startsWith('/uploads/')) {
        deleteUploadedFile(existing.iconUrl);
      }

      const iconUrl = `/uploads/icons/${req.file.filename}`;

      const software = await prisma.softwareCatalog.update({
        where: { id },
        data: { iconUrl },
        include: {
          category: true
        }
      });

      res.json(software);
    } catch (error) {
      console.error('Error uploading icon:', error);
      res.status(500).json({ error: 'Failed to upload icon' });
    }
  });
});

// Delete software
router.delete('/software/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.softwareCatalog.findUnique({
    where: { id },
    include: {
      _count: { select: { projectSoftware: true } }
    }
  });

  if (!existing) {
    throw new NotFoundError('Software not found');
  }

  // Warn if software is in use by projects
  if (existing._count.projectSoftware > 0) {
    throw new ValidationError(`Cannot delete software that is used by ${existing._count.projectSoftware} project(s). Remove from projects first.`);
  }

  await prisma.softwareCatalog.delete({
    where: { id }
  });

  res.json({ message: 'Software deleted successfully' });
}));

// Approve pending software
router.put('/software/:id/approve', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.softwareCatalog.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Software not found');
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Software is not pending approval');
  }

  const software = await prisma.softwareCatalog.update({
    where: { id },
    data: { status: 'APPROVED' },
    include: {
      category: true,
      submittedBy: {
        select: USER_SELECT
      }
    }
  });

  res.json(software);
}));

// Reject pending software
router.put('/software/:id/reject', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.softwareCatalog.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Software not found');
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Software is not pending approval');
  }

  const software = await prisma.softwareCatalog.update({
    where: { id },
    data: { status: 'REJECTED' },
    include: {
      category: true,
      submittedBy: {
        select: USER_SELECT
      }
    }
  });

  res.json(software);
}));

export default router;
