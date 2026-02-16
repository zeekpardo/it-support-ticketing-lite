import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { findMemberOrFail, findInboxOrFail } from '../utils/entityHelpers.js';
import { INBOX_ASSIGNMENT_INCLUDE } from '../utils/prismaFragments.js';

const router = express.Router();

// Get inbox assignments for a specific member
// GET /api/members/:memberId/inboxes
router.get('/:memberId/inboxes', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  await findMemberOrFail(memberId, req.organization.id);

  const assignments = await prisma.inboxAssignment.findMany({
    where: { memberId },
    include: INBOX_ASSIGNMENT_INCLUDE
  });

  res.json(assignments);
}));

// Assign an inbox to a member (typically a client)
// POST /api/members/:memberId/inboxes
router.post('/:memberId/inboxes', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { inboxId } = req.body;

  if (!inboxId) {
    throw new ValidationError('Inbox ID is required');
  }

  await findMemberOrFail(memberId, req.organization.id);
  await findInboxOrFail(inboxId, req.organization.id);

  const existingAssignment = await prisma.inboxAssignment.findUnique({
    where: {
      memberId_inboxId: { memberId, inboxId }
    }
  });

  if (existingAssignment) {
    throw new ValidationError('Inbox is already assigned to this member');
  }

  const assignment = await prisma.inboxAssignment.create({
    data: {
      memberId,
      inboxId
    },
    include: INBOX_ASSIGNMENT_INCLUDE
  });

  res.status(201).json(assignment);
}));

// Remove an inbox assignment from a member
// DELETE /api/members/:memberId/inboxes/:inboxId
router.delete('/:memberId/inboxes/:inboxId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId, inboxId } = req.params;

  await findMemberOrFail(memberId, req.organization.id);

  try {
    await prisma.inboxAssignment.delete({
      where: {
        memberId_inboxId: { memberId, inboxId }
      }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new NotFoundError('Inbox assignment not found');
    }
    throw error;
  }

  res.json({ message: 'Inbox assignment removed' });
}));

// Bulk update inbox assignments for a member
// PUT /api/members/:memberId/inboxes
router.put('/:memberId/inboxes', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { inboxIds } = req.body;

  if (!Array.isArray(inboxIds)) {
    throw new ValidationError('inboxIds must be an array');
  }

  await findMemberOrFail(memberId, req.organization.id);

  const inboxes = await prisma.inbox.findMany({
    where: {
      id: { in: inboxIds },
      organizationId: req.organization.id
    }
  });

  if (inboxes.length !== inboxIds.length) {
    throw new ValidationError('One or more inboxes not found');
  }

  await prisma.$transaction([
    prisma.inboxAssignment.deleteMany({
      where: { memberId }
    }),
    ...inboxIds.map(inboxId =>
      prisma.inboxAssignment.create({
        data: { memberId, inboxId }
      })
    )
  ]);

  const assignments = await prisma.inboxAssignment.findMany({
    where: { memberId },
    include: INBOX_ASSIGNMENT_INCLUDE
  });

  res.json(assignments);
}));

export default router;
