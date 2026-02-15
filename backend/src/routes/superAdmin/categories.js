import express from 'express';
import { prisma } from '../../lib/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

const router = express.Router();

// Get all categories
router.get('/', asyncHandler(async (req, res) => {
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
router.post('/', asyncHandler(async (req, res) => {
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
router.put('/:id', asyncHandler(async (req, res) => {
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
router.delete('/:id', asyncHandler(async (req, res) => {
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

export default router;
