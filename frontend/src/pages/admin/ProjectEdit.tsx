import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, TicketStage } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { ArrowLeftIcon, TrashIcon, PlusIcon, Bars3Icon, CheckCircleIcon, StarIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Project {
  id: string
  name: string
  projectCode: string
  clientName?: string
  description?: string
  isActive: boolean
  defaultAssigneeId?: string | null
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

const STAGE_COLORS = [
  { name: 'purple', class: 'bg-purple-600' },
  { name: 'blue', class: 'bg-blue-600' },
  { name: 'cyan', class: 'bg-cyan-600' },
  { name: 'teal', class: 'bg-teal-600' },
  { name: 'green', class: 'bg-green-600' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'red', class: 'bg-red-600' },
  { name: 'pink', class: 'bg-pink-600' },
  { name: 'indigo', class: 'bg-indigo-600' },
  { name: 'gray', class: 'bg-gray-600' }
]

function SortableStageItem({
  stage,
  onUpdate,
  onDelete,
  onSetDefault,
  onToggleResolved,
  canDelete
}: {
  stage: TicketStage
  onUpdate: (stageId: string, data: { name?: string; color?: string }) => void
  onDelete: (stage: TicketStage) => void
  onSetDefault: (stageId: string) => void
  onToggleResolved: (stageId: string) => void
  canDelete: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(stage.name)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const handleSave = () => {
    if (editName.trim() && editName !== stage.name) {
      onUpdate(stage.id, { name: editName.trim() })
    }
    setIsEditing(false)
  }

  const colorClass = STAGE_COLORS.find(c => c.name === stage.color)?.class || 'bg-gray-600'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      <div className={`w-4 h-4 rounded ${colorClass}`} />

      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-zinc-900 dark:text-white cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          {stage.name}
        </span>
      )}

      <div className="flex items-center gap-1">
        <Select
          value={stage.color}
          onChange={(e) => onUpdate(stage.id, { color: e.target.value })}
          className="text-xs w-24"
        >
          {STAGE_COLORS.map(color => (
            <option key={color.name} value={color.name}>
              {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
            </option>
          ))}
        </Select>

        <button
          onClick={() => onSetDefault(stage.id)}
          className={`p-1.5 rounded ${stage.isDefault ? 'text-amber-500' : 'text-zinc-400 hover:text-amber-500'}`}
          title={stage.isDefault ? 'Default stage' : 'Set as default'}
        >
          {stage.isDefault ? <StarSolid className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onToggleResolved(stage.id)}
          className={`p-1.5 rounded ${stage.isResolved ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`}
          title={stage.isResolved ? 'Resolved stage' : 'Mark as resolved stage'}
        >
          {stage.isResolved ? <CheckCircleSolid className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
        </button>

        {canDelete && (
          <button
            onClick={() => onDelete(stage)}
            className="p-1.5 rounded text-zinc-400 hover:text-red-500"
            title="Delete stage"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {stage._count && stage._count.tickets > 0 && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {stage._count.tickets} ticket{stage._count.tickets !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

export default function ProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [project, setProject] = useState<Project | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [stages, setStages] = useState<TicketStage[]>([])
  const [loading, setLoading] = useState(true)

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
  const [deleting, setDeleting] = useState(false)

  // Stage management state
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('gray')
  const [stageToDelete, setStageToDelete] = useState<TicketStage | null>(null)
  const [moveTicketsToStageId, setMoveTicketsToStageId] = useState('')
  const [stageError, setStageError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  useEffect(() => {
    if (currentOrg && id) {
      loadData()
    }
  }, [currentOrg, id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectData, staffData, stagesData] = await Promise.all([
        api.getProject(id!),
        api.getStaffMembers(),
        api.getProjectStages(id!)
      ])
      setProject(projectData)
      setStaffMembers(staffData)
      setStages(stagesData.sort((a, b) => a.position - b.position))

      // Populate form with project data
      setName(projectData.name)
      setProjectCode(projectData.projectCode)
      setClientName(projectData.clientName || '')
      setDescription(projectData.description || '')
      setDefaultAssigneeId(projectData.defaultAssigneeId || '')
      setDueDateLowDays(projectData.dueDateLowDays?.toString() || '')
      setDueDateMediumDays(projectData.dueDateMediumDays?.toString() || '')
      setDueDateHighDays(projectData.dueDateHighDays?.toString() || '')
      setDueDateUrgentDays(projectData.dueDateUrgentDays?.toString() || '')
      setIsActive(projectData.isActive)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Stage management handlers
  const handleAddStage = async () => {
    if (!newStageName.trim()) return
    setStageError('')

    try {
      const newStage = await api.createStage(id!, {
        name: newStageName.trim(),
        color: newStageColor
      })
      setStages([...stages, newStage])
      setNewStageName('')
      setNewStageColor('gray')
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Failed to create stage')
    }
  }

  const handleUpdateStage = async (stageId: string, data: { name?: string; color?: string }) => {
    setStageError('')
    try {
      const updated = await api.updateStage(id!, stageId, data)
      setStages(stages.map(s => s.id === stageId ? updated : s))
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Failed to update stage')
    }
  }

  const handleSetDefault = async (stageId: string) => {
    setStageError('')
    try {
      await api.updateStage(id!, stageId, { isDefault: true })
      setStages(stages.map(s => ({
        ...s,
        isDefault: s.id === stageId
      })))
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Failed to set default stage')
    }
  }

  const handleToggleResolved = async (stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    setStageError('')

    try {
      const updated = await api.updateStage(id!, stageId, { isResolved: !stage.isResolved })
      setStages(stages.map(s => s.id === stageId ? updated : s))
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Failed to update stage')
    }
  }

  const handleDeleteStage = async () => {
    if (!stageToDelete) return
    setStageError('')

    // If stage has tickets, require destination
    if (stageToDelete._count?.tickets && stageToDelete._count.tickets > 0 && !moveTicketsToStageId) {
      setStageError('Please select a stage to move tickets to')
      return
    }

    try {
      await api.deleteStage(id!, stageToDelete.id, moveTicketsToStageId)
      setStages(stages.filter(s => s.id !== stageToDelete.id))
      setStageToDelete(null)
      setMoveTicketsToStageId('')
    } catch (err) {
      setStageError(err instanceof Error ? err.message : 'Failed to delete stage')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stages.findIndex(s => s.id === active.id)
    const newIndex = stages.findIndex(s => s.id === over.id)

    const newStages = arrayMove(stages, oldIndex, newIndex)
    setStages(newStages)

    // Save new order to backend
    try {
      await api.reorderStages(id!, newStages.map(s => s.id))
    } catch (err) {
      // Revert on error
      setStages(stages)
      setStageError(err instanceof Error ? err.message : 'Failed to reorder stages')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    try {
      await api.updateProject(id!, {
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
      navigate('/admin/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    const hasEntries = project._count?.timeEntries && project._count.timeEntries > 0
    const message = hasEntries
      ? 'This project has time entries. It will be archived instead of deleted. Continue?'
      : 'Are you sure you want to delete this project? This action cannot be undone.'

    if (!confirm(message)) return

    setDeleting(true)
    try {
      await api.deleteProject(project.id)
      navigate('/admin/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setDeleting(false)
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

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Project not found</Text>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/projects"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>Edit Project</Heading>
          <Text className="text-zinc-500">Update the project details.</Text>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <form onSubmit={handleSubmit}>
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
                onChange={(e) => setName(e.target.value)}
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
          </FieldGroup>

          <div className="mt-6 flex justify-end gap-3">
            <Button plain onClick={() => navigate('/admin/projects')} disabled={saving}>
              Cancel
            </Button>
            <Button color="blue" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Ticket Stages */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <h3 className="text-sm font-medium text-zinc-950 dark:text-white mb-4">Ticket Stages</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Customize the workflow stages for your Kanban board. Drag to reorder.
        </p>

        {stageError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {stageError}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {stages.map(stage => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  onUpdate={handleUpdateStage}
                  onDelete={setStageToDelete}
                  onSetDefault={handleSetDefault}
                  onToggleResolved={handleToggleResolved}
                  canDelete={stages.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Input
            type="text"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="New stage name"
            className="flex-1 min-w-0"
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
          />
          <div className="flex items-center gap-1 shrink-0">
            <Select
              value={newStageColor}
              onChange={(e) => setNewStageColor(e.target.value)}
              className="text-xs w-24"
            >
              {STAGE_COLORS.map(color => (
                <option key={color.name} value={color.name}>
                  {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                </option>
              ))}
            </Select>
            <Button onClick={handleAddStage} disabled={!newStageName.trim()}>
              <PlusIcon className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <StarSolid className="w-3 h-3 text-amber-500" /> Default stage for new tickets
          </span>
          <span className="flex items-center gap-1">
            <CheckCircleSolid className="w-3 h-3 text-green-500" /> Resolved/closed stage
          </span>
        </div>
      </div>

      {/* Delete Stage Modal */}
      {stageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-zinc-950 dark:text-white mb-2">
              Delete Stage: {stageToDelete.name}
            </h3>

            {stageToDelete._count?.tickets && stageToDelete._count.tickets > 0 ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  This stage has {stageToDelete._count.tickets} ticket{stageToDelete._count.tickets !== 1 ? 's' : ''}.
                  Select a stage to move them to:
                </p>
                <Select
                  value={moveTicketsToStageId}
                  onChange={(e) => setMoveTicketsToStageId(e.target.value)}
                  className="w-full mb-4"
                >
                  <option value="">Select a stage...</option>
                  {stages.filter(s => s.id !== stageToDelete.id).map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </Select>
              </>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                This stage has no tickets and can be safely deleted.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button plain onClick={() => { setStageToDelete(null); setMoveTicketsToStageId('') }}>
                Cancel
              </Button>
              <Button color="red" onClick={handleDeleteStage}>
                Delete Stage
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-red-200 dark:ring-red-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {project._count?.timeEntries && project._count.timeEntries > 0
                ? 'This project has time entries and will be archived instead of deleted.'
                : 'Permanently delete this project. This action cannot be undone.'}
            </p>
          </div>
          <Button
            color="red"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            <TrashIcon className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete Project'}
          </Button>
        </div>
      </div>
    </div>
  )
}
