import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/auth.js';
import { authenticate, requireOrganization, requireOwner, requireAdmin, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Generate a random ID similar to Better Auth's format
const generateId = () => crypto.randomBytes(16).toString('hex');

// Create a new user and add them directly to the organization
// POST /api/members/create-user
router.post('/create-user', authenticate, requireOrganization, requireOwner, async (req, res) => {
  try {
    const { name, email, phone, password, role, projectIds } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate role
    const validRoles = ['manager', 'member', 'client'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be manager, member, or client' });
    }

    // Require project selection for clients
    if (role === 'client' && (!projectIds || projectIds.length === 0)) {
      return res.status(400).json({ error: 'At least one project must be selected for client users' });
    }

    // Check if user is a super admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only super admins can create users directly' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // User exists - check if they're already a member of this org
      const existingMember = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: req.organization.id,
            userId: existingUser.id
          }
        }
      });

      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }

      // Add existing user to organization
      const member = await prisma.member.create({
        data: {
          id: generateId(),
          organizationId: req.organization.id,
          userId: existingUser.id,
          role: role || 'member'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Create project assignments for clients
      if (role === 'client' && projectIds && projectIds.length > 0) {
        await prisma.projectAssignment.createMany({
          data: projectIds.map(projectId => ({
            memberId: member.id,
            projectId
          }))
        });
      }

      return res.json({
        success: true,
        message: 'Existing user added to organization',
        member
      });
    }

    // Create new user directly via Prisma (since Better Auth admin API requires specific setup)
    // Hash password using Better Auth's internal method
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword(password);

    const userId = generateId();
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        phone: phone || null,
        emailVerified: true, // Skip email verification for admin-created users
        role: 'user',
      }
    });

    // Create the account record for email/password auth
    await prisma.account.create({
      data: {
        id: generateId(),
        userId: newUser.id,
        accountId: newUser.id,
        providerId: 'credential',
        password: hashedPassword,
      }
    });

    // Create member record to add user to organization
    const member = await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: req.organization.id,
        userId: newUser.id,
        role: role || 'member'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create project assignments for clients
    if (role === 'client' && projectIds && projectIds.length > 0) {
      await prisma.projectAssignment.createMany({
        data: projectIds.map(projectId => ({
          memberId: member.id,
          projectId
        }))
      });
    }

    res.json({
      success: true,
      message: 'User created and added to organization',
      member
    });
  } catch (error) {
    console.error('Create user error:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      if (field === 'email') {
        return res.status(400).json({
          error: 'A user with this email already exists. Use "Send Invitation" to invite them to this organization instead.'
        });
      }
      return res.status(400).json({ error: `A record with this ${field} already exists` });
    }

    // Handle foreign key constraint (e.g., organization doesn't exist)
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid organization or user reference' });
    }

    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// ==========================================
// Project Assignment Endpoints
// ==========================================

// Get all clients with their project assignments
// GET /api/members/clients
router.get('/clients', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const clients = await prisma.member.findMany({
      where: {
        organizationId: req.organization.id,
        role: 'client'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        projectAssignments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get all staff members (non-clients) for ticket assignment
// GET /api/members/staff
router.get('/staff', authenticate, requireOrganization, requireStaff, async (req, res) => {
  try {
    const staff = await prisma.member.findMany({
      where: {
        organizationId: req.organization.id,
        role: { in: ['owner', 'manager', 'member'] }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        user: { name: 'asc' }
      }
    });

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Get project assignments for a specific member
// GET /api/members/:memberId/projects
router.get('/:memberId/projects', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member belongs to this organization
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: req.organization.id
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const assignments = await prisma.projectAssignment.findMany({
      where: { memberId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            isActive: true
          }
        }
      }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching member projects:', error);
    res.status(500).json({ error: 'Failed to fetch project assignments' });
  }
});

// Assign a project to a member (typically a client)
// POST /api/members/:memberId/projects
router.post('/:memberId/projects', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Verify member belongs to this organization
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: req.organization.id
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify project belongs to this organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: req.organization.id
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.projectAssignment.findUnique({
      where: {
        memberId_projectId: { memberId, projectId }
      }
    });

    if (existingAssignment) {
      return res.status(400).json({ error: 'Project is already assigned to this member' });
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        memberId,
        projectId
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            isActive: true
          }
        }
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning project:', error);
    res.status(500).json({ error: 'Failed to assign project' });
  }
});

// Remove a project assignment from a member
// DELETE /api/members/:memberId/projects/:projectId
router.delete('/:memberId/projects/:projectId', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const { memberId, projectId } = req.params;

    // Verify member belongs to this organization
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: req.organization.id
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Delete the assignment
    await prisma.projectAssignment.delete({
      where: {
        memberId_projectId: { memberId, projectId }
      }
    });

    res.json({ message: 'Project assignment removed' });
  } catch (error) {
    console.error('Error removing project assignment:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Project assignment not found' });
    }

    res.status(500).json({ error: 'Failed to remove project assignment' });
  }
});

// Bulk update project assignments for a member
// PUT /api/members/:memberId/projects
router.put('/:memberId/projects', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { projectIds } = req.body;

    if (!Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'projectIds must be an array' });
    }

    // Verify member belongs to this organization
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: req.organization.id
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify all projects belong to this organization
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        organizationId: req.organization.id
      }
    });

    if (projects.length !== projectIds.length) {
      return res.status(400).json({ error: 'One or more projects not found' });
    }

    // Delete all existing assignments and create new ones in a transaction
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

    // Fetch updated assignments
    const assignments = await prisma.projectAssignment.findMany({
      where: { memberId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            isActive: true
          }
        }
      }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Error updating project assignments:', error);
    res.status(500).json({ error: 'Failed to update project assignments' });
  }
});

// ==========================================
// Client Detail Endpoint
// ==========================================

// Get a single client with their tickets and software access
// GET /api/members/clients/:memberId
router.get('/clients/:memberId', authenticate, requireOrganization, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Get client with user info and project assignments
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
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get all tickets for this client
    const tickets = await prisma.supportTicket.findMany({
      where: {
        clientId: memberId,
        organizationId: req.organization.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true
          }
        },
        owner: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all software access requests for this client
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
              select: {
                id: true,
                name: true,
                projectCode: true
              }
            }
          }
        },
        reviewer: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
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
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ error: 'Failed to fetch client details' });
  }
});

// ==========================================
// User Profile Endpoints
// ==========================================

// Update current user's profile (phone number)
// PUT /api/members/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone: phone || null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get current user's profile
// GET /api/members/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
