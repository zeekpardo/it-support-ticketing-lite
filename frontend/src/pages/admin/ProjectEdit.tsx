import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { useProjectForm } from '../../hooks/useProjectForm'
import { useStageManager } from '../../hooks/useStageManager'
import StageManager from '../../components/StageManager'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export default function ProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const { currentOrg } = useOrganization()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const projectForm = useProjectForm(id)
  const stageManager = useStageManager(id)

  useEffect(() => {
    if (currentOrg && id) {
      loadData()
    }
  }, [currentOrg, id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectData, staffData] = await Promise.all([
        api.getProject(id!),
        api.getStaffMembers(),
      ])
      projectForm.populateFromProject(projectData)
      setStaffMembers(staffData)
      await stageManager.loadStages()
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
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

  if (!projectForm.project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Project not found</Text>
      </div>
    )
  }

  const { form, setField, saving } = projectForm

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

      {/* Project Form */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <form onSubmit={projectForm.handleSubmit}>
          {projectForm.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {projectForm.error}
            </div>
          )}

          <FieldGroup>
            <Field>
              <Label>Project Name</Label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Website Redesign"
                required
              />
            </Field>

            <Field>
              <Label>Project Code</Label>
              <Input
                type="text"
                value={form.projectCode}
                onChange={(e) => setField('projectCode', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
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
                value={form.clientName}
                onChange={(e) => setField('clientName', e.target.value)}
                placeholder="Acme Corp"
              />
            </Field>

            <Field>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Brief description of the project..."
                rows={3}
              />
            </Field>

            <Field>
              <Label>Default Ticket Assignee (optional)</Label>
              <Select
                value={form.defaultAssigneeId}
                onChange={(e) => setField('defaultAssigneeId', e.target.value)}
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

            <DueDateFields form={form} setField={setField} />

            <Field>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <Description>Inactive projects are hidden from time entry</Description>
                </div>
                <Switch
                  checked={form.isActive}
                  onChange={(val) => setField('isActive', val)}
                  color="blue"
                />
              </div>
            </Field>
          </FieldGroup>

          <div className="mt-6 flex justify-end gap-3">
            <Button plain onClick={() => history.back()} disabled={saving}>
              Cancel
            </Button>
            <Button color="blue" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Ticket Stages */}
      <StageManager
        stages={stageManager.stages}
        error={stageManager.error}
        onDragEnd={stageManager.handleDragEnd}
        onUpdate={stageManager.handleUpdate}
        onSetDefault={stageManager.handleSetDefault}
        onToggleResolved={stageManager.handleToggleResolved}
        onRequestDelete={stageManager.setStageToDelete}
        newStageName={stageManager.newStageName}
        onNewStageNameChange={stageManager.setNewStageName}
        newStageColor={stageManager.newStageColor}
        onNewStageColorChange={stageManager.setNewStageColor}
        onAdd={stageManager.handleAdd}
        stageToDelete={stageManager.stageToDelete}
        moveTicketsToStageId={stageManager.moveTicketsToStageId}
        onMoveTicketsToStageIdChange={stageManager.setMoveTicketsToStageId}
        onConfirmDelete={stageManager.handleDelete}
        onCancelDelete={stageManager.dismissDelete}
      />

      {/* Danger Zone */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-red-200 dark:ring-red-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {projectForm.project._count?.timeEntries && projectForm.project._count.timeEntries > 0
                ? 'This project has time entries and will be archived instead of deleted.'
                : 'Permanently delete this project. This action cannot be undone.'}
            </p>
          </div>
          <Button
            color="red"
            onClick={projectForm.handleDelete}
            disabled={projectForm.deleting || saving}
          >
            <TrashIcon className="h-4 w-4" />
            {projectForm.deleting ? 'Deleting...' : 'Delete Project'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Due date sub-section ----

interface DueDateFieldsProps {
  form: { dueDateLowDays: string; dueDateMediumDays: string; dueDateHighDays: string; dueDateUrgentDays: string }
  setField: (key: 'dueDateLowDays' | 'dueDateMediumDays' | 'dueDateHighDays' | 'dueDateUrgentDays', val: string) => void
}

const DUE_DATE_CONFIG = [
  { key: 'dueDateLowDays' as const, label: 'Low Priority', placeholder: 'e.g. 7' },
  { key: 'dueDateMediumDays' as const, label: 'Medium Priority', placeholder: 'e.g. 5' },
  { key: 'dueDateHighDays' as const, label: 'High Priority', placeholder: 'e.g. 2' },
  { key: 'dueDateUrgentDays' as const, label: 'Urgent Priority', placeholder: 'e.g. 1' },
]

function DueDateFields({ form, setField }: DueDateFieldsProps) {
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
      <p className="text-sm font-medium text-zinc-950 dark:text-white">Due Date by Priority (days)</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Auto-set due dates when tickets are created based on priority level</p>
      <div className="grid grid-cols-2 gap-3">
        {DUE_DATE_CONFIG.map(({ key, label, placeholder }) => (
          <Field key={key}>
            <Label className="text-xs text-zinc-500">{label}</Label>
            <Input
              type="number"
              min="0"
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
            />
          </Field>
        ))}
      </div>
    </div>
  )
}
