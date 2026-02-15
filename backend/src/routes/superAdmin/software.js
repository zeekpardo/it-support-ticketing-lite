import express from 'express';
import { prisma } from '../../lib/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { uploadIcon } from '../../middleware/upload.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';
import { uploadFile, deleteFile, generateStorageKey } from '../../lib/storage.js';
import { resolveSoftwareIcon } from '../../middleware/iconResolver.js';

const router = express.Router();

// Get all software with filters
router.get('/', asyncHandler(async (req, res) => {
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

  const resolved = await Promise.all(software.map(resolveSoftwareIcon));
  res.json({ software: resolved, total });
}));

// Get single software by ID
router.get('/:id', asyncHandler(async (req, res) => {
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

  res.json(await resolveSoftwareIcon(software));
}));

// Create new software (auto-approved when created by super admin)
router.post('/', asyncHandler(async (req, res) => {
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

  res.status(201).json(await resolveSoftwareIcon(software));
}));

// Update software
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, iconUrl, vendor, websiteUrl, categoryId } = req.body;

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

  res.json(await resolveSoftwareIcon(software));
}));

// Upload software icon - LEAVE as multer callback pattern
router.post('/:id/icon', (req, res) => {
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

      if (existing.iconUrl?.startsWith('s3:')) {
        await deleteFile(existing.iconUrl.slice(3));
      }

      const key = generateStorageKey('icons', req.file.originalname);
      await uploadFile(req.file.buffer, key, req.file.mimetype);
      const iconUrl = `s3:${key}`;

      const software = await prisma.softwareCatalog.update({
        where: { id },
        data: { iconUrl },
        include: {
          category: true
        }
      });

      res.json(await resolveSoftwareIcon(software));
    } catch (error) {
      console.error('Error uploading icon:', error);
      res.status(500).json({ error: 'Failed to upload icon' });
    }
  });
});

// Delete software
router.delete('/:id', asyncHandler(async (req, res) => {
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

  if (existing._count.projectSoftware > 0) {
    throw new ValidationError(`Cannot delete software that is used by ${existing._count.projectSoftware} project(s). Remove from projects first.`);
  }

  if (existing.iconUrl?.startsWith('s3:')) {
    await deleteFile(existing.iconUrl.slice(3));
  }

  await prisma.softwareCatalog.delete({
    where: { id }
  });

  res.json({ message: 'Software deleted successfully' });
}));

// Approve pending software
router.put('/:id/approve', asyncHandler(async (req, res) => {
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

  res.json(await resolveSoftwareIcon(software));
}));

// Reject pending software
router.put('/:id/reject', asyncHandler(async (req, res) => {
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

  res.json(await resolveSoftwareIcon(software));
}));

export default router;
