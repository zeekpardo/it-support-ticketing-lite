import { prisma } from '../lib/auth.js';
import crypto from 'crypto';

const generateId = () => crypto.randomBytes(16).toString('hex');

/**
 * Store all email participants (FROM, TO, CC) for a ticket.
 * Creates client accounts for external participants and tracks them for threaded replies.
 */
export async function storeEmailParticipants(ticketId, { from, toAddresses, ccAddresses, emailDomain, organizationId, projectId, primaryClientId }) {
  const participants = [];

  // Add the sender as 'from' participant
  const fromAddress = parseEmailAddress(from);
  const fromNameParsed = parseEmailName(from);
  if (fromAddress) {
    participants.push({ email: fromAddress, name: fromNameParsed, type: 'from', memberId: primaryClientId });
  }

  // Add TO recipients (excluding our own domain)
  for (const addr of toAddresses) {
    const email = parseEmailAddress(addr);
    const name = parseEmailName(addr);
    if (email && !email.toLowerCase().endsWith(`@${emailDomain}`)) {
      participants.push({ email, name, type: 'to' });
    }
  }

  // Add CC recipients (excluding our own domain)
  for (const addr of ccAddresses) {
    const email = parseEmailAddress(addr);
    const name = parseEmailName(addr);
    if (email && !email.toLowerCase().endsWith(`@${emailDomain}`)) {
      participants.push({ email, name, type: 'cc' });
    }
  }

  // Deduplicate by email (sender takes priority)
  const seen = new Set();
  const uniqueParticipants = [];
  for (const p of participants) {
    const key = p.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParticipants.push(p);
    }
  }

  // Create participant records and client accounts for non-sender participants
  for (const p of uniqueParticipants) {
    let memberId = p.memberId || null;

    // For TO/CC participants without a memberId, find or create a client account
    if (!memberId && p.type !== 'from') {
      try {
        const { firstName, lastName } = parseFullName(p.name || p.email);
        const member = await findOrCreateClient(p.email, firstName, lastName, organizationId, projectId);
        memberId = member.id;
      } catch (err) {
        console.warn('[InboundEmail] Could not create client for participant:', p.email, err.message);
      }
    }

    try {
      await prisma.ticketEmailParticipant.upsert({
        where: { ticketId_email: { ticketId, email: p.email.toLowerCase() } },
        create: {
          ticketId,
          email: p.email.toLowerCase(),
          name: p.name || null,
          memberId,
          type: p.type,
        },
        update: {},  // Don't overwrite if already exists
      });
    } catch (err) {
      console.warn('[InboundEmail] Could not store participant:', p.email, err.message);
    }
  }

  if (uniqueParticipants.length > 1) {
    console.log(`[InboundEmail] Stored ${uniqueParticipants.length} email participants for ticket`);
  }
}

/**
 * Find existing client or create new one with project assignment
 */
export async function findOrCreateClient(email, firstName, lastName, organizationId, projectId) {
  // Try to find existing user by email
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      members: {
        where: { organizationId },
        take: 1,
      },
    },
  });

  if (existingUser?.members?.[0]) {
    const member = existingUser.members[0];

    // Ensure client is assigned to this project
    await ensureProjectAssignment(member.id, projectId);

    console.log('[InboundEmail] Using existing client:', email);
    return member;
  }

  // Create new user and client member
  const userId = generateId();
  const newUser = await prisma.user.create({
    data: {
      id: userId,
      name: `${firstName} ${lastName}`.trim() || email,
      email,
      emailVerified: false,
      role: 'user',
    },
  });

  const member = await prisma.member.create({
    data: {
      id: generateId(),
      organizationId,
      userId: newUser.id,
      role: 'client',
    },
  });

  // Assign to project
  await prisma.projectAssignment.create({
    data: {
      memberId: member.id,
      projectId,
    },
  });

  console.log('[InboundEmail] Created new client:', email);
  return member;
}

/**
 * Ensure a member is assigned to a project
 */
export async function ensureProjectAssignment(memberId, projectId) {
  const existing = await prisma.projectAssignment.findUnique({
    where: {
      memberId_projectId: { memberId, projectId },
    },
  });

  if (!existing) {
    await prisma.projectAssignment.create({
      data: { memberId, projectId },
    });
    console.log('[InboundEmail] Assigned client to project');
  }
}

/**
 * Parse email address from "Name <email@domain.com>" format
 * Returns just the email address
 */
export function parseEmailAddress(emailString) {
  if (!emailString) return '';

  const match = emailString.match(/<(.+)>/);
  return match ? match[1].trim() : emailString.trim();
}

/**
 * Parse name from "Name <email@domain.com>" format
 * Returns the name part, or null if not present
 */
export function parseEmailName(emailString) {
  if (!emailString) return null;

  const match = emailString.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, '') : null;
}

/**
 * Parse full name into first and last name
 */
export function parseFullName(fullName) {
  if (!fullName) {
    return { firstName: '', lastName: '' };
  }

  let name = fullName.trim();

  // If it looks like an email address, derive a name from the local part
  if (name.includes('@')) {
    const localPart = name.split('@')[0];
    const parts = localPart.split(/[._-]+/).map(
      (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    );
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
    };
  }

  const parts = name.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}
