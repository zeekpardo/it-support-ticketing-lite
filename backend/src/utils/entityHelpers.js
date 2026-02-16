import { prisma } from '../lib/auth.js';
import { NotFoundError } from './errors.js';
import { uploadFile, generateAttachmentKey } from '../lib/storage.js';

export async function findInboxOrFail(inboxId, organizationId, options = {}) {
  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, organizationId },
    ...options,
  });
  if (!inbox) throw new NotFoundError('Inbox not found');
  return inbox;
}

export async function findTicketOrFail(ticketId, organizationId, options = {}) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, organizationId },
    ...options,
  });
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
}

export async function findMemberOrFail(memberId, organizationId, options = {}) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    ...options,
  });
  if (!member) throw new NotFoundError('Member not found');
  return member;
}

export async function createInboxAssignments(memberId, inboxIds) {
  if (!inboxIds?.length) return;
  await prisma.inboxAssignment.createMany({
    data: inboxIds.map(inboxId => ({ memberId, inboxId })),
  });
}

export async function findTimeEntryOrFail(entryId, organizationId, options = {}) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, organizationId },
    ...options,
  });
  if (!entry) throw new NotFoundError('Time entry not found');
  return entry;
}

export async function findStageOrFail(stageId, inboxId, organizationId, options = {}) {
  const stage = await prisma.ticketStage.findFirst({
    where: {
      id: stageId,
      inboxId,
      inbox: { organizationId },
    },
    ...options,
  });
  if (!stage) throw new NotFoundError('Stage not found');
  return stage;
}

// Find ticket and verify the member has access to its inbox
export async function findTicketWithAccess(ticketId, organizationId, membership, options = {}) {
  const ticket = await findTicketOrFail(ticketId, organizationId, options);
  if (!await hasInboxAccess(ticket.inboxId, membership.id, membership.role)) {
    throw new NotFoundError('Ticket not found');
  }
  return ticket;
}

// Check if user has access to an inbox (assigned or admin)
export async function hasInboxAccess(inboxId, memberId, memberRole) {
  if (memberRole === 'owner' || memberRole === 'manager') {
    return true;
  }
  const assignment = await prisma.inboxAssignment.findUnique({
    where: { memberId_inboxId: { memberId, inboxId } }
  });
  return !!assignment;
}

// Get all inbox IDs a member is assigned to (for filtering queries)
export async function getAssignedInboxIds(memberId) {
  const assignments = await prisma.inboxAssignment.findMany({
    where: { memberId },
    select: { inboxId: true },
  });
  return assignments.map(a => a.inboxId);
}

export async function createTicketAttachments(ticketId, uploadedById, files, commentId = null, options = {}) {
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map(async (file) => {
      const key = generateAttachmentKey(ticketId, file.originalname);
      await uploadFile(file.buffer, key, file.mimetype);
      return prisma.ticketAttachment.create({
        data: {
          ticketId,
          commentId,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          fileUrl: `s3:${key}`,
          uploadedById,
        },
        ...options,
      });
    })
  );
}

// Check if user is a software owner for an inbox software
export async function isSoftwareOwner(inboxSoftwareId, memberId) {
  const admin = await prisma.inboxSoftwareAdmin.findFirst({
    where: { inboxSoftwareId, memberId, role: 'OWNER' }
  });
  return !!admin;
}

// Check if user is a software admin (owner or admin role)
export async function isSoftwareAdmin(inboxSoftwareId, memberId) {
  const admin = await prisma.inboxSoftwareAdmin.findFirst({
    where: { inboxSoftwareId, memberId }
  });
  return !!admin;
}
