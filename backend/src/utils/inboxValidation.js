import { prisma } from '../lib/auth.js';
import { ValidationError } from './errors.js';

const STAFF_ROLES = ['owner', 'manager', 'member'];

export async function validateInboxCodeUnique(organizationId, inboxCode, excludeId = null) {
  const where = { organizationId, inboxCode };
  if (excludeId) where.NOT = { id: excludeId };

  const existing = await prisma.inbox.findFirst({ where });
  if (existing) {
    throw new ValidationError('Inbox code already exists');
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
 * Validate and normalize an array of email domain strings.
 * Each domain must contain a dot, no '@', and no spaces.
 * Returns the cleaned, lowercased array.
 */
export function validateEmailDomains(domains) {
  if (!Array.isArray(domains)) {
    throw new ValidationError('allowedEmailDomains must be an array');
  }
  return domains.map((d, i) => {
    if (typeof d !== 'string') {
      throw new ValidationError(`Invalid domain at index ${i}`);
    }
    const domain = d.trim().toLowerCase();
    if (!domain) return null;
    if (domain.includes('@') || domain.includes(' ') || !domain.includes('.')) {
      throw new ValidationError(`Invalid domain format: "${d}". Expected format: example.com`);
    }
    return domain;
  }).filter(Boolean);
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
