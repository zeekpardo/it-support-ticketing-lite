import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin, requireStaff } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { ValidationError } from '../../utils/errors.js';

const router = express.Router();

// Get approved software from global catalog
router.get('/catalog', requireStaff, asyncHandler(async (req, res) => {
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
}));

// Get categories from global catalog
router.get('/catalog/categories', requireStaff, asyncHandler(async (req, res) => {
  const categories = await prisma.softwareCategory.findMany({
    orderBy: { name: 'asc' }
  });

  res.json(categories);
}));

// Submit new software for approval
router.post('/submit', requireAdmin, asyncHandler(async (req, res) => {
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
      status: 'PENDING',
      submittedById: req.user.id
    },
    include: {
      category: true
    }
  });

  res.status(201).json(software);
}));

export default router;
