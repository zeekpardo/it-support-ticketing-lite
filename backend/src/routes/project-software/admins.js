import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { findProjectOrFail, hasProjectAccess, isSoftwareOwner } from '../../utils/entityHelpers.js';
import { USER_SELECT } from '../../utils/prismaFragments.js';

const router = express.Router();

// Get software admins
router.get('/projects/:projectId/software/:id/admins', asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const hasAccess = await hasProjectAccess(projectId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this project');
  }

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  const admins = await prisma.projectSoftwareAdmin.findMany({
    where: { projectSoftwareId: id },
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
router.post('/projects/:projectId/software/:id/admins', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id } = req.params;
  const { memberId, role = 'ADMIN' } = req.body;

  if (!memberId) {
    throw new ValidationError('Member ID is required');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
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
  const existing = await prisma.projectSoftwareAdmin.findUnique({
    where: {
      projectSoftwareId_memberId: { projectSoftwareId: id, memberId }
    }
  });

  if (existing) {
    throw new ValidationError('Member is already an admin');
  }

  const admin = await prisma.projectSoftwareAdmin.create({
    data: {
      projectSoftwareId: id,
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
router.put('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id, adminId } = req.params;
  const { role } = req.body;

  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    throw new ValidationError('Valid role is required (OWNER or ADMIN)');
  }

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can update admins');
  }

  const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  const admin = await prisma.projectSoftwareAdmin.update({
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
router.delete('/projects/:projectId/software/:id/admins/:adminId', requireAdmin, asyncHandler(async (req, res) => {
  const { projectId, id, adminId } = req.params;

  // Verify project belongs to organization
  await findProjectOrFail(projectId, req.organization.id);

  const software = await prisma.projectSoftware.findFirst({
    where: { id, projectId }
  });

  if (!software) {
    throw new NotFoundError('Software not found in project');
  }

  // Check if user is software owner or org admin
  const isOwner = await isSoftwareOwner(id, req.membership.id);
  if (!isOwner && req.membership.role !== 'owner') {
    throw new ForbiddenError('Only software owner or org owner can remove admins');
  }

  const existingAdmin = await prisma.projectSoftwareAdmin.findUnique({
    where: { id: adminId }
  });

  if (!existingAdmin || existingAdmin.projectSoftwareId !== id) {
    throw new NotFoundError('Admin not found');
  }

  // Prevent removing the last owner
  if (existingAdmin.role === 'OWNER') {
    const ownerCount = await prisma.projectSoftwareAdmin.count({
      where: { projectSoftwareId: id, role: 'OWNER' }
    });
    if (ownerCount <= 1) {
      throw new ValidationError('Cannot remove the last owner. Transfer ownership first.');
    }
  }

  await prisma.projectSoftwareAdmin.delete({
    where: { id: adminId }
  });

  res.json({ message: 'Admin removed' });
}));

export default router;
