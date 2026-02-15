import { useParams, Link } from 'react-router-dom'
import { useTicketDetail } from '../hooks/useTicketDetail'
import { TicketComments, TicketTimer, TicketMetadata, TicketAssignment } from '../components/tickets'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ArrowLeftIcon, TrashIcon, LinkIcon, PaperClipIcon } from '@heroicons/react/24/outline'
import { EmailContent } from '../components/EmailContent'
import { safeHref } from '../utils/sanitize'

export default function TicketDetail() {
  const { projectId, ticketId } = useParams<{ projectId: string; ticketId: string }>()
  const {
    ticket,
    staffMembers,
    mentionableMembers,
    loading,
    saving,
    isAdmin,
    isStaff,
    currentOrg,
    loadData,
    handleStatusChange,
    handleAssign,
    handlePriorityChange,
    handleDueDateChange,
    handleDelete,
    handleImageUpload,
    handleAddComment,
    editingName,
    editFirstName,
    editLastName,
    firstNameRef,
    setEditFirstName,
    setEditLastName,
    startEditingName,
    cancelEditingName,
    saveClientName,
    handleNameKeyDown,
  } = useTicketDetail(ticketId, projectId)

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to view tickets</Text>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Ticket not found</Text>
      </div>
    )
  }

  const fileAttachments = ticket.attachments?.filter(a => !a.isInline) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to={`/projects/${projectId}/tickets`}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 mt-1"
          >
            <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Heading>{ticket.subject}</Heading>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>{ticket.project.name}</span>
              <span>·</span>
              <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button color="red" onClick={handleDelete}>
            <TrashIcon className="w-4 h-4" />
            Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Description</Subheading>
            <div className="mt-3">
              <EmailContent text={ticket.description} html={ticket.descriptionHtml} />
            </div>
            {safeHref(ticket.screenRecordingLink) && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <a
                  href={safeHref(ticket.screenRecordingLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <LinkIcon className="w-4 h-4" />
                  View Screen Recording
                </a>
              </div>
            )}
          </div>

          {/* Attachments (exclude inline images already shown in description) */}
          {fileAttachments.length > 0 && (
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-3">
                <PaperClipIcon className="w-4 h-4" />
                Attachments ({fileAttachments.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {fileAttachments.map(att => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    {att.fileType.startsWith('image/') ? (
                      <img
                        src={att.fileUrl}
                        alt={att.fileName}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                        <PaperClipIcon className="w-8 h-8 text-zinc-400" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{att.fileName}</p>
                      <p className="text-xs text-zinc-500">{(att.fileSize / 1024).toFixed(0)} KB</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <TicketComments
              comments={ticket.comments}
              onAddComment={handleAddComment}
              onImageUpload={handleImageUpload}
              isStaff={true}
              mentionableMembers={mentionableMembers}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {isStaff && (
            <TicketTimer
              ticketId={ticket.id}
              timeEntries={ticket.timeEntries}
              totalMinutes={ticket.totalTimeMinutes}
              onTimerStarted={loadData}
              onTimerStopped={loadData}
            />
          )}

          <TicketAssignment
            ticket={ticket}
            staffMembers={staffMembers}
            saving={saving}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onAssign={handleAssign}
            onDueDateChange={handleDueDateChange}
          />

          <TicketMetadata
            ticket={ticket}
            saving={saving}
            editingName={editingName}
            editFirstName={editFirstName}
            editLastName={editLastName}
            firstNameRef={firstNameRef}
            setEditFirstName={setEditFirstName}
            setEditLastName={setEditLastName}
            startEditingName={startEditingName}
            cancelEditingName={cancelEditingName}
            saveClientName={saveClientName}
            handleNameKeyDown={handleNameKeyDown}
          />
        </div>
      </div>
    </div>
  )
}
