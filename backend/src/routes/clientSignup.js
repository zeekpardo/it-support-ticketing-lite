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

// Find project by signup token (must be enabled and active)
async function findProjectByToken(token) {
  const project = await prisma.project.findUnique({
    where: { clientSignupToken: token },
    include: {
      organization: {
        select: { id: true, name: true, appName: true, primaryColor: true, logo: true },
      },
    },
  });

  if (!project || !project.clientSignupEnabled || !project.isActive) {
    throw new NotFoundError('This signup link is no longer valid');
  }

  return project;
}

// GET /:token — Validate token and return org/project info
router.get('/:token', asyncHandler(async (req, res) => {
  const project = await findProjectByToken(req.params.token);
  const org = project.organization;

  res.json({
    organizationName: org.name,
    projectName: project.name,
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

  const project = await findProjectByToken(req.params.token);
  const orgId = project.organizationId;

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

      // Already a client — just add project assignment if missing
      const existing = await prisma.projectAssignment.findUnique({
        where: { memberId_projectId: { memberId: existingMember.id, projectId: project.id } },
      });

      if (existing) {
        return res.json({ success: true, message: 'You already have access to this project' });
      }

      await prisma.projectAssignment.create({
        data: { id: generateId(), memberId: existingMember.id, projectId: project.id },
      });

      return res.json({ success: true, message: 'Project access granted' });
    }

    // Existing user, not in org — add as client member
    const member = await prisma.member.create({
      data: { id: generateId(), organizationId: orgId, userId: existingUser.id, role: 'client' },
    });

    await prisma.projectAssignment.create({
      data: { id: generateId(), memberId: member.id, projectId: project.id },
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

    await tx.projectAssignment.create({
      data: { id: generateId(), memberId: member.id, projectId: project.id },
    });
  });

  res.status(201).json({ success: true });
}));

export default router;
