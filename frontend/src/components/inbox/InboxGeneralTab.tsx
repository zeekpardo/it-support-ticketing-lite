import { useState } from 'react'
import { useInboxForm } from '../../hooks/useInboxForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { XMarkIcon } from '@heroicons/react/20/solid'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface InboxGeneralTabProps {
  inboxForm: ReturnType<typeof useInboxForm>
  staffMembers: StaffMember[]
}

const DUE_DATE_CONFIG = [
  { key: 'dueDateLowDays' as const, label: 'Low Priority', placeholder: 'e.g. 7' },
  { key: 'dueDateMediumDays' as const, label: 'Medium Priority', placeholder: 'e.g. 5' },
  { key: 'dueDateHighDays' as const, label: 'High Priority', placeholder: 'e.g. 2' },
  { key: 'dueDateUrgentDays' as const, label: 'Urgent Priority', placeholder: 'e.g. 1' },
]

export function InboxGeneralTab({ inboxForm, staffMembers }: InboxGeneralTabProps) {
  const { form, setField, saving } = inboxForm
  const [domainInput, setDomainInput] = useState('')
  const [domainError, setDomainError] = useState('')

  const addDomain = () => {
    const raw = domainInput.trim().toLowerCase().replace(/^@/, '')
    if (!raw) return
    if (!raw.includes('.') || raw.includes(' ')) {
      setDomainError('Enter a valid domain (e.g. example.com)')
      return
    }
    if (form.allowedEmailDomains.includes(raw)) {
      setDomainError('Domain already added')
      return
    }
    setField('allowedEmailDomains', [...form.allowedEmailDomains, raw])
    setDomainInput('')
    setDomainError('')
  }

  const removeDomain = (domain: string) => {
    setField('allowedEmailDomains', form.allowedEmailDomains.filter(d => d !== domain))
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
      <form onSubmit={inboxForm.handleSubmit}>
        {inboxForm.error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {inboxForm.error}
          </div>
        )}

        <FieldGroup>
          <Field>
            <Label>Inbox Name</Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Website Redesign"
              required
            />
          </Field>

          <Field>
            <Label>Inbox Code</Label>
            <Input
              type="text"
              value={form.inboxCode}
              onChange={(e) => setField('inboxCode', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
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
              placeholder="Brief description of the inbox..."
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
            <Description>Tickets created for this inbox will be automatically assigned to this person</Description>
          </Field>

          {/* Due Date Fields */}
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

          <Field>
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <Description>Inactive inboxes are hidden from time entry</Description>
              </div>
              <Switch
                checked={form.isActive}
                onChange={(val) => setField('isActive', val)}
                color="blue"
              />
            </div>
          </Field>

          {/* Allowed Email Domains */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">Allowed Email Domains</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              Only emails from these domains can submit tickets via the public form. Leave empty to allow any domain.
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={domainInput}
                onChange={(e) => { setDomainInput(e.target.value); setDomainError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }}
                placeholder="example.com"
                className="flex-1"
              />
              <Button type="button" outline onClick={addDomain}>Add</Button>
            </div>
            {domainError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{domainError}</p>
            )}
            {form.allowedEmailDomains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.allowedEmailDomains.map(domain => (
                  <Badge key={domain} color="blue">
                    {domain}
                    <button
                      type="button"
                      onClick={() => removeDomain(domain)}
                      className="ml-1 inline-flex hover:text-blue-900 dark:hover:text-blue-200"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
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
  )
}
