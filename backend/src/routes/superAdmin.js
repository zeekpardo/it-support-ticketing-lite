import express from 'express';
import { prisma } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to require super admin (Better Auth admin role)
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Get all users with their organization memberships and project assignments
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0, search } = req.query;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          banReason: true,
          banExpires: true,
          createdAt: true,
          memberships: {
            select: {
              id: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              projectAssignments: {
                select: {
                  project: {
                    select: {
                      id: true,
                      name: true,
                      projectCode: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
