import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const router = express.Router();

// All routes require authentication, organization context, and admin role
router.use(authenticate);
router.use(requireOrganization);
router.use(requireAdmin);

/**
 * Get all email rules for organization
 * GET /api/email-rules
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { organizationId: req.organization.id };
    if (req.query.projectId) {
      where.projectId = req.query.projectId;
    }

    const rules = await prisma.emailRule.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
          },
        },
        _count: {
          select: { inboundEmails: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(rules);
  })
);

/**
 * Create email rule
 * POST /api/email-rules
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, matchType, matchValue, priority } = req.body;

    // Validate required fields
    if (!projectId || !matchType) {
      throw new ValidationError('Project and match type are required');
    }

    // Validate match type
    const validMatchTypes = ['EXACT_ADDRESS', 'DOMAIN', 'CATCH_ALL'];
    if (!validMatchTypes.includes(matchType)) {
      throw new ValidationError('Invalid match type. Must be one of: ' + validMatchTypes.join(', '));
    }

    // Validate match value is provided for non-CATCH_ALL types
    if (matchType !== 'CATCH_ALL' && !matchValue) {
      throw new ValidationError('Match value is required for this match type');
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.organization.id },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Check for duplicate catch-all rule
    if (matchType === 'CATCH_ALL') {
      const existingCatchAll = await prisma.emailRule.findFirst({
        where: {
          organizationId: req.organization.id,
          matchType: 'CATCH_ALL',
          isActive: true,
        },
      });

      if (existingCatchAll) {
        throw new ValidationError('A catch-all rule already exists. Deactivate it first or update the existing rule.');
      }
    }

    // Create rule
    const rule = await prisma.emailRule.create({
      data: {
        organizationId: req.organization.id,
        projectId,
        matchType,
        matchValue: matchValue || null,
        priority: priority !== undefined ? priority : 0,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
          },
        },
      },
    });

    res.status(201).json(rule);
  })
);

/**
 * Update email rule
 * PUT /api/email-rules/:id
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { matchType, matchValue, priority, isActive } = req.body;

    // Find rule and verify ownership
    const rule = await prisma.emailRule.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
      },
    });

    if (!rule) {
      throw new NotFoundError('Email rule not found');
    }

    // If changing to CATCH_ALL, verify no other active CATCH_ALL exists
    if (matchType === 'CATCH_ALL' && matchType !== rule.matchType) {
      const existingCatchAll = await prisma.emailRule.findFirst({
        where: {
          organizationId: req.organization.id,
          matchType: 'CATCH_ALL',
          isActive: true,
          id: { not: req.params.id },
        },
      });

      if (existingCatchAll) {
        throw new ValidationError('A catch-all rule already exists. Deactivate it first.');
      }
    }

    // Update rule
    const updated = await prisma.emailRule.update({
      where: { id: req.params.id },
      data: {
        matchType: matchType ?? rule.matchType,
        matchValue: matchValue !== undefined ? matchValue : rule.matchValue,
        priority: priority !== undefined ? priority : rule.priority,
        isActive: isActive !== undefined ? isActive : rule.isActive,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
          },
        },
      },
    });

    res.json(updated);
  })
);

/**
 * Delete email rule
 * DELETE /api/email-rules/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Find rule and verify ownership
    const rule = await prisma.emailRule.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organization.id,
      },
    });

    if (!rule) {
      throw new NotFoundError('Email rule not found');
    }

    // Delete rule
    await prisma.emailRule.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Email rule deleted successfully' });
  })
);

/**
 * Get inbound email logs for organization
 * GET /api/email-rules/inbound-logs
 */
router.get(
  '/inbound-logs',
  asyncHandler(async (req, res) => {
    const { status, limit = '50' } = req.query;

    const where = {
      emailRule: {
        organizationId: req.organization.id,
      },
    };

    if (status) {
      where.status = status;
    }

    const emails = await prisma.inboundEmail.findMany({
      where,
      include: {
        emailRule: {
          select: {
            id: true,
            matchType: true,
            matchValue: true,
            project: {
              select: { id: true, name: true },
            },
          },
        },
        ticket: {
          select: { id: true, subject: true },
        },
        comment: {
          select: { id: true, ticketId: true },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: parseInt(limit, 10),
    });

    res.json(emails);
  })
);

export default router;
