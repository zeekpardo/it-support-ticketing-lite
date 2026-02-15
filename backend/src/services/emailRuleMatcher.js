import { prisma } from '../lib/auth.js';

/**
 * Find email rule matching the recipient address and/or sender domain
 * Priority order: EXACT_ADDRESS > DOMAIN > CATCH_ALL
 */
export async function findMatchingEmailRule(toAddress, fromAddress) {
  const fromDomain = '@' + fromAddress.split('@')[1];

  // Get all active rules, ordered by priority (highest first)
  const rules = await prisma.emailRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
    include: {
      project: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          defaultAssigneeId: true,
          dueDateLowDays: true,
          dueDateMediumDays: true,
          dueDateHighDays: true,
          dueDateUrgentDays: true,
          autoReplyEnabled: true,
          autoReplyHtml: true,
        },
      },
    },
  });

  // Try to match rules in priority order
  for (const rule of rules) {
    if (rule.matchType === 'EXACT_ADDRESS') {
      if (rule.matchValue && rule.matchValue.toLowerCase() === toAddress.toLowerCase()) {
        console.log('[InboundEmail] Matched EXACT_ADDRESS rule:', rule.matchValue);
        return rule;
      }
    } else if (rule.matchType === 'DOMAIN') {
      if (rule.matchValue && rule.matchValue.toLowerCase() === fromDomain.toLowerCase()) {
        console.log('[InboundEmail] Matched DOMAIN rule:', rule.matchValue);
        return rule;
      }
    }
  }

  // Fall back to catch-all rule
  const catchAllRule = rules.find((r) => r.matchType === 'CATCH_ALL');
  if (catchAllRule) {
    console.log('[InboundEmail] Matched CATCH_ALL rule');
  }
  return catchAllRule || null;
}
