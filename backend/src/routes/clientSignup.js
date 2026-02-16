import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { resolveFileUrl } from '../lib/storage.js';

const router = express.Router();

const generateId = () => crypto.randomBytes(16).toString('hex');

const DEFAULT_APP_NAME = process.env.APP_NAME || 'Groovi Support';
const DEFAULT_PRIMARY_COLOR = '#2563eb';

// Find inbox by signup token (must be enabled and active)
async function findInboxByToken(token) {
  const inbox = await prisma.inbox.findUnique({
    where: { clientSignupToken: token },
    include: {
      organization: {
        select: { id: true, name: true, appName: true, primaryColor: true, logo: true },
      },
    },
  });

  if (!inbox || !inbox.clientSignupEnabled || !inbox.isActive) {
    throw new NotFoundError('This signup link is no longer valid');
  }

  return inbox;
}

// GET /:token — Validate token and return org/inbox info
router.get('/:token', asyncHandler(async (req, res) => {
  const inbox = await findInboxByToken(req.params.token);
  const org = inbox.organization;

  res.json({
    organizationName: org.name,
    inboxName: inbox.name,
    branding: {
      appName: org.appName || DEFAULT_APP_NAME,
      primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR,
      logoUrl: await resolveFileUrl(org.logo),
    },
  });
}));

// POST /:token — Complete client signup
router.post('/:token', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!email) {
    throw new ValidationError('Email is required');
  }

  const inbox = await findInboxByToken(req.params.token);
  const orgId = inbox.organizationId;

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Check if already a member of this org
    const existingMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
    });

    if (existingMember) {
      if (existingMember.role !== 'client') {
        throw new ValidationError('You are already a member of this organization with a staff role');
      }

      // Already a client — just add inbox assignment if missing
      const existing = await prisma.inboxAssignment.findUnique({
        where: { memberId_inboxId: { memberId: existingMember.id, inboxId: inbox.id } },
      });

      if (existing) {
        return res.json({ success: true, message: 'You already have access to this inbox' });
      }

      await prisma.inboxAssignment.create({
        data: { id: generateId(), memberId: existingMember.id, inboxId: inbox.id },
      });

      return res.json({ success: true, message: 'Inbox access granted' });
    }

    // Existing user, not in org — add as client member
    const member = await prisma.member.create({
      data: { id: generateId(), organizationId: orgId, userId: existingUser.id, role: 'client' },
    });

    await prisma.inboxAssignment.create({
      data: { id: generateId(), memberId: member.id, inboxId: inbox.id },
    });

    return res.json({ success: true });
  }

  // New user — validate required fields and create everything in a transaction
  if (!name || !password) {
    throw new ValidationError('Name and password are required');
  }
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(password);
  const userId = generateId();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, name, email, emailVerified: true, role: 'user' },
    });

    await tx.account.create({
      data: {
        id: generateId(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: hashedPassword,
      },
    });

    const member = await tx.member.create({
      data: { id: generateId(), organizationId: orgId, userId, role: 'client' },
    });

    await tx.inboxAssignment.create({
      data: { id: generateId(), memberId: member.id, inboxId: inbox.id },
    });
  });

  res.status(201).json({ success: true });
}));

export default router;
