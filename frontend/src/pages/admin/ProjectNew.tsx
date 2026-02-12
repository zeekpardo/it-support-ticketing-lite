import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export default function ProjectNew() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
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
      const staffData = await api.getStaffMembers()
      setStaffMembers(staffData)
    } catch (error) {
      console.error('Failed to load staff members:', error)
    } finally {
      setLoading(false)
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
    setProjectCode(generateCode(value))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    try {
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
      navigate('/admin/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setSaving(false)
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/projects"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>New Project</Heading>
          <Text className="text-zinc-500">Create a new project for your team to track time against.</Text>
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
          </FieldGroup>

          <div className="mt-6 flex justify-end gap-3">
            <Button plain onClick={() => navigate('/admin/projects')} disabled={saving}>
              Cancel
            </Button>
            <Button color="blue" type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
