import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { TicketForm } from '../tickets/TicketForm'
import { Dialog, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { Field, Label } from '@/components/ui/fieldset'
import { Select } from '@/components/ui/select'

interface Project {
  id: string
  name: string
  projectCode: string
}

interface Client {
  id: string
  user: { id: string; name: string; email: string }
  projectAssignments: Array<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>
}

interface NewTicketDialogProps {
  open: boolean
  onClose: () => void
  projects: Project[]
  clients: Client[]
}

export function NewTicketDialog({ open, onClose, projects, clients }: NewTicketDialogProps) {
  const navigate = useNavigate()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  const availableClients = selectedProjectId
    ? clients.filter(client =>
        client.projectAssignments.some(pa => pa.project.id === selectedProjectId)
      )
    : []

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedClientId('')
  }

  const handleClose = () => {
    setSelectedProjectId('')
    setSelectedClientId('')
    onClose()
  }

  const handleCreateTicket = async (data: any) => {
    if (!selectedProjectId) {
      throw new Error('Please select a project')
    }
    if (!selectedClientId) {
      throw new Error('Please select a client')
    }

    const ticket = await api.createTicket({
      ...data,
      projectId: selectedProjectId,
      clientId: selectedClientId,
    })
    handleClose()
    navigate(`/projects/${ticket.projectId}/tickets/${ticket.id}`)
  }

  return (
    <Dialog open={open} onClose={handleClose} size="2xl">
      <DialogTitle>Create New Ticket</DialogTitle>
      <DialogBody>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Field>
            <Label>Project *</Label>
            <Select
              value={selectedProjectId}
              onChange={e => handleProjectChange(e.target.value)}
              required
            >
              <option value="">Select a project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.projectCode})
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Client *</Label>
            <Select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              disabled={!selectedProjectId}
              required
            >
              <option value="">
                {selectedProjectId ? 'Select a client' : 'Select a project first'}
              </option>
              {availableClients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.user.name} ({client.user.email})
                </option>
              ))}
            </Select>
            {selectedProjectId && availableClients.length === 0 && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                No clients assigned to this project. Assign a client first from the Users page.
              </p>
            )}
          </Field>
        </div>

        <TicketForm
          projects={projects.filter(p => p.id === selectedProjectId)}
          onSubmit={handleCreateTicket}
          showPriority={true}
          showContactFields={true}
          preselectedProjectId={selectedProjectId}
        />
      </DialogBody>
    </Dialog>
  )
}
