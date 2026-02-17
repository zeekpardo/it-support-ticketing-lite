import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { findInboxOrFail, getAssignedInboxIds, hasInboxAccess } from '../utils/entityHelpers.js';
import { MEMBER_WITH_ROLE_AND_USER_BRIEF } from '../utils/prismaFragments.js';
import { validateInboxCodeUnique, validateDefaultAssignee, validateEmailDomains, pickDefined } from '../utils/inboxValidation.js';
import { invalidateSenderCache } from '../services/emailDomainService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireOrganization);

const INBOX_INCLUDE = {
  defaultAssignee: { select: MEMBER_WITH_ROLE_AND_USER_BRIEF },
};

const DEFAULT_STAGES = [
  { name: 'New Requests', slug: 'new_request', color: 'purple', position: 0, isDefault: true, isResolved: false },
  { name: 'In Progress', slug: 'in_progress', color: 'blue', position: 1, isDefault: false, isResolved: false },
  { name: 'Waiting for Info', slug: 'waiting_for_info', color: 'amber', position: 2, isDefault: false, isResolved: false },
  { name: 'Review', slug: 'review', color: 'cyan', position: 3, isDefault: false, isResolved: false },
  { name: 'Resolved', slug: 'resolved', color: 'green', position: 4, isDefault: false, isResolved: true },
];

const INBOX_UPDATE_FIELDS = [
  'name', 'inboxCode', 'clientName', 'description', 'isActive',
  'defaultAssigneeId', 'dueDateLowDays', 'dueDateMediumDays', 'dueDateHighDays', 'dueDateUrgentDays',
  'autoReplyEnabled', 'autoReplyHtml', 'allowedEmailDomains',
  'emailDomainId', 'fromUser', 'fromName',
];

// Get all inboxes for organization (members only see assigned inboxes)
router.get('/', asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const role = req.membership.role;
  const isAdmin = role === 'owner' || role === 'manager';

  const where = { organizationId: req.organization.id };

  if (!includeInactive || !isAdmin) {
    where.isActive = true;
  }

  // Members only see their assigned inboxes
  if (!isAdmin) {
    const assignedIds = await getAssignedInboxIds(req.membership.id);
    where.id = { in: assignedIds };
  }

  const inboxes = await prisma.inbox.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { timeEntries: true } },
      ...INBOX_INCLUDE,
    },
  });

  res.json(inboxes);
}));

