import { useParams, Link } from 'react-router-dom'
import { useTicketDetail } from '../hooks/useTicketDetail'
import { TicketThread } from '../components/tickets/TicketThread'
import { TicketSidebar } from '../components/tickets/TicketSidebar'
import { TicketAssignment } from '../components/tickets/TicketAssignment'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline'

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
    handleStatusChange,
    handleAssign,
    handlePriorityChange,
    handleDueDateChange,
    handleDelete,
    handleImageUpload,
    handleAddComment,
    timerRunning,
    elapsedSeconds,
    timerLoading,
    handleStartTimer,
    handleStopTimer,
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

  return (
    <div className="flex gap-6 lg:h-[calc(100svh-6rem)]">
      {/* Left column — header, status, thread */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Header */}
        <div className="shrink-0 mb-6 space-y-4">
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

          <TicketAssignment
            ticket={ticket}
            staffMembers={staffMembers}
            saving={saving}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onAssign={handleAssign}
            onDueDateChange={handleDueDateChange}
          />
        </div>

        {/* Thread (scrolls independently) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TicketThread
            ticket={ticket}
            mentionableMembers={mentionableMembers}
            isStaff={isStaff}
            onAddComment={handleAddComment}
            onImageUpload={handleImageUpload}
          />
        </div>
      </div>

      {/* Right column — full-height sidebar */}
      <div className="hidden lg:block w-80 shrink-0 overflow-y-auto">
        <TicketSidebar
          ticket={ticket}
          saving={saving}
          isStaff={isStaff}
          timerRunning={timerRunning}
          elapsedSeconds={elapsedSeconds}
          timerLoading={timerLoading}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
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
  )
}
