import express from 'express';
import { prisma } from '../../lib/auth.js';
import { uploadAttachments } from '../../middleware/upload.js';
import { withUpload } from '../../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { createTicketAttachments } from '../../utils/entityHelpers.js';
import { sanitizeCommentHtml } from '../../utils/htmlSanitizer.js';
import { sendCommentNotifications } from '../../services/notificationService.js';
import { MEMBER_WITH_ROLE_AND_USER_BRIEF } from '../../utils/prismaFragments.js';

const router = express.Router();

// Add public message to ticket (supports file attachments via multipart/form-data)
router.post('/:id/messages', withUpload(uploadAttachments, async (req, res) => {
  const { content, contentHtml: rawContentHtml } = req.body;

  if (!content && !rawContentHtml) {
    throw new ValidationError('Content is required');
  }

  // Verify client owns this ticket
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organization.id,
      clientId: req.membership.id,
    },
    select: { id: true, subject: true, ownerId: true, clientId: true, status: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const contentHtml = rawContentHtml ? sanitizeCommentHtml(rawContentHtml) : null;

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: req.params.id,
      authorId: req.membership.id,
      content: content || '',
      contentHtml,
      isInternal: false,
    },
    include: {
      author: { select: MEMBER_WITH_ROLE_AND_USER_BRIEF },
    },
  });

  // Auto-update ticket status to IN_PROGRESS when client responds
  if (ticket.status !== 'IN_PROGRESS') {
    await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS' },
    });
  }

  const attachments = await createTicketAttachments(
    req.params.id, req.membership.id, req.files, comment.id
  );

  try {
    await sendCommentNotifications(prisma, {
      ticket,
      comment,
      authorName: comment.author.user.name,
      authorMemberId: req.membership.id,
      content: content || '',
      contentHtml,
      isInternal: false,
      organizationId: req.organization.id,
    });
  } catch (notifError) {
    console.error('Error sending comment notifications:', notifError);
  }

  res.status(201).json({ ...comment, attachments });
}));

export default router;
