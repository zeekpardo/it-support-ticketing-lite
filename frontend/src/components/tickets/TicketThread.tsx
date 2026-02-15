import { TicketComments } from './TicketComments'
import type { Ticket, MentionableMember } from '../../hooks/useTicketDetail'

interface TicketThreadProps {
  ticket: Ticket
  mentionableMembers: MentionableMember[]
  isStaff: boolean
  onAddComment: (content: string, contentHtml: string, isInternal: boolean, files?: File[], status?: string) => Promise<void>
  onImageUpload?: (file: File) => Promise<string | null>
}

export function TicketThread({ ticket, mentionableMembers, isStaff, onAddComment, onImageUpload }: TicketThreadProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
      <TicketComments
        comments={ticket.comments}
        onAddComment={onAddComment}
        onImageUpload={onImageUpload}
        isStaff={isStaff}
        mentionableMembers={mentionableMembers}
        ticket={{
          description: ticket.description,
          descriptionHtml: ticket.descriptionHtml,
          firstName: ticket.firstName,
          lastName: ticket.lastName,
          email: ticket.email,
          createdAt: ticket.createdAt,
          attachments: ticket.attachments,
        }}
      />
    </div>
  )
}
