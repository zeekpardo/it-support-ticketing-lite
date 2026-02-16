import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { useCrudForm } from '../../hooks/useCrudForm'
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

export default function InboxNew() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const form = useCrudForm({
    initialData: {
      name: '',
      inboxCode: '',
      clientName: '',
      description: '',
      defaultAssigneeId: '',
      dueDateLowDays: '',
      dueDateMediumDays: '',
      dueDateHighDays: '',
      dueDateUrgentDays: '',
    },
  })

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
    form.setField('name', value)
    form.setField('inboxCode', generateCode(value))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    await form.handleSubmit(async () => {
      await api.createInbox({
        name: form.data.name,
        inboxCode: form.data.inboxCode,
        clientName: form.data.clientName || undefined,
        description: form.data.description || undefined,
        defaultAssigneeId: form.data.defaultAssigneeId || null,
        dueDateLowDays: parseDays(form.data.dueDateLowDays),
        dueDateMediumDays: parseDays(form.data.dueDateMediumDays),
        dueDateHighDays: parseDays(form.data.dueDateHighDays),
        dueDateUrgentDays: parseDays(form.data.dueDateUrgentDays),
      })
      navigate('/admin/inboxes')
    })
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
          to="/admin/inboxes"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>New Inbox</Heading>
          <Text className="text-zinc-500">Create a new inbox for your team to track time against.</Text>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <form onSubmit={handleSubmit}>
          {form.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {form.error}
            </div>
          )}

          <FieldGroup>
            <Field>
              <Label>Inbox Name</Label>
              <Input
                type="text"
                value={form.data.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Website Redesign"
                required
              />
            </Field>

            <Field>
              <Label>Inbox Code</Label>
              <Input
                type="text"
                value={form.data.inboxCode}
                onChange={(e) => form.setField('inboxCode', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
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
                value={form.data.clientName}
                onChange={(e) => form.setField('clientName', e.target.value)}
                placeholder="Acme Corp"
              />
            </Field>

            <Field>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.data.description}
                onChange={(e) => form.setField('description', e.target.value)}
                placeholder="Brief description of the inbox..."
                rows={3}
              />
            </Field>

            <Field>
              <Label>Default Ticket Assignee (optional)</Label>
              <Select
                value={form.data.defaultAssigneeId}
                onChange={(e) => form.setField('defaultAssigneeId', e.target.value)}
              >
                <option value="">No default assignee</option>
                {staffMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </Select>
              <Description>Tickets created for this inbox will be automatically assigned to this person</Description>
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
                    value={form.data.dueDateLowDays}
                    onChange={(e) => form.setField('dueDateLowDays', e.target.value)}
                    placeholder="e.g. 7"
                  />
                </Field>
                <Field>
                  <Label className="text-xs text-zinc-500">Medium Priority</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.data.dueDateMediumDays}
                    onChange={(e) => form.setField('dueDateMediumDays', e.target.value)}
                    placeholder="e.g. 5"
                  />
                </Field>
                <Field>
                  <Label className="text-xs text-zinc-500">High Priority</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.data.dueDateHighDays}
                    onChange={(e) => form.setField('dueDateHighDays', e.target.value)}
                    placeholder="e.g. 2"
                  />
                </Field>
                <Field>
                  <Label className="text-xs text-zinc-500">Urgent Priority</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.data.dueDateUrgentDays}
                    onChange={(e) => form.setField('dueDateUrgentDays', e.target.value)}
                    placeholder="e.g. 1"
                  />
                </Field>
              </div>
            </div>
          </FieldGroup>

          <div className="mt-6 flex justify-end gap-3">
            <Button plain onClick={() => navigate('/admin/inboxes')} disabled={form.saving}>
              Cancel
            </Button>
            <Button color="blue" type="submit" disabled={form.saving}>
              {form.saving ? 'Creating...' : 'Create Inbox'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
