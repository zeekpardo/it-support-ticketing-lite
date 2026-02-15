import { TicketTimer } from './TicketTimer'
import { TicketMetadata } from './TicketMetadata'
import type { Ticket } from '../../hooks/useTicketDetail'

interface TicketSidebarProps {
  ticket: Ticket
  saving: boolean
  isStaff: boolean
  // Timer
  timerRunning: boolean
  elapsedSeconds: number
  timerLoading: boolean
  onStartTimer: () => Promise<void>
  onStopTimer: () => Promise<void>
  // Client name editing
  editingName: boolean
  editFirstName: string
  editLastName: string
  firstNameRef: React.Ref<HTMLInputElement>
  setEditFirstName: (value: string) => void
  setEditLastName: (value: string) => void
  startEditingName: () => void
  cancelEditingName: () => void
  saveClientName: () => Promise<void>
  handleNameKeyDown: (e: React.KeyboardEvent) => void
}

export function TicketSidebar({
  ticket,
  saving,
  isStaff,
  timerRunning,
  elapsedSeconds,
  timerLoading,
  onStartTimer,
  onStopTimer,
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
}: TicketSidebarProps) {
  return (
    <div className="space-y-6">
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

      {isStaff && (
        <TicketTimer
          timeEntries={ticket.timeEntries}
          totalMinutes={ticket.totalTimeMinutes}
          timerRunning={timerRunning}
          elapsedSeconds={elapsedSeconds}
          timerLoading={timerLoading}
          onStart={onStartTimer}
          onStop={onStopTimer}
        />
      )}
    </div>
  )
}
