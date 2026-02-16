import { useState, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface InboxFormData {
  name: string
  inboxCode: string
  clientName: string
  description: string
  defaultAssigneeId: string
  dueDateLowDays: string
  dueDateMediumDays: string
  dueDateHighDays: string
  dueDateUrgentDays: string
  isActive: boolean
  autoReplyEnabled: boolean
  autoReplyHtml: string
  allowedEmailDomains: string[]
}

const INITIAL_FORM: InboxFormData = {
  name: '',
  inboxCode: '',
  clientName: '',
  description: '',
  defaultAssigneeId: '',
  dueDateLowDays: '',
  dueDateMediumDays: '',
  dueDateHighDays: '',
  dueDateUrgentDays: '',
  isActive: true,
  autoReplyEnabled: false,
  autoReplyHtml: '',
  allowedEmailDomains: [],
}

interface Inbox {
  id: string
  name: string
  inboxCode: string
  clientName?: string
  description?: string
  isActive: boolean
  defaultAssigneeId?: string | null
  dueDateLowDays?: number | null
  dueDateMediumDays?: number | null
  dueDateHighDays?: number | null
  dueDateUrgentDays?: number | null
  autoReplyEnabled?: boolean
  autoReplyHtml?: string | null
  allowedEmailDomains?: string[]
  _count?: { timeEntries: number }
}

export function useInboxForm(inboxId: string | undefined) {
  const navigate = useNavigate()
  const [form, setForm] = useState<InboxFormData>(INITIAL_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inbox, setInbox] = useState<Inbox | null>(null)

  const setField = useCallback(<K extends keyof InboxFormData>(key: K, value: InboxFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const populateFromInbox = useCallback((data: Inbox) => {
    setInbox(data)
    setForm({
      name: data.name,
      inboxCode: data.inboxCode,
      clientName: data.clientName || '',
      description: data.description || '',
      defaultAssigneeId: data.defaultAssigneeId || '',
      dueDateLowDays: data.dueDateLowDays?.toString() || '',
      dueDateMediumDays: data.dueDateMediumDays?.toString() || '',
      dueDateHighDays: data.dueDateHighDays?.toString() || '',
      dueDateUrgentDays: data.dueDateUrgentDays?.toString() || '',
      isActive: data.isActive,
      autoReplyEnabled: data.autoReplyEnabled ?? false,
      autoReplyHtml: data.autoReplyHtml || '',
      allowedEmailDomains: data.allowedEmailDomains || [],
    })
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    try {
      await api.updateInbox(inboxId!, {
        name: form.name,
        inboxCode: form.inboxCode,
        clientName: form.clientName || undefined,
        description: form.description || undefined,
        defaultAssigneeId: form.defaultAssigneeId || null,
        dueDateLowDays: parseDays(form.dueDateLowDays),
        dueDateMediumDays: parseDays(form.dueDateMediumDays),
        dueDateHighDays: parseDays(form.dueDateHighDays),
        dueDateUrgentDays: parseDays(form.dueDateUrgentDays),
        isActive: form.isActive,
        autoReplyEnabled: form.autoReplyEnabled,
        autoReplyHtml: form.autoReplyHtml || null,
        allowedEmailDomains: form.allowedEmailDomains,
      })
      navigate('/admin/inboxes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inbox')
      setSaving(false)
    }
  }, [inboxId, form, navigate])

  const handleDelete = useCallback(async () => {
    if (!inbox) return

    const hasEntries = inbox._count?.timeEntries && inbox._count.timeEntries > 0
    const message = hasEntries
      ? 'This inbox has time entries. It will be archived instead of deleted. Continue?'
      : 'Are you sure you want to delete this inbox? This action cannot be undone.'

    if (!confirm(message)) return

    setDeleting(true)
    try {
      await api.deleteInbox(inbox.id)
      navigate('/admin/inboxes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inbox')
      setDeleting(false)
    }
  }, [inbox, navigate])

  return {
    form,
    setField,
    inbox,
    populateFromInbox,
    error,
    saving,
    setSaving,
    deleting,
    handleSubmit,
    handleDelete,
  }
}
