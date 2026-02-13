import { prisma } from '../lib/auth.js';
import { NotFoundError } from './errors.js';

export async function findProjectOrFail(projectId, organizationId, options = {}) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    ...options,
  });
  if (!project) throw new NotFoundError('Project not found');
  return project;
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

export async function findTimeEntryOrFail(entryId, organizationId, options = {}) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, organizationId },
    ...options,
  });
  if (!entry) throw new NotFoundError('Time entry not found');
  return entry;
}
