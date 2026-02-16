import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import { findInboxOrFail, findStageOrFail } from '../utils/entityHelpers.js';
import { pickDefined } from '../utils/inboxValidation.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

const STAGE_INCLUDE = {
  _count: { select: { tickets: true } },
};

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .substring(0, 50);
}

async function ensureSlugUnique(inboxId, slug, excludeId = null) {
  const where = { inboxId, slug };
  if (excludeId) where.NOT = { id: excludeId };

  const existing = await prisma.ticketStage.findFirst({ where });
  if (existing) {
    throw new ValidationError('A stage with a similar name already exists');
  }
}

async function clearDefaultStage(inboxId) {
  await prisma.ticketStage.updateMany({
    where: { inboxId, isDefault: true },
    data: { isDefault: false },
  });
}

// Get all stages for an inbox
router.get('/:inboxId/stages', asyncHandler(async (req, res) => {
  await findInboxOrFail(req.params.inboxId, req.organization.id);

  const stages = await prisma.ticketStage.findMany({
    where: { inboxId: req.params.inboxId },
    orderBy: { position: 'asc' },
    include: STAGE_INCLUDE,
  });

  res.json(stages);
}));

// Create a new stage
router.post('/:inboxId/stages', requireAdmin, asyncHandler(async (req, res) => {
  await findInboxOrFail(req.params.inboxId, req.organization.id);

  const { name, color, isDefault, isResolved } = req.body;

  if (!name || !color) {
    throw new ValidationError('Name and color are required');
  }

  const slug = generateSlug(name);
  await ensureSlugUnique(req.params.inboxId, slug);

  // Get the next position
  const maxPositionStage = await prisma.ticketStage.findFirst({
    where: { inboxId: req.params.inboxId },
    orderBy: { position: 'desc' },
  });
  const newPosition = maxPositionStage ? maxPositionStage.position + 1 : 0;

  if (isDefault) {
    await clearDefaultStage(req.params.inboxId);
  }

  const stage = await prisma.ticketStage.create({
    data: {
      inboxId: req.params.inboxId,
      name,
      slug,
      color,
      position: newPosition,
      isDefault: isDefault || false,
      isResolved: isResolved || false,
    },
    include: STAGE_INCLUDE,
  });

  res.status(201).json(stage);
}));

// Update a stage
router.put('/:inboxId/stages/:stageId', requireAdmin, asyncHandler(async (req, res) => {
  const stage = await findStageOrFail(req.params.stageId, req.params.inboxId, req.organization.id);

  const { name, isDefault } = req.body;

  // If name is changing, generate new slug and check for duplicates
  let slug = stage.slug;
  if (name && name !== stage.name) {
    slug = generateSlug(name);
    await ensureSlugUnique(req.params.inboxId, slug, stage.id);
  }

  if (isDefault && !stage.isDefault) {
    await clearDefaultStage(req.params.inboxId);
  }

  const data = {
    ...pickDefined(req.body, ['name', 'color', 'isDefault', 'isResolved']),
    slug,
  };

  const updated = await prisma.ticketStage.update({
    where: { id: stage.id },
    data,
    include: STAGE_INCLUDE,
  });

  res.json(updated);
}));

// Reorder stages
router.put('/:inboxId/stages/reorder', requireAdmin, asyncHandler(async (req, res) => {
  await findInboxOrFail(req.params.inboxId, req.organization.id);

  const { stageIds } = req.body;

  if (!Array.isArray(stageIds) || stageIds.length === 0) {
    throw new ValidationError('stageIds array is required');
  }

  const stages = await prisma.ticketStage.findMany({
    where: { inboxId: req.params.inboxId },
  });

  const inboxStageIds = new Set(stages.map(s => s.id));
  const allValid = stageIds.every(id => inboxStageIds.has(id));

  if (!allValid || stageIds.length !== stages.length) {
    throw new ValidationError('Invalid stage IDs provided');
  }

  await prisma.$transaction(
    stageIds.map((stageId, index) =>
      prisma.ticketStage.update({
        where: { id: stageId },
        data: { position: index },
      })
    )
  );

  const updatedStages = await prisma.ticketStage.findMany({
    where: { inboxId: req.params.inboxId },
    orderBy: { position: 'asc' },
    include: STAGE_INCLUDE,
  });

  res.json(updatedStages);
}));

// Delete a stage (requires moving tickets to another stage)
router.delete('/:inboxId/stages/:stageId', requireAdmin, asyncHandler(async (req, res) => {
  const stage = await findStageOrFail(req.params.stageId, req.params.inboxId, req.organization.id, {
    include: STAGE_INCLUDE,
  });

  const stageCount = await prisma.ticketStage.count({
    where: { inboxId: req.params.inboxId },
  });

  if (stageCount <= 1) {
    throw new ValidationError('Cannot delete the last remaining stage');
  }

  const { moveTicketsToStageId } = req.body;

  if (stage._count.tickets > 0) {
    if (!moveTicketsToStageId) {
      throw new ValidationError('This stage has tickets. Please specify moveTicketsToStageId to move them to another stage.');
    }

    const destinationStage = await prisma.ticketStage.findFirst({
      where: { id: moveTicketsToStageId, inboxId: req.params.inboxId },
    });

    if (!destinationStage) {
      throw new ValidationError('Destination stage not found');
    }

    if (destinationStage.id === stage.id) {
      throw new ValidationError('Cannot move tickets to the same stage being deleted');
    }

    await prisma.supportTicket.updateMany({
      where: { stageId: stage.id },
      data: { stageId: moveTicketsToStageId },
    });
  }

  // If deleted stage was default, promote the next one
  if (stage.isDefault) {
    const nextStage = await prisma.ticketStage.findFirst({
      where: {
        inboxId: req.params.inboxId,
        NOT: { id: stage.id },
      },
      orderBy: { position: 'asc' },
    });

    if (nextStage) {
      await prisma.ticketStage.update({
        where: { id: nextStage.id },
        data: { isDefault: true },
      });
    }
  }

  await prisma.ticketStage.delete({ where: { id: stage.id } });

  // Compact remaining positions
  const remainingStages = await prisma.ticketStage.findMany({
    where: { inboxId: req.params.inboxId },
    orderBy: { position: 'asc' },
  });

  await prisma.$transaction(
    remainingStages.map((s, index) =>
      prisma.ticketStage.update({
        where: { id: s.id },
        data: { position: index },
      })
    )
  );

  res.json({ message: 'Stage deleted successfully' });
}));

export default router;
