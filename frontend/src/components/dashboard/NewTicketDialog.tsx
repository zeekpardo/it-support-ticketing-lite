import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { TicketForm } from '../tickets/TicketForm'
import { Dialog, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { Field, Label } from '@/components/ui/fieldset'
import { Select } from '@/components/ui/select'

interface Inbox {
  id: string
  name: string
  inboxCode: string
}

interface Client {
  id: string
  user: { id: string; name: string; email: string }
  inboxAssignments: Array<{
    id: string
    inbox: { id: string; name: string; inboxCode: string; isActive: boolean }
  }>
}

interface NewTicketDialogProps {
  open: boolean
  onClose: () => void
  inboxes: Inbox[]
  clients: Client[]
}

export function NewTicketDialog({ open, onClose, inboxes, clients }: NewTicketDialogProps) {
  const navigate = useNavigate()
  const [selectedInboxId, setSelectedInboxId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  const availableClients = selectedInboxId
    ? clients.filter(client =>
        client.inboxAssignments.some(ia => ia.inbox.id === selectedInboxId)
      )
    : []

  const handleInboxChange = (inboxId: string) => {
    setSelectedInboxId(inboxId)
    setSelectedClientId('')
  }

  const handleClose = () => {
    setSelectedInboxId('')
    setSelectedClientId('')
    onClose()
  }

  const handleCreateTicket = async (data: any) => {
    if (!selectedInboxId) {
      throw new Error('Please select an inbox')
    }
    if (!selectedClientId) {
      throw new Error('Please select a client')
    }

    const ticket = await api.createTicket({
      ...data,
      inboxId: selectedInboxId,
      clientId: selectedClientId,
    })
    handleClose()
    navigate(`/inboxes/${ticket.inboxId}/tickets/${ticket.id}`)
  }

  return (
    <Dialog open={open} onClose={handleClose} size="2xl">
      <DialogTitle>Create New Ticket</DialogTitle>
      <DialogBody>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Field>
            <Label>Inbox *</Label>
            <Select
              value={selectedInboxId}
              onChange={e => handleInboxChange(e.target.value)}
              required
            >
              <option value="">Select an inbox</option>
              {inboxes.map(inbox => (
                <option key={inbox.id} value={inbox.id}>
                  {inbox.name} ({inbox.inboxCode})
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Client *</Label>
            <Select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              disabled={!selectedInboxId}
              required
            >
              <option value="">
                {selectedInboxId ? 'Select a client' : 'Select an inbox first'}
              </option>
              {availableClients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.user.name} ({client.user.email})
                </option>
              ))}
            </Select>
            {selectedInboxId && availableClients.length === 0 && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                No clients assigned to this inbox. Assign a client first from the Users page.
              </p>
            )}
          </Field>
        </div>

        <TicketForm
          inboxes={inboxes.filter(p => p.id === selectedInboxId)}
          onSubmit={handleCreateTicket}
          showPriority={true}
          showContactFields={true}
          preselectedInboxId={selectedInboxId}
        />
      </DialogBody>
    </Dialog>
  )
}
