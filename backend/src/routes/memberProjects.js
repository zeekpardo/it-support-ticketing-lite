import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { findMemberOrFail, findProjectOrFail } from '../utils/entityHelpers.js';
import { PROJECT_ASSIGNMENT_INCLUDE } from '../utils/prismaFragments.js';

const router = express.Router();

// Get project assignments for a specific member
// GET /api/members/:memberId/projects
router.get('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  await findMemberOrFail(memberId, req.organization.id);

  const assignments = await prisma.projectAssignment.findMany({
    where: { memberId },
    include: PROJECT_ASSIGNMENT_INCLUDE
  });

  res.json(assignments);
}));

// Assign a project to a member (typically a client)
// POST /api/members/:memberId/projects
router.post('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    throw new ValidationError('Project ID is required');
  }

  await findMemberOrFail(memberId, req.organization.id);
  await findProjectOrFail(projectId, req.organization.id);

  const existingAssignment = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId }
    }
  });

  if (existingAssignment) {
    throw new ValidationError('Project is already assigned to this member');
  }

  const assignment = await prisma.projectAssignment.create({
    data: {
      memberId,
      projectId
    },
    include: PROJECT_ASSIGNMENT_INCLUDE
  });

  res.status(201).json(assignment);
}));

// Remove a project assignment from a member
// DELETE /api/members/:memberId/projects/:projectId
router.delete('/:memberId/projects/:projectId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId, projectId } = req.params;

  await findMemberOrFail(memberId, req.organization.id);

  try {
    await prisma.projectAssignment.delete({
      where: {
        memberId_projectId: { memberId, projectId }
      }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new NotFoundError('Project assignment not found');
    }
    throw error;
  }

  res.json({ message: 'Project assignment removed' });
}));

// Bulk update project assignments for a member
// PUT /api/members/:memberId/projects
router.put('/:memberId/projects', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { projectIds } = req.body;

  if (!Array.isArray(projectIds)) {
    throw new ValidationError('projectIds must be an array');
  }

  await findMemberOrFail(memberId, req.organization.id);

  const projects = await prisma.project.findMany({
    where: {
      id: { in: projectIds },
      organizationId: req.organization.id
    }
  });

  if (projects.length !== projectIds.length) {
    throw new ValidationError('One or more projects not found');
  }

  await prisma.$transaction([
    prisma.projectAssignment.deleteMany({
      where: { memberId }
    }),
    ...projectIds.map(projectId =>
      prisma.projectAssignment.create({
        data: { memberId, projectId }
      })
    )
  ]);

  const assignments = await prisma.projectAssignment.findMany({
    where: { memberId },
    include: PROJECT_ASSIGNMENT_INCLUDE
  });

  res.json(assignments);
}));

export default router;
