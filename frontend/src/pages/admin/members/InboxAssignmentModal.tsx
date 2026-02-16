import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import InboxCheckboxList from './InboxCheckboxList'

interface Member {
  id: string
  user: { id: string; name: string; email: string }
}

interface Inbox {
  id: string
  name: string
  inboxCode: string
  isActive: boolean
}

interface InboxAssignmentModalProps {
  member: Member | null
  onClose: () => void
  onSuccess?: () => void
}

export default function InboxAssignmentModal({ member, onClose, onSuccess }: InboxAssignmentModalProps) {
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!member) return

    setLoading(true)
    Promise.all([
      api.getInboxes(),
      api.getMemberInboxes(member.id),
    ])
      .then(([inboxesData, assignmentsData]) => {
        setInboxes(inboxesData)
        setAssignedIds(new Set(assignmentsData.map(a => a.inbox.id)))
      })
      .catch(err => console.error('Failed to load inboxes:', err))
      .finally(() => setLoading(false))
  }, [member])

  const handleToggle = (inboxId: string, checked: boolean) => {
    setAssignedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(inboxId)
      else next.delete(inboxId)
      return next
    })
  }

  const handleSave = async () => {
    if (!member) return

    setSaving(true)
    try {
      await api.updateMemberInboxes(member.id, Array.from(assignedIds))
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('Failed to save inbox assignments:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!member} onClose={onClose} size="md">
      <DialogTitle>Manage Inbox Access</DialogTitle>
      <DialogDescription>
        {member && (
          <>Select which inboxes <strong>{member.user.name}</strong> can access.</>
        )}
      </DialogDescription>

      <DialogBody>
        {loading ? (
          <div className="py-8 text-center">
            <Text>Loading inboxes...</Text>
          </div>
        ) : (
          <InboxCheckboxList
            inboxes={inboxes}
            selectedIds={assignedIds}
            onToggle={handleToggle}
            emptyMessage="No inboxes available. Create an inbox first."
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
