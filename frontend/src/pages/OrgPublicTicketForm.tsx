import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getOrgFormInfo, submitOrgFormTicket, uploadOrgFormAttachments } from '../api/inboxes'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { FileUpload } from '@/components/ui/file-upload'
import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const PRIORITY_LEVELS = [
  { value: 'LOW', label: 'My work is not affected' },
  { value: 'MEDIUM', label: "I can work, but it's slowing me down" },
  { value: 'HIGH', label: 'My main work is blocked' },
  { value: 'URGENT', label: "I can't work at all" },
]

interface OrgFormInfo {
  organizationName: string
  inboxes: { id: string; name: string }[]
  branding: { appName: string; primaryColor: string; logoUrl: string | null }
}

export default function OrgPublicTicketForm() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'

  const [info, setInfo] = useState<OrgFormInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitted' | 'invalid'>('loading')

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    priorityLevel: 'MEDIUM',
    description: '',
    inboxId: '',
    screenRecordingLink: '',
  })
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    getOrgFormInfo(token)
      .then((data) => {
        setInfo(data)
        if (data.inboxes.length === 1) {
          setFormData(prev => ({ ...prev, inboxId: data.inboxes[0].id }))
        }
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      subject: '',
      priorityLevel: 'MEDIUM',
      description: '',
      inboxId: info?.inboxes.length === 1 ? info.inboxes[0].id : '',
      screenRecordingLink: '',
    })
    setAttachmentFiles([])
    setError(null)
    setStatus('ready')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.subject || !formData.description || !formData.inboxId) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const result = await submitOrgFormTicket(token!, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        subject: formData.subject,
        description: formData.description,
        priorityLevel: formData.priorityLevel,
        inboxId: formData.inboxId,
        screenRecordingLink: formData.screenRecordingLink || undefined,
      })

      // Upload attachments if any
      if (attachmentFiles.length > 0 && result.ticketId) {
        try {
          await uploadOrgFormAttachments(token!, result.ticketId, attachmentFiles)
        } catch (attachErr) {
          console.error('Attachment upload failed:', attachErr)
        }
      }

      setStatus('submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <Text className="text-zinc-600 dark:text-zinc-400">Loading...</Text>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <Heading>Form Not Available</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            This form is no longer available or has been disabled.
          </Text>
        </div>
      </div>
    )
  }

  if (status === 'submitted') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <Heading>Request Submitted!</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Your request has been submitted. Check your email for a link to track your ticket.
          </Text>
          <Button
            outline
            className="mt-6"
            onClick={resetForm}
          >
            Submit Another Request
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex justify-center bg-zinc-50 dark:bg-zinc-900 ${isEmbed ? 'p-4' : 'min-h-screen px-4 py-12'}`}>
      <div className="w-full max-w-2xl">
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="text-center mb-8">
            {info?.branding.logoUrl && (
              <img
                src={info.branding.logoUrl}
                alt={info.organizationName}
                className="mx-auto mb-4 h-12 w-auto object-contain"
              />
            )}
            <Heading>{info?.organizationName}</Heading>
            <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
              Submit a support request
            </Text>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Contact Info */}
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
              </FieldGroup>
            </div>

            {/* Ticket Info */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Request Details</h3>
              <FieldGroup>
                {info && info.inboxes.length > 1 && (
                  <Field>
                    <Label>Inbox *</Label>
                    <Description>Select the team to handle your request</Description>
                    <Select
                      value={formData.inboxId}
                      onChange={e => handleChange('inboxId', e.target.value)}
                      required
                    >
                      <option value="">Select an inbox</option>
                      {info.inboxes.map(inbox => (
                        <option key={inbox.id} value={inbox.id}>
                          {inbox.name}
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
                  <Label>Attachments (optional)</Label>
                  <Description>Upload screenshots or relevant files. Max 5 files, 10MB each.</Description>
                  <FileUpload
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                    multiple
                    maxFiles={5}
                    maxSizeMB={10}
                    files={attachmentFiles}
                    onFilesSelected={(newFiles) => setAttachmentFiles(prev => [...prev, ...newFiles])}
                    onRemoveFile={(index) => setAttachmentFiles(prev => prev.filter((_, i) => i !== index))}
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
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>

          <Text className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-500 hover:underline">Log in</Link>{' '}
            to view your tickets.
          </Text>
        </div>
      </div>
    </div>
  )
}
