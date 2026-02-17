import { Resend } from 'resend';
import prisma from '../lib/prisma.js';
import { FROM_EMAIL, APP_NAME } from '../lib/email/client.js';

// Lazy-load Resend client (shared with email sending)
let resend = null;
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Simple in-memory cache for sender resolution
const senderCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(orgId, projectId) {
  return `${orgId}:${projectId || 'default'}`;
}

/**
 * Invalidate sender cache for an org (call on domain/org/inbox changes)
 */
export function invalidateSenderCache(orgId) {
  for (const key of senderCache.keys()) {
    if (key.startsWith(`${orgId}:`)) {
      senderCache.delete(key);
    }
  }
}

/**
 * Add a domain to the org via Resend Domains API
 */
export async function addDomain(orgId, domain) {
  const client = getResendClient();
  if (!client) throw new Error('Resend API key not configured');

  // Check for existing domain in this org
  const existing = await prisma.emailDomain.findUnique({
    where: { organizationId_domain: { organizationId: orgId, domain } },
  });
  if (existing) throw new Error(`Domain ${domain} is already added to this organization`);

  // Create domain in Resend
  const { data, error } = await client.domains.create({ name: domain });
  if (error) {
    console.error('[EmailDomain] Resend create error:', error);
    throw new Error(error.message || 'Failed to create domain in Resend');
  }

  // Store domain with DNS records
  const emailDomain = await prisma.emailDomain.create({
    data: {
      organizationId: orgId,
      domain,
      resendDomainId: data.id,
      status: 'PENDING',
      dnsRecords: data.records || null,
    },
  });

  return emailDomain;
}

/**
 * Trigger domain verification in Resend
 */
export async function verifyDomain(id, orgId) {
  const client = getResendClient();
  if (!client) throw new Error('Resend API key not configured');

  const emailDomain = await prisma.emailDomain.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!emailDomain) throw new Error('Domain not found');

  const { error } = await client.domains.verify(emailDomain.resendDomainId);
  if (error) {
    console.error('[EmailDomain] Resend verify error:', error);
    throw new Error(error.message || 'Failed to trigger domain verification');
  }

  // Poll status after triggering verification
  return refreshDomainStatus(id, orgId);
}

/**
 * Poll Resend for the latest domain status
 */
export async function refreshDomainStatus(id, orgId) {
  const client = getResendClient();
  if (!client) throw new Error('Resend API key not configured');

  const emailDomain = await prisma.emailDomain.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!emailDomain) throw new Error('Domain not found');

  const { data, error } = await client.domains.get(emailDomain.resendDomainId);
  if (error) {
    console.error('[EmailDomain] Resend get error:', error);
    throw new Error(error.message || 'Failed to fetch domain status');
  }

  // Map Resend status to our enum
  let status = 'PENDING';
  if (data.status === 'verified') status = 'VERIFIED';
  else if (data.status === 'failed') status = 'FAILED';

  const updateData = {
    status,
    dnsRecords: data.records || emailDomain.dnsRecords,
  };
  if (status === 'VERIFIED' && !emailDomain.verifiedAt) {
    updateData.verifiedAt = new Date();
  }

  const updated = await prisma.emailDomain.update({
    where: { id },
    data: updateData,
  });

  invalidateSenderCache(orgId);
  return updated;
}

/**
 * Remove a domain from Resend and the database
 */
export async function removeDomain(id, orgId) {
  const client = getResendClient();
  if (!client) throw new Error('Resend API key not configured');

  const emailDomain = await prisma.emailDomain.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!emailDomain) throw new Error('Domain not found');

  // Remove from Resend
  const { error } = await client.domains.remove(emailDomain.resendDomainId);
  if (error) {
    console.error('[EmailDomain] Resend remove error:', error);
    // Continue with local cleanup even if Resend fails
  }

  // Clear FK references: org default + any inbox overrides
  await prisma.$transaction([
    prisma.organization.updateMany({
      where: { defaultEmailDomainId: id },
      data: { defaultEmailDomainId: null },
    }),
    prisma.inbox.updateMany({
      where: { emailDomainId: id },
      data: { emailDomainId: null },
    }),
    prisma.emailDomain.delete({ where: { id } }),
  ]);

  invalidateSenderCache(orgId);
}

/**
 * Set a domain as the org's default sending domain
 */
export async function setOrgDefault(orgId, emailDomainId) {
  // Verify the domain belongs to this org
  const emailDomain = await prisma.emailDomain.findFirst({
    where: { id: emailDomainId, organizationId: orgId },
  });
  if (!emailDomain) throw new Error('Domain not found');

  await prisma.organization.update({
    where: { id: orgId },
    data: { defaultEmailDomainId: emailDomainId },
  });

  invalidateSenderCache(orgId);
}

/**
 * Clear the org's default sending domain
 */
export async function clearOrgDefault(orgId) {
  await prisma.organization.update({
    where: { id: orgId },
    data: { defaultEmailDomainId: null },
  });

  invalidateSenderCache(orgId);
}

/**
 * The key lookup — resolve the correct sender identity for an org/inbox.
 *
 * Returns: { from: "Display Name <user@domain.com>", domain: "domain.com" }
 *
 * Resolution order:
 * 1. Inbox (Project) emailDomain + fromUser + fromName
 * 2. Organization defaultEmailDomain + defaultFromUser + defaultFromName
 * 3. Global FROM_EMAIL env var
 */
export async function getFromAddress(orgId, projectId) {
  const cacheKey = getCacheKey(orgId, projectId);
  const cached = senderCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  let result = null;

  // 1. Try inbox-level override
  if (projectId) {
    const inbox = await prisma.inbox.findUnique({
      where: { id: projectId },
      select: {
        fromUser: true,
        fromName: true,
        emailDomain: {
          select: { domain: true, status: true },
        },
      },
    });

    if (inbox?.emailDomain?.status === 'VERIFIED') {
      const user = inbox.fromUser || 'support';
      const name = inbox.fromName;
      result = buildFromAddress(user, inbox.emailDomain.domain, name);
    }
  }

  // 2. Fall back to org default
  if (!result && orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        defaultFromUser: true,
        defaultFromName: true,
        appName: true,
        defaultEmailDomain: {
          select: { domain: true, status: true },
        },
      },
    });

    if (org?.defaultEmailDomain?.status === 'VERIFIED') {
      const user = org.defaultFromUser || 'support';
      const name = org.defaultFromName || org.appName;
      result = buildFromAddress(user, org.defaultEmailDomain.domain, name);
    }
  }

  // 3. Fall back to global
  if (!result) {
    result = { from: FROM_EMAIL, domain: null };
  }

  senderCache.set(cacheKey, { value: result, timestamp: Date.now() });
  return result;
}

/**
 * Build a formatted "from" address string
 */
function buildFromAddress(user, domain, displayName) {
  const email = `${user}@${domain}`;
  const from = displayName ? `${displayName} <${email}>` : email;
  return { from, domain };
}

/**
 * List all email domains for an org
 */
export async function listDomains(orgId) {
  return prisma.emailDomain.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single email domain
 */
export async function getDomain(id, orgId) {
  return prisma.emailDomain.findFirst({
    where: { id, organizationId: orgId },
  });
}
