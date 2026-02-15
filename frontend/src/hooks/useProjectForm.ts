import { useState, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface ProjectFormData {
  name: string
  projectCode: string
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
}

const INITIAL_FORM: ProjectFormData = {
  name: '',
  projectCode: '',
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
}

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
  autoReplyEnabled?: boolean
  autoReplyHtml?: string | null
  _count?: { timeEntries: number }
}

export function useProjectForm(projectId: string | undefined) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectFormData>(INITIAL_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [project, setProject] = useState<Project | null>(null)

  const setField = useCallback(<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const populateFromProject = useCallback((data: Project) => {
    setProject(data)
    setForm({
      name: data.name,
      projectCode: data.projectCode,
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
    })
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const parseDays = (val: string) => val ? parseInt(val, 10) : null

    try {
      await api.updateProject(projectId!, {
        name: form.name,
        projectCode: form.projectCode,
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
      })
      navigate('/admin/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
      setSaving(false)
    }
  }, [projectId, form, navigate])

  const handleDelete = useCallback(async () => {
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
  }, [project, navigate])

  return {
    form,
    setField,
    project,
    populateFromProject,
    error,
    saving,
    setSaving,
    deleting,
    handleSubmit,
    handleDelete,
  }
}
