import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { findProjectOrFail } from '../utils/entityHelpers.js';
import { MEMBER_WITH_ROLE_AND_USER_BRIEF } from '../utils/prismaFragments.js';
import { validateProjectCodeUnique, validateDefaultAssignee, pickDefined } from '../utils/projectValidation.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

const PROJECT_INCLUDE = {
  defaultAssignee: { select: MEMBER_WITH_ROLE_AND_USER_BRIEF },
};

const DEFAULT_STAGES = [
  { name: 'New Requests', slug: 'new_request', color: 'purple', position: 0, isDefault: true, isResolved: false },
  { name: 'In Progress', slug: 'in_progress', color: 'blue', position: 1, isDefault: false, isResolved: false },
  { name: 'Waiting for Info', slug: 'waiting_for_info', color: 'amber', position: 2, isDefault: false, isResolved: false },
  { name: 'Review', slug: 'review', color: 'cyan', position: 3, isDefault: false, isResolved: false },
  { name: 'Resolved', slug: 'resolved', color: 'green', position: 4, isDefault: false, isResolved: true },
];

const PROJECT_UPDATE_FIELDS = [
  'name', 'projectCode', 'clientName', 'description', 'isActive',
  'defaultAssigneeId', 'dueDateLowDays', 'dueDateMediumDays', 'dueDateHighDays', 'dueDateUrgentDays',
];

// Get all projects for organization
router.get('/', asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const canSeeInactive = ['admin', 'owner'].includes(req.membership.role);

  const where = { organizationId: req.organization.id };

  if (!includeInactive || !canSeeInactive) {
    where.isActive = true;
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { timeEntries: true } },
      ...PROJECT_INCLUDE,
    },
  });

  res.json(projects);
}));

// Get single project
router.get('/:id', asyncHandler(async (req, res) => {
  const project = await prisma.project.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
    },
    include: {
      _count: { select: { timeEntries: true, tickets: true } },
      ...PROJECT_INCLUDE,
      projectAssignments: {
        where: { member: { role: 'client' } },
        include: {
          member: {
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const clients = project.projectAssignments.map(pa => ({
    id: pa.member.id,
    userId: pa.member.user.id,
    name: pa.member.user.name,
    email: pa.member.user.email,
  }));

  res.json({
    ...project,
    clients,
    projectAssignments: undefined,
  });
}));

// Create project
router.post('/', asyncHandler(async (req, res) => {
  const { name, projectCode, clientName, description, defaultAssigneeId,
    dueDateLowDays, dueDateMediumDays, dueDateHighDays, dueDateUrgentDays } = req.body;

  if (!name || !projectCode) {
    throw new ValidationError('Name and project code are required');
  }

  await validateProjectCodeUnique(req.organization.id, projectCode);
  await validateDefaultAssignee(defaultAssigneeId, req.organization.id);

  const project = await prisma.$transaction(async (tx) => {
    const newProject = await tx.project.create({
      data: {
        organizationId: req.organization.id,
        name,
        projectCode,
        clientName,
        description,
        defaultAssigneeId,
        dueDateLowDays: dueDateLowDays ?? null,
        dueDateMediumDays: dueDateMediumDays ?? null,
        dueDateHighDays: dueDateHighDays ?? null,
        dueDateUrgentDays: dueDateUrgentDays ?? null,
      },
      include: PROJECT_INCLUDE,
    });

    await tx.ticketStage.createMany({
      data: DEFAULT_STAGES.map(stage => ({ ...stage, projectId: newProject.id })),
    });

    return newProject;
  });

  res.status(201).json(project);
}));

// Update project (admin/owner only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req.params.id, req.organization.id);

  const { projectCode, defaultAssigneeId } = req.body;

  if (projectCode && projectCode !== project.projectCode) {
    await validateProjectCodeUnique(req.organization.id, projectCode, req.params.id);
  }
  await validateDefaultAssignee(defaultAssigneeId, req.organization.id);

  const updated = await prisma.project.update({
    where: { id: req.params.id },
    data: pickDefined(req.body, PROJECT_UPDATE_FIELDS),
    include: PROJECT_INCLUDE,
  });

  res.json(updated);
}));

// Delete project (soft delete - admin/owner only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req.params.id, req.organization.id, {
    include: { _count: { select: { timeEntries: true } } },
  });

  if (project._count.timeEntries > 0) {
    await prisma.project.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Project archived (has time entries)' });
  } else {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  }
}));

// Get project statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const project = await findProjectOrFail(req.params.id, req.organization.id);

  const where = {
    projectId: req.params.id,
    organizationId: req.organization.id,
    isRunning: false,
  };

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    select: { durationMins: true, userId: true },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMins || 0), 0);
  const uniqueUsers = new Set(entries.map(e => e.userId)).size;

  res.json({
    project,
    stats: {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      entryCount: entries.length,
      uniqueUsers,
    },
  });
}));

export { DEFAULT_STAGES };

export default router;
