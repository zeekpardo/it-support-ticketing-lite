import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, admin } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  basePath: '/api/auth',
  database: prismaAdapter(prisma, {
    provider: 'sqlite'
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24 // Update session every day
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin']
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: 'owner',
      membershipLimit: 100,
      roles: {
        owner: {
          permissions: ['organization:delete', 'organization:update', 'member:create', 'member:delete', 'member:update', 'invitation:create', 'invitation:cancel', 'project:create', 'project:update', 'project:delete', 'time-entry:view-all', 'time-entry:edit-all', 'time-entry:delete-all', 'reports:view-all']
        },
        manager: {
          permissions: ['member:create', 'member:delete', 'member:update', 'invitation:create', 'invitation:cancel', 'project:create', 'project:update', 'project:delete', 'time-entry:view-all', 'time-entry:edit-all', 'time-entry:delete-all', 'reports:view-all']
        },
        member: {
          permissions: ['project:view', 'time-entry:create', 'time-entry:view-own', 'time-entry:edit-own', 'time-entry:delete-own', 'reports:view-own']
        }
      }
    })
  ],
  trustedOrigins: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000',
    'chrome-extension://cjcjnghodjkdjpilglboecgfellnnnfi' // Chrome extension
  ]
});

export { prisma };
