import express from 'express';
import { prisma } from '../../lib/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { deleteFile } from '../../lib/storage.js';

const router = express.Router();

// ==========================================
// List all organizations with counts
// ==========================================
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0, search } = req.query;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ]
      }
    : {};

  const [accounts, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        appName: true,
        primaryColor: true,
        favicon: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            projects: true,
            tickets: true,
            timeEntries: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.organization.count({ where }),
  ]);

  res.json({ accounts, total });
}));

// ==========================================
// Get members of an organization
// ==========================================
router.get('/:id/members', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw new NotFoundError('Account not found');

  const members = await prisma.member.findMany({
    where: { organizationId: id },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          banned: true,
        }
      },
      projectAssignments: {
        select: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(members);
}));

// ==========================================
// Update an organization
// ==========================================
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug, appName, primaryColor } = req.body;

  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Account not found');

  if (!name) throw new ValidationError('Name is required');

  // Check slug uniqueness if changing
  if (slug && slug !== existing.slug) {
    const duplicate = await prisma.organization.findUnique({ where: { slug } });
    if (duplicate) throw new ValidationError('An account with this slug already exists');
  }

  const data = { name };
  if (slug) data.slug = slug;
  if (appName !== undefined) data.appName = appName || null;
  if (primaryColor !== undefined) data.primaryColor = primaryColor || null;

  const account = await prisma.organization.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      appName: true,
      primaryColor: true,
      createdAt: true,
      _count: {
        select: { members: true, projects: true, tickets: true, timeEntries: true }
      }
    }
  });

  res.json(account);
}));

// ==========================================
// Update a member's role
// ==========================================
router.put('/:id/members/:memberId', asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;
  const { role } = req.body;

  const validRoles = ['owner', 'admin', 'member', 'client'];
  if (!role || !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be one of: owner, admin, member, client');
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: id },
  });
  if (!member) throw new NotFoundError('Member not found in this account');

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { role },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, image: true, banned: true }
      },
      projectAssignments: {
        select: {
          project: {
            select: { id: true, name: true, projectCode: true }
          }
        }
      }
    }
  });

  res.json(updated);
}));

// ==========================================
// Get inboxes for an organization
// ==========================================
router.get('/:id/inboxes', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw new NotFoundError('Account not found');

  const inboxes = await prisma.inbox.findMany({
    where: { organizationId: id },
    select: {
      id: true,
      name: true,
      inboxCode: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json(inboxes);
}));

// ==========================================
// Update inbox assignments for a member
// ==========================================
router.put('/:id/members/:memberId/inboxes', asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;
  const { inboxIds } = req.body;

  if (!Array.isArray(inboxIds)) {
    throw new ValidationError('inboxIds must be an array');
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: id },
  });
  if (!member) throw new NotFoundError('Member not found in this account');

  // Verify all inboxes belong to this organization
  const inboxes = await prisma.inbox.findMany({
    where: { id: { in: inboxIds }, organizationId: id },
  });
  if (inboxes.length !== inboxIds.length) {
    throw new ValidationError('One or more inboxes not found in this account');
  }

  await prisma.$transaction([
    prisma.inboxAssignment.deleteMany({ where: { memberId } }),
    ...inboxIds.map(inboxId =>
      prisma.inboxAssignment.create({ data: { memberId, inboxId } })
    ),
  ]);

  // Return updated member
  const updated = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, image: true, banned: true }
      },
      inboxAssignments: {
        select: {
          inbox: {
            select: { id: true, name: true, inboxCode: true }
          }
        }
      }
    }
  });

  res.json(updated);
}));

// ==========================================
// Remove a member from an organization
// ==========================================
router.delete('/:id/members/:memberId', asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: id },
  });
  if (!member) throw new NotFoundError('Member not found in this account');

  await prisma.member.delete({ where: { id: memberId } });

  res.json({ message: 'Member removed from account' });
}));

// ==========================================
// Delete an organization (cascading)
// ==========================================
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      logo: true,
      favicon: true,
    }
  });

  if (!existing) throw new NotFoundError('Account not found');

  // Step 1: Collect all S3 file references BEFORE deleting
  const s3Keys = [];

  if (existing.logo?.startsWith('s3:')) s3Keys.push(existing.logo.slice(3));
  if (existing.favicon?.startsWith('s3:')) s3Keys.push(existing.favicon.slice(3));

  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticket: { organizationId: id } },
    select: { fileUrl: true }
  });
  for (const att of attachments) {
    if (att.fileUrl?.startsWith('s3:')) s3Keys.push(att.fileUrl.slice(3));
  }

  // Step 2: Delete the Organization (Prisma cascade handles DB cleanup)
  await prisma.organization.delete({ where: { id } });

  // Step 3: Clean up S3 files (best-effort)
  for (const key of s3Keys) {
    try {
      await deleteFile(key);
    } catch (err) {
      console.error(`Failed to delete S3 file ${key}:`, err.message);
    }
  }

  res.json({ message: 'Account deleted successfully' });
}));

export default router;
