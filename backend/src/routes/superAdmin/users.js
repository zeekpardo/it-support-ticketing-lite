import express from 'express';
import { prisma } from '../../lib/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

const router = express.Router();

// Get all users with their organization memberships and project assignments
router.get('/', asyncHandler(async (req, res) => {
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
        members: {
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
}));

export default router;
