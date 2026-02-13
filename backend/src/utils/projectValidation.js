import { prisma } from '../lib/auth.js';
import { ValidationError } from './errors.js';

const STAFF_ROLES = ['owner', 'manager', 'member'];

export async function validateProjectCodeUnique(organizationId, projectCode, excludeId = null) {
  const where = { organizationId, projectCode };
  if (excludeId) where.NOT = { id: excludeId };

  const existing = await prisma.project.findFirst({ where });
  if (existing) {
    throw new ValidationError('Project code already exists');
  }
}

export async function validateDefaultAssignee(assigneeId, organizationId) {
  if (!assigneeId) return;

  const assignee = await prisma.member.findFirst({
    where: {
      id: assigneeId,
      organizationId,
      role: { in: STAFF_ROLES },
    },
  });
  if (!assignee) {
    throw new ValidationError('Invalid default assignee');
  }
}

/**
 * Build a partial-update data object from req.body,
 * only including fields that were explicitly sent (not undefined).
 */
export function pickDefined(body, fields) {
  const data = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  return data;
}
