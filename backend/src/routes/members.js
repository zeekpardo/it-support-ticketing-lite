import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner, requireAdmin, requireStaff } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { createProjectAssignments } from '../utils/entityHelpers.js';
import { USER_SELECT, MEMBER_WITH_USER } from '../utils/prismaFragments.js';
import { PROJECT_ASSIGNMENT_INCLUDE, PROJECT_SELECT_ACTIVE, PROJECT_SELECT_BRIEF } from '../utils/prismaFragments.js';

const router = express.Router();

const generateId = () => crypto.randomBytes(16).toString('hex');

// Create a new user and add them directly to the organization
// POST /api/members/create-user
router.post('/create-user', authenticate, requireOrganization, requireOwner, asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, projectIds } = req.body;

  if (!name || !email || !password) {
    throw new ValidationError('Name, email, and password are required');
  }

  const validRoles = ['manager', 'member', 'client'];
  if (role && !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be manager, member, or client');
  }

  if (role === 'client' && (!projectIds || projectIds.length === 0)) {
    throw new ValidationError('At least one project must be selected for client users');
  }

  if (req.user.role !== 'admin') {
    throw new ForbiddenError('Only super admins can create users directly');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const existingMember = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.organization.id,
          userId: existingUser.id
        }
      }
    });

    if (existingMember) {
      throw new ValidationError('User is already a member of this organization');
    }

    const member = await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: req.organization.id,
        userId: existingUser.id,
        role: role || 'member'
      },
      include: {
        user: { select: USER_SELECT }
      }
    });

    if (role === 'client') {
      await createProjectAssignments(member.id, projectIds);
    }

    return res.json({
      success: true,
      message: 'Existing user added to organization',
      member
    });
  }

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(password);
  const userId = generateId();

  try {
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        phone: phone || null,
        emailVerified: true,
        role: 'user',
      }
    });

    await prisma.account.create({
      data: {
        id: generateId(),
        userId: newUser.id,
        accountId: newUser.id,
        providerId: 'credential',
        password: hashedPassword,
      }
    });

    const member = await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: req.organization.id,
        userId: newUser.id,
        role: role || 'member'
      },
      include: {
        user: { select: USER_SELECT }
      }
    });

    if (role === 'client') {
      await createProjectAssignments(member.id, projectIds);
    }

    res.json({
      success: true,
      message: 'User created and added to organization',
      member
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      if (field === 'email') {
        throw new ConflictError('A user with this email already exists. Use "Send Invitation" to invite them to this organization instead.');
      }
      throw new ConflictError(`A record with this ${field} already exists`);
    }
    throw error;
  }
}));

// Get all clients with their project assignments
// GET /api/members/clients
router.get('/clients', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const clients = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: 'client'
    },
    include: {
      user: { select: USER_SELECT },
      projectAssignments: {
        include: PROJECT_ASSIGNMENT_INCLUDE
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(clients);
}));

// Get all staff members (non-clients) for ticket assignment
// GET /api/members/staff
router.get('/staff', authenticate, requireOrganization, requireStaff, asyncHandler(async (req, res) => {
  const staff = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] }
    },
    include: {
      user: { select: USER_SELECT }
    },
    orderBy: {
      user: { name: 'asc' }
    }
  });

  res.json(staff);
}));

// Get a single client with their tickets and software access
// GET /api/members/clients/:memberId
router.get('/clients/:memberId', authenticate, requireOrganization, requireAdmin, asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  const client = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId: req.organization.id,
      role: 'client'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      projectAssignments: {
        include: PROJECT_ASSIGNMENT_INCLUDE
      }
    }
  });

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  const tickets = await prisma.supportTicket.findMany({
    where: {
      clientId: memberId,
      organizationId: req.organization.id
    },
    include: {
      project: {
        select: PROJECT_SELECT_BRIEF
      },
      owner: {
        select: MEMBER_WITH_USER
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const softwareAccess = await prisma.softwareAccessRequest.findMany({
    where: {
      requesterId: memberId,
      projectSoftware: {
        project: {
          organizationId: req.organization.id
        }
      }
    },
    include: {
      projectSoftware: {
        include: {
          software: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
              vendor: true
            }
          },
          project: {
            select: PROJECT_SELECT_BRIEF
          }
        }
      },
      reviewer: {
        select: MEMBER_WITH_USER
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({
    ...client,
    tickets,
    softwareAccess
  });
}));

export default router;
