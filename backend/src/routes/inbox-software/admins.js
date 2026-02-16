import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { findInboxOrFail, hasInboxAccess, isSoftwareOwner } from '../../utils/entityHelpers.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';

const router = express.Router();

// Get software admins
router.get('/inboxes/:inboxId/software/:id/admins', asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  const software = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in inbox');
  }

  const admins = await prisma.inboxSoftwareAdmin.findMany({
    where: { inboxSoftwareId: id },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.json(admins);
}));

// Add software admin
router.post('/inboxes/:inboxId/software/:id/admins', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;
  const { memberId, role = 'ADMIN' } = req.body;

  if (!memberId) {
    throw new ValidationError('Member ID is required');
  }

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const software = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in inbox');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can add admins');
  }

  // Verify member exists in organization
  const member = await prisma.member.findUnique({
    where: { id: memberId }
  });

  if (!member || member.organizationId !== req.organization.id) {
    throw new NotFoundError('Member not found');
  }

  // Check if already an admin
  const existing = await prisma.inboxSoftwareAdmin.findUnique({
    where: {
      inboxSoftwareId_memberId: { inboxSoftwareId: id, memberId }
    }
  });

  if (existing) {
    throw new ValidationError('Member is already an admin');
  }

  const admin = await prisma.inboxSoftwareAdmin.create({
    data: {
      inboxSoftwareId: id,
      memberId,
      role
    },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.status(201).json(admin);
}));

// Update admin role
router.put('/inboxes/:inboxId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, id, adminId } = req.params;
  const { role } = req.body;

  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    throw new ValidationError('Valid role is required (OWNER or ADMIN)');
  }

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const software = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in inbox');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can update admins');
  }

  const existingAdmin = await prisma.inboxSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.inboxSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  const admin = await prisma.inboxSoftwareAdmin.update({
    where: { id: adminId },
    data: { role },
    include: {
      member: {
        include: {
          user: { select: USER_SELECT }
        }
      }
    }
  });

  res.json(admin);
}));

// Remove admin
router.delete('/inboxes/:inboxId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { inboxId, id, adminId } = req.params;

  // Verify inbox belongs to organization
  await findInboxOrFail(inboxId, req.organization.id);

  const software = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in inbox');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can remove admins');
  }

  const existingAdmin = await prisma.inboxSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.inboxSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  // Prevent removing the last owner
  if (existingAdmin.role === 'OWNER') {
    const ownerCount = await prisma.inboxSoftwareAdmin.count({
      where: { inboxSoftwareId: id, role: 'OWNER' }
    });
    if (ownerCount <= 1) {
      throw new ValidationError('Cannot remove the last owner. Transfer ownership first.');
    }
  }

  await prisma.inboxSoftwareAdmin.delete({
    where: { id: adminId }
  });

  res.json({ message: 'Admin removed' });
}));

export default router;
