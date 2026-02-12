import { useState, useEffect, FormEvent } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Switch } from '@/components/ui/switch'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlusIcon, PencilIcon, TrashIcon, FolderIcon } from '@heroicons/react/24/outline'

interface Project {
  id: string
  name: string
  projectCode: string
  clientName?: string
  description?: string
  isActive: boolean
  defaultAssigneeId?: string | null
  defaultAssignee?: {
    id: string
    role: string
    user: { id: string; name: string }
  } | null
  dueDateLowDays?: number | null
  dueDateMediumDays?: number | null
  dueDateHighDays?: number | null
  dueDateUrgentDays?: number | null
  _count?: {
    timeEntries: number
  }
}

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export default function AdminProjects() {
  const { currentOrg } = useOrganization()
  const [projects, setProjects] = useState<Project[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [clientName, setClientName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string>('')
  const [dueDateLowDays, setDueDateLowDays] = useState<string>('')
  const [dueDateMediumDays, setDueDateMediumDays] = useState<string>('')
  const [dueDateHighDays, setDueDateHighDays] = useState<string>('')
  const [dueDateUrgentDays, setDueDateUrgentDays] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadData()
    }
  }, [currentOrg])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsData, staffData] = await Promise.all([
        api.getProjects(true), // Include inactive
        api.getStaffMembers()
      ])
      setProjects(projectsData)
      setStaffMembers(staffData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      const data = await api.getProjects(true)
      setProjects(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const openCreateModal = () => {
    setEditingProject(null)
    setName('')
    setProjectCode('')
    setClientName('')
    setDescription('')
    setDefaultAssigneeId('')
    setDueDateLowDays('')
    setDueDateMediumDays('')
    setDueDateHighDays('')
    setDueDateUrgentDays('')
    setIsActive(true)
    setError('')
    setShowModal(true)
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project)
    setName(project.name)
    setProjectCode(project.projectCode)
    setClientName(project.clientName || '')
    setDescription(project.description || '')
    setDefaultAssigneeId(project.defaultAssigneeId || '')
    setDueDateLowDays(project.dueDateLowDays?.toString() || '')
    setDueDateMediumDays(project.dueDateMediumDays?.toString() || '')
    setDueDateHighDays(project.dueDateHighDays?.toString() || '')
    setDueDateUrgentDays(project.dueDateUrgentDays?.toString() || '')
    setIsActive(project.isActive)
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Parse due date values (empty string becomes null)
    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, {
          name,
          projectCode,
          clientName: clientName || undefined,
          description: description || undefined,
          defaultAssigneeId: defaultAssigneeId || null,
          dueDateLowDays: parseDays(dueDateLowDays),
          dueDateMediumDays: parseDays(dueDateMediumDays),
          dueDateHighDays: parseDays(dueDateHighDays),
          dueDateUrgentDays: parseDays(dueDateUrgentDays),
          isActive
        })
      } else {
        await api.createProject({
          name,
          projectCode,
          clientName: clientName || undefined,
          description: description || undefined,
          defaultAssigneeId: defaultAssigneeId || null,
          dueDateLowDays: parseDays(dueDateLowDays),
          dueDateMediumDays: parseDays(dueDateMediumDays),
          dueDateHighDays: parseDays(dueDateHighDays),
          dueDateUrgentDays: parseDays(dueDateUrgentDays)
        })
      }

      setShowModal(false)
      loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (project: Project) => {
    const message = project._count?.timeEntries
      ? 'This project has time entries. It will be archived instead of deleted. Continue?'
      : 'Are you sure you want to delete this project?'

    if (!confirm(message)) return

    try {
      await api.deleteProject(project.id)
      loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 10)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!editingProject) {
      setProjectCode(generateCode(value))
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Heading>Manage Projects</Heading>
        <Button color="blue" onClick={openCreateModal}>
          <PlusIcon className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <FolderIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No projects yet</Subheading>
          <Text className="mt-2">
            Create your first project to start tracking time.
          </Text>
          <Button color="blue" onClick={openCreateModal} className="mt-4">
            <PlusIcon className="h-4 w-4" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Code</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Default Assignee</TableHeader>
                <TableHeader>Entries</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="w-[100px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Badge color="blue">{project.projectCode}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-zinc-500">
                    {project.clientName || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {project.defaultAssignee?.user.name || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {project._count?.timeEntries || 0}
                  </TableCell>
                  <TableCell>
                    {project.isActive ? (
                      <Badge color="green">Active</Badge>
                    ) : (
                      <Badge color="zinc">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button plain onClick={() => openEditModal(project)}>
                        <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                      <Button plain onClick={() => handleDelete(project)}>
                        <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Dialog open={true} onClose={() => setShowModal(false)} size="md">
          <DialogTitle>
            {editingProject ? 'Edit Project' : 'New Project'}
          </DialogTitle>
          <DialogDescription>
            {editingProject
              ? 'Update the project details.'
              : 'Create a new project for your team to track time against.'}
          </DialogDescription>

          <form onSubmit={handleSubmit}>
            <DialogBody>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Project Name</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Website Redesign"
                    required
                  />
                </Field>

                <Field>
                  <Label>Project Code</Label>
                  <Input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    placeholder="WEB-REDESIGN"
                    required
                    maxLength={10}
                  />
                  <Description>Short code for quick reference (max 10 chars)</Description>
                </Field>

                <Field>
                  <Label>Client Name (optional)</Label>
                  <Input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </Field>

                <Field>
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the project..."
                    rows={3}
                  />
                </Field>

                <Field>
                  <Label>Default Ticket Assignee (optional)</Label>
                  <Select
                    value={defaultAssigneeId}
                    onChange={(e) => setDefaultAssigneeId(e.target.value)}
                  >
                    <option value="">No default assignee</option>
                    {staffMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.user.name} ({member.role})
                      </option>
                    ))}
                  </Select>
                  <Description>Tickets created for this project will be automatically assigned to this person</Description>
                </Field>

                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                  <p className="text-sm font-medium text-zinc-950 dark:text-white">Due Date by Priority (days)</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Auto-set due dates when tickets are created based on priority level</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <Label className="text-xs text-zinc-500">Low Priority</Label>
                      <Input
                        type="number"
                        min="0"
                        value={dueDateLowDays}
                        onChange={(e) => setDueDateLowDays(e.target.value)}
                        placeholder="e.g. 7"
                      />
                    </Field>
                    <Field>
                      <Label className="text-xs text-zinc-500">Medium Priority</Label>
                      <Input
                        type="number"
                        min="0"
                        value={dueDateMediumDays}
                        onChange={(e) => setDueDateMediumDays(e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </Field>
                    <Field>
                      <Label className="text-xs text-zinc-500">High Priority</Label>
                      <Input
                        type="number"
                        min="0"
                        value={dueDateHighDays}
                        onChange={(e) => setDueDateHighDays(e.target.value)}
                        placeholder="e.g. 2"
                      />
                    </Field>
                    <Field>
                      <Label className="text-xs text-zinc-500">Urgent Priority</Label>
                      <Input
                        type="number"
                        min="0"
                        value={dueDateUrgentDays}
                        onChange={(e) => setDueDateUrgentDays(e.target.value)}
                        placeholder="e.g. 1"
                      />
                    </Field>
                  </div>
                </div>

                {editingProject && (
                  <Field>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Active</Label>
                        <Description>Inactive projects are hidden from time entry</Description>
                      </div>
                      <Switch
                        checked={isActive}
                        onChange={setIsActive}
                        color="blue"
                      />
                    </div>
                  </Field>
                )}
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  )
}
