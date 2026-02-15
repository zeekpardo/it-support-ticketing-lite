import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/fieldset'
import { TICKET_STATUSES } from './StatusBadge'
const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]
import type { Ticket, StaffMember } from '../../hooks/useTicketDetail'

interface TicketAssignmentProps {
  ticket: Ticket
  staffMembers: StaffMember[]
  saving: boolean
  onStatusChange: (status: string) => void
  onPriorityChange: (priority: string) => void
  onAssign: (ownerId: string | null) => void
  onDueDateChange: (dueDate: string) => void
}

export function TicketAssignment({
  ticket,
  staffMembers,
  saving,
  onStatusChange,
  onPriorityChange,
  onAssign,
  onDueDateChange,
}: TicketAssignmentProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field className="min-w-0">
        <Label>Status</Label>
        <Select
          value={ticket.status}
          onChange={e => onStatusChange(e.target.value)}
          disabled={saving}
        >
          {TICKET_STATUSES.map(status => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field className="min-w-0">
        <Label>Priority</Label>
        <Select
          value={ticket.priorityLevel}
          onChange={e => onPriorityChange(e.target.value)}
          disabled={saving}
        >
          {PRIORITY_OPTIONS.map(level => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field className="min-w-0">
        <Label>Assigned To</Label>
        <Select
          value={ticket.owner?.id || ''}
          onChange={e => onAssign(e.target.value || null)}
          disabled={saving}
        >
          <option value="">Unassigned</option>
          {staffMembers.map(member => (
            <option key={member.id} value={member.id}>
              {member.user.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field className="min-w-0">
        <Label>Due Date</Label>
        <Input
          type="date"
          value={ticket.dueDate ? ticket.dueDate.split('T')[0] : ''}
          onChange={e => onDueDateChange(e.target.value)}
          disabled={saving}
        />
      </Field>
    </div>
  )
}
