import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { Field, FieldGroup, Label, Description } from '../ui/fieldset'

interface TicketFormData {
  projectId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  subject: string
  requestType: string
  priorityLevel: string
  description: string
  screenRecordingLink: string
}

interface Project {
  id: string
  name: string
  projectCode: string
}

interface TicketFormProps {
  projects: Project[]
  onSubmit: (data: TicketFormData) => Promise<void>
  initialData?: Partial<TicketFormData>
  isLoading?: boolean
  showPriority?: boolean
  showContactFields?: boolean
  preselectedProjectId?: string
}

const REQUEST_TYPES = [
  { value: 'SOFTWARE_ISSUE', label: 'Software Issue' },
  { value: 'HARDWARE_REQUEST', label: 'Hardware Request' },
  { value: 'ACCESS_REQUEST', label: 'Access Request' },
  { value: 'GENERAL_SUPPORT', label: 'General Support' },
  { value: 'TECH_ADVICE', label: 'Technology Advice or Recommendation' },
  { value: 'OTHER', label: 'Other' }
]

const PRIORITY_LEVELS = [
  { value: 'LOW', label: 'My work is not affected' },
  { value: 'MEDIUM', label: "I can work, but it's slowing me down" },
  { value: 'HIGH', label: 'My main work is blocked' },
  { value: 'URGENT', label: "I can't work at all" }
]

export function TicketForm({
  projects,
  onSubmit,
  initialData,
  isLoading,
  showPriority = false,
  showContactFields = true,
  preselectedProjectId
}: TicketFormProps) {
  // Auto-select project if only one is available
  const autoSelectedProjectId = projects.length === 1 ? projects[0].id : undefined
  const effectiveProjectId = preselectedProjectId || autoSelectedProjectId

  const [formData, setFormData] = useState<TicketFormData>({
    projectId: effectiveProjectId || initialData?.projectId || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    subject: initialData?.subject || '',
    requestType: initialData?.requestType || 'GENERAL_SUPPORT',
    priorityLevel: initialData?.priorityLevel || 'MEDIUM',
    description: initialData?.description || '',
    screenRecordingLink: initialData?.screenRecordingLink || ''
  })

  // Update projectId when projects load and there's only one
  useEffect(() => {
    if (projects.length === 1 && !formData.projectId) {
      setFormData(prev => ({ ...prev, projectId: projects[0].id }))
    }
  }, [projects])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    if (!formData.projectId || !formData.subject || !formData.description) {
      setError('Please fill in all required fields')
      return
    }

    // Only validate contact fields if they're shown
    if (showContactFields && (!formData.firstName || !formData.lastName || !formData.email)) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      // Only include contact fields if they're shown
      const submitData = showContactFields
        ? formData
        : {
            projectId: formData.projectId,
            subject: formData.subject,
            requestType: formData.requestType,
            priorityLevel: formData.priorityLevel,
            description: formData.description,
            screenRecordingLink: formData.screenRecordingLink
          }
      await onSubmit(submitData as TicketFormData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showContactFields && (
        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Contact Details</h3>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName}
                  onChange={e => handleChange('firstName', e.target.value)}
                  placeholder="First Name"
                  required
                />
              </Field>
              <Field>
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                  placeholder="Last Name"
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </Field>
              <Field>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </Field>
            </div>
          </FieldGroup>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Issue Information</h3>
        <FieldGroup>
          {!effectiveProjectId && projects.length > 1 && (
            <Field>
              <Label>Project *</Label>
              <Select
                value={formData.projectId}
                onChange={e => handleChange('projectId', e.target.value)}
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
          )}

          <Field>
            <Label>Subject *</Label>
            <Description>Short subject of your request</Description>
            <Input
              value={formData.subject}
              onChange={e => handleChange('subject', e.target.value)}
              placeholder="Example: Password Reset"
              required
            />
          </Field>

          <div className={`grid ${showPriority ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <Field>
              <Label>Request Type *</Label>
              <Select
                value={formData.requestType}
                onChange={e => handleChange('requestType', e.target.value)}
              >
                {REQUEST_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            {showPriority && (
              <Field>
                <Label>Priority Level *</Label>
                <Select
                  value={formData.priorityLevel}
                  onChange={e => handleChange('priorityLevel', e.target.value)}
                >
                  {PRIORITY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <Field>
            <Label>Describe Issue *</Label>
            <Description>Describe the issue with as much information and detail as possible</Description>
            <Textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={5}
              placeholder="Please provide details about your issue..."
              required
            />
          </Field>

          <Field>
            <Label>Screen Recording Link (optional)</Label>
            <Description>Paste a link to a screen recording if you have one</Description>
            <Input
              value={formData.screenRecordingLink}
              onChange={e => handleChange('screenRecordingLink', e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </FieldGroup>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || isLoading}>
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </div>
    </form>
  )
}

export { REQUEST_TYPES, PRIORITY_LEVELS }
