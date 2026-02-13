import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import ProjectCheckboxList from './ProjectCheckboxList'

interface Member {
  id: string
  user: { id: string; name: string; email: string }
}

interface Project {
  id: string
  name: string
  projectCode: string
  isActive: boolean
}

interface ProjectAssignmentModalProps {
  member: Member | null
  onClose: () => void
  onSuccess?: () => void
}

export default function ProjectAssignmentModal({ member, onClose, onSuccess }: ProjectAssignmentModalProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!member) return

    setLoading(true)
    Promise.all([
      api.getProjects(),
      api.getMemberProjects(member.id),
    ])
      .then(([projectsData, assignmentsData]) => {
        setProjects(projectsData)
        setAssignedIds(new Set(assignmentsData.map(a => a.project.id)))
      })
      .catch(err => console.error('Failed to load projects:', err))
      .finally(() => setLoading(false))
  }, [member])

  const handleToggle = (projectId: string, checked: boolean) => {
    setAssignedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(projectId)
      else next.delete(projectId)
      return next
    })
  }

  const handleSave = async () => {
    if (!member) return

    setSaving(true)
    try {
      await api.updateMemberProjects(member.id, Array.from(assignedIds))
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('Failed to save project assignments:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!member} onClose={onClose} size="md">
      <DialogTitle>Manage Project Access</DialogTitle>
      <DialogDescription>
        {member && (
          <>Select which projects <strong>{member.user.name}</strong> can access.</>
        )}
      </DialogDescription>

      <DialogBody>
        {loading ? (
          <div className="py-8 text-center">
            <Text>Loading projects...</Text>
          </div>
        ) : (
          <ProjectCheckboxList
            projects={projects}
            selectedIds={assignedIds}
            onToggle={handleToggle}
            emptyMessage="No projects available. Create a project first."
          />
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