// Get single inbox (members only see assigned inboxes)
router.get('/:id', asyncHandler(async (req, res) => {
  if (!await hasInboxAccess(req.params.id, req.membership.id, req.membership.role)) {
    throw new NotFoundError('Inbox not found');
  }

  const inbox = await prisma.inbox.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
    },
    include: {
      _count: { select: { timeEntries: true, tickets: true } },
      ...INBOX_INCLUDE,
      inboxAssignments: {
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

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  const clients = inbox.inboxAssignments.map(pa => ({
    id: pa.member.id,
    userId: pa.member.user.id,
    name: pa.member.user.name,
    email: pa.member.user.email,
  }));

  res.json({
    ...inbox,
    clients,
    inboxAssignments: undefined,
  });
}));

// Create inbox
router.post('/', asyncHandler(async (req, res) => {
  const { name, inboxCode, clientName, description, defaultAssigneeId,
    dueDateLowDays, dueDateMediumDays, dueDateHighDays, dueDateUrgentDays,
    allowedEmailDomains } = req.body;

  if (!name || !inboxCode) {
    throw new ValidationError('Name and inbox code are required');
  }

  await validateInboxCodeUnique(req.organization.id, inboxCode);
  await validateDefaultAssignee(defaultAssigneeId, req.organization.id);
  const cleanedDomains = allowedEmailDomains ? validateEmailDomains(allowedEmailDomains) : [];

  const inbox = await prisma.$transaction(async (tx) => {
    const newInbox = await tx.inbox.create({
      data: {
        organizationId: req.organization.id,
        name,
        inboxCode,
        clientName,
        description,
        defaultAssigneeId,
        dueDateLowDays: dueDateLowDays ?? null,
        dueDateMediumDays: dueDateMediumDays ?? null,
        dueDateHighDays: dueDateHighDays ?? null,
        dueDateUrgentDays: dueDateUrgentDays ?? null,
        allowedEmailDomains: cleanedDomains,
      },
      include: INBOX_INCLUDE,
    });

    await tx.ticketStage.createMany({
      data: DEFAULT_STAGES.map(stage => ({ ...stage, inboxId: newInbox.id })),
    });

    return newInbox;
  });

  res.status(201).json(inbox);
}));

// Update inbox (admin/owner only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const inbox = await findInboxOrFail(req.params.id, req.organization.id);

  const { inboxCode, defaultAssigneeId, allowedEmailDomains, emailDomainId } = req.body;

  if (inboxCode && inboxCode !== inbox.inboxCode) {
    await validateInboxCodeUnique(req.organization.id, inboxCode, req.params.id);
  }
  await validateDefaultAssignee(defaultAssigneeId, req.organization.id);
  if (allowedEmailDomains !== undefined) {
    req.body.allowedEmailDomains = validateEmailDomains(allowedEmailDomains);
  }

  // Validate emailDomainId belongs to this org and is verified
  if (emailDomainId) {
    const domain = await prisma.emailDomain.findFirst({
      where: { id: emailDomainId, organizationId: req.organization.id },
    });
    if (!domain) {
      throw new ValidationError('Email domain not found');
    }
    if (domain.status !== 'VERIFIED') {
      throw new ValidationError('Email domain must be verified before use');
    }
  }

  const updated = await prisma.inbox.update({
    where: { id: req.params.id },
    data: pickDefined(req.body, INBOX_UPDATE_FIELDS),
    include: INBOX_INCLUDE,
  });

  // Invalidate sender cache if email identity fields changed
  if ('emailDomainId' in req.body || 'fromUser' in req.body || 'fromName' in req.body) {
    invalidateSenderCache(req.organization.id);
  }

  res.json(updated);
}));

// Delete inbox (soft delete - admin/owner only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const inbox = await findInboxOrFail(req.params.id, req.organization.id, {
    include: { _count: { select: { timeEntries: true } } },
  });

  if (inbox._count.timeEntries > 0) {
    await prisma.inbox.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Inbox archived (has time entries)' });
  } else {
    await prisma.inbox.delete({ where: { id: req.params.id } });
    res.json({ message: 'Inbox deleted' });
  }
}));

// Get inbox statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const inbox = await findInboxOrFail(req.params.id, req.organization.id);

  const where = {
    inboxId: req.params.id,
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
    inbox,
    stats: {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 100) / 100,
      entryCount: entries.length,
      uniqueUsers,
    },
  });
}));

// Generate client signup link for an inbox
router.post('/:id/signup-link', requireAdmin, asyncHandler(async (req, res) => {
  await findInboxOrFail(req.params.id, req.organization.id);

  const token = crypto.randomBytes(16).toString('hex');
  await prisma.inbox.update({
    where: { id: req.params.id },
    data: { clientSignupToken: token, clientSignupEnabled: true },
  });

  res.json({ token, enabled: true });
}));

// Toggle client signup link enabled/disabled
router.patch('/:id/signup-link', requireAdmin, asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new ValidationError('enabled must be a boolean');
  }

  const inbox = await findInboxOrFail(req.params.id, req.organization.id);

  const data = { clientSignupEnabled: enabled };
  if (enabled && !inbox.clientSignupToken) {
    data.clientSignupToken = crypto.randomBytes(16).toString('hex');
  }

  const updated = await prisma.inbox.update({
    where: { id: req.params.id },
    data,
  });

  res.json({ token: updated.clientSignupToken, enabled: updated.clientSignupEnabled });
}));

// Delete/revoke client signup link
router.delete('/:id/signup-link', requireAdmin, asyncHandler(async (req, res) => {
  await findInboxOrFail(req.params.id, req.organization.id);

  await prisma.inbox.update({
    where: { id: req.params.id },
    data: { clientSignupToken: null, clientSignupEnabled: false },
  });

  res.json({ success: true });
}));

export { DEFAULT_STAGES };

export default router;
