import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { USER_SELECT_BRIEF, USER_SELECT, MEMBER_WITH_ROLE_AND_USER } from '../utils/prismaFragments.js';
import { resolveFileUrl } from '../lib/storage.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(requireOrganization);

// Helper to check if user has access to an inbox (assigned or is a client in the org)
const hasInboxAccess = async (inboxId, memberId, memberRole) => {
  // Clients can access inboxes they're assigned to
  if (memberRole === 'client') {
    const assignment = await prisma.inboxAssignment.findUnique({
      where: {
        memberId_inboxId: { memberId, inboxId }
      }
    });
    return !!assignment;
  }
  // Staff can access all inboxes in the org
  return true;
};

// Get inbox's software catalog (for portal users)
router.get('/inboxes/:inboxId/software', asyncHandler(async (req, res) => {
  const { inboxId } = req.params;
  const { categoryId, filter } = req.query;

  // Verify inbox belongs to organization
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId: req.organization.id }
  });

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  // Check access
  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  // Build where clause for inbox software
  const where = { inboxId };

  // Filter by category if provided
  if (categoryId) {
    where.software = {
      categoryId: categoryId
    };
  }

  // Filter by "my-software" - only show software where user has approved access
  if (filter === 'my-software') {
    where.accessRequests = {
      some: {
        requesterId: req.membership.id,
        status: 'APPROVED'
      }
    };
  }

  const inboxSoftware = await prisma.inboxSoftware.findMany({
    where,
    orderBy: { software: { name: 'asc' } },
    include: {
      software: {
        include: {
          category: { select: { id: true, name: true } }
        }
      },
      // Include user's own access request status
      accessRequests: {
        where: { requesterId: req.membership.id },
        select: { id: true, status: true, createdAt: true }
      }
    }
  });

  // Transform to flatten structure and include user's request status
  const result = await Promise.all(inboxSoftware.map(async (ps) => ({
    id: ps.id,
    softwareId: ps.software.id,
    name: ps.software.name,
    description: ps.software.description,
    iconUrl: await resolveFileUrl(ps.software.iconUrl),
    vendor: ps.software.vendor,
    websiteUrl: ps.software.websiteUrl,
    category: ps.software.category,
    notes: ps.notes, // Inbox-specific notes
    myAccessRequest: ps.accessRequests[0] || null
  })));

  res.json(result);
}));

// Get categories (global categories used by inbox's software)
router.get('/inboxes/:inboxId/software/categories', asyncHandler(async (req, res) => {
  const { inboxId } = req.params;

  // Verify inbox belongs to organization
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId: req.organization.id }
  });

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  // Get categories that have software added to this inbox
  const categories = await prisma.softwareCategory.findMany({
    where: {
      software: {
        some: {
          inboxSoftware: {
            some: { inboxId }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.json(categories);
}));

// Get own access request history across all inboxes
router.get('/my-requests', asyncHandler(async (req, res) => {
  const { status, inboxId } = req.query;

  const where = {
    requesterId: req.membership.id,
    inboxSoftware: {
      inbox: {
        organizationId: req.organization.id
      }
    }
  };

  if (status) {
    where.status = status;
  }

  if (inboxId) {
    where.inboxSoftware.inboxId = inboxId;
  }

  const requests = await prisma.softwareAccessRequest.findMany({
    where,
    include: {
      inboxSoftware: {
        include: {
          inbox: {
            select: { id: true, name: true, inboxCode: true }
          },
          software: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
              vendor: true
            }
          }
        }
      },
      reviewer: {
        select: {
          id: true,
          user: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Transform to flatten structure
  const result = await Promise.all(requests.map(async (r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    reviewNotes: r.reviewNotes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    inboxSoftwareId: r.inboxSoftwareId,
    inbox: r.inboxSoftware.inbox,
    software: { ...r.inboxSoftware.software, iconUrl: await resolveFileUrl(r.inboxSoftware.software.iconUrl) },
    reviewer: r.reviewer
  })));

  res.json(result);
}));

// Get single inbox software detail
router.get('/inboxes/:inboxId/software/:id', asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;

  // Verify inbox belongs to organization
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId: req.organization.id }
  });

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  const inboxSoftware = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId },
    include: {
      software: {
        include: {
          category: { select: { id: true, name: true } }
        }
      },
      // Include user's own access request
      accessRequests: {
        where: { requesterId: req.membership.id },
        select: { id: true, status: true, reason: true, reviewNotes: true, createdAt: true, updatedAt: true }
      }
    }
  });

  if (!inboxSoftware) {
    throw new NotFoundError('Software not found');
  }

  // Transform to flatten structure
  const result = {
    id: inboxSoftware.id,
    softwareId: inboxSoftware.software.id,
    name: inboxSoftware.software.name,
    description: inboxSoftware.software.description,
    iconUrl: await resolveFileUrl(inboxSoftware.software.iconUrl),
    vendor: inboxSoftware.software.vendor,
    websiteUrl: inboxSoftware.software.websiteUrl,
    category: inboxSoftware.software.category,
    notes: inboxSoftware.notes,
    myAccessRequest: inboxSoftware.accessRequests[0] || null
  };

  res.json(result);
}));

