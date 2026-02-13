import express from 'express';
import { prisma } from '../../lib/auth.js';
import { requireStaff } from '../../middleware/auth.js';
import { asyncHandler, withUpload } from '../../middleware/asyncHandler.js';
import { ValidationError } from '../../utils/errors.js';
import { uploadAttachments } from '../../middleware/upload.js';
import { findTicketOrFail, createTicketAttachments } from '../../utils/entityHelpers.js';
import { sendCommentNotifications } from '../../services/notificationService.js';
import { MEMBER_WITH_ROLE_AND_USER } from '../../utils/prismaFragments.js';

const router = express.Router();

// Get ticket comments
router.get('/:id/comments', requireStaff, asyncHandler(async (req, res) => {
  await findTicketOrFail(req.params.id, req.organization.id);

  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: MEMBER_WITH_ROLE_AND_USER },
      attachments: true,
    },
  });

  res.json(comments);
}));

// Add comment to ticket (supports file attachments via multipart/form-data)
router.post('/:id/comments', requireStaff, withUpload(uploadAttachments, async (req, res) => {
  const { content, isInternal: isInternalStr } = req.body;
  const isInternal = isInternalStr === 'true' || isInternalStr === true;

  if (!content) {
    throw new ValidationError('Content is required');
  }

  const ticket = await findTicketOrFail(req.params.id, req.organization.id);

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: req.params.id,
      authorId: req.membership.id,
      content,
      isInternal: isInternal || false,
    },
    include: {
      author: { select: MEMBER_WITH_ROLE_AND_USER },
    },
  });

  const attachments = await createTicketAttachments(
    req.params.id, req.membership.id, req.files, comment.id
  );

  try {
    await sendCommentNotifications(prisma, {
      ticket,
      comment,
      authorName: comment.author.user.name,
      authorMemberId: req.membership.id,
      content,
      isInternal,
      organizationId: req.organization.id,
    });
  } catch (notifError) {
    console.error('Error sending comment notifications:', notifError);
  }

  res.status(201).json({ ...comment, attachments });
}));

// Get mentionable members for a ticket (staff + ticket client)
router.get('/:id/mentionable-members', requireStaff, asyncHandler(async (req, res) => {
  const ticket = await findTicketOrFail(req.params.id, req.organization.id, {
    include: {
      client: { select: MEMBER_WITH_ROLE_AND_USER },
    },
  });

  const staffMembers = await prisma.member.findMany({
    where: {
      organizationId: req.organization.id,
      role: { in: ['owner', 'manager', 'member'] },
    },
    select: MEMBER_WITH_ROLE_AND_USER,
  });

  const members = staffMembers.filter(m => m.id !== req.membership.id);
  if (ticket.client && ticket.client.id !== req.membership.id && !members.some(m => m.id === ticket.client.id)) {
    members.push(ticket.client);
  }

  res.json(members);
}));

export default router;