// Submit access request
router.post('/inboxes/:inboxId/software/:id/request', asyncHandler(async (req, res) => {
  const { inboxId, id } = req.params;

  // Verify inbox belongs to organization and get default assignee
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId: req.organization.id },
    select: { id: true, defaultAssigneeId: true }
  });

  if (!inbox) {
    throw new NotFoundError('Inbox not found');
  }

  const hasAccess = await hasInboxAccess(inboxId, req.membership.id, req.membership.role);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this inbox');
  }

  const inboxSoftware = await prisma.inboxSoftware.findFirst({
    where: { id, inboxId }
  });

  if (!inboxSoftware) {
    throw new NotFoundError('Software not found');
  }

  // Check if already has a request
  const existingRequest = await prisma.softwareAccessRequest.findFirst({
    where: {
      inboxSoftwareId: id,
      requesterId: req.membership.id
    }
  });

  if (existingRequest) {
    if (existingRequest.status === 'PENDING') {
      throw new ValidationError('You already have a pending request for this software');
    }
    if (existingRequest.status === 'APPROVED') {
      throw new ValidationError('You already have access to this software');
    }
    // If declined, allow re-requesting by updating the existing request
    const updated = await prisma.softwareAccessRequest.update({
      where: { id: existingRequest.id },
      data: {
        status: 'PENDING',
        reason: req.body.reason || null,
        assigneeId: inbox.defaultAssigneeId,
        reviewerId: null,
        reviewNotes: null
      },
      include: {
        inboxSoftware: {
          include: {
            software: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Notify assignee about re-submitted request
    if (inbox.defaultAssigneeId) {
      try {
        await createNotification(prisma, {
          type: 'ACCESS_REQUEST_SUBMITTED',
          recipientId: inbox.defaultAssigneeId,
          organizationId: req.organization.id,
          data: {
            requesterName: req.user.name,
            softwareName: updated.inboxSoftware.software.name,
            inboxId,
            inboxSoftwareId: id,
          },
          entityType: 'access_request',
          entityId: updated.id,
        });
      } catch (notifError) {
        console.error('Error sending access request notification:', notifError);
      }
    }

    return res.json({
      id: updated.id,
      status: updated.status,
      reason: updated.reason,
      createdAt: updated.createdAt,
      software: updated.inboxSoftware.software
    });
  }

  const { reason } = req.body;

  const request = await prisma.softwareAccessRequest.create({
    data: {
      inboxSoftwareId: id,
      requesterId: req.membership.id,
      reason,
      assigneeId: inbox.defaultAssigneeId
    },
    include: {
      inboxSoftware: {
        include: {
          software: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  // Notify assignee about new request
  if (inbox.defaultAssigneeId) {
    try {
      await createNotification(prisma, {
        type: 'ACCESS_REQUEST_SUBMITTED',
        recipientId: inbox.defaultAssigneeId,
        organizationId: req.organization.id,
        data: {
          requesterName: req.user.name,
          softwareName: request.inboxSoftware.software.name,
          inboxId,
          inboxSoftwareId: id,
        },
        entityType: 'access_request',
        entityId: request.id,
      });
    } catch (notifError) {
      console.error('Error sending access request notification:', notifError);
    }
  }

  res.status(201).json({
    id: request.id,
    status: request.status,
    reason: request.reason,
    createdAt: request.createdAt,
    software: request.inboxSoftware.software
  });
}));

export default router;
