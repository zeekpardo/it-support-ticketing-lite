import { useState, useEffect } from 'react'
import { api } from '../../../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import { EnvelopeIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import InboxCheckboxList from './InboxCheckboxList'

interface Inbox {
  id: string
  name: string
  inboxCode: string
  isActive: boolean
}

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  isSuperAdmin: boolean
  inviteMember: (email: string, role: string) => Promise<string>
}

export default function AddUserModal({ open, onClose, onSuccess, isSuperAdmin, inviteMember }: AddUserModalProps) {
  const [addMode, setAddMode] = useState<'invite' | 'create'>('invite')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'manager' | 'member' | 'client'>('member')
  const [inboxIds, setInboxIds] = useState<string[]>([])
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      api.getInboxes()
        .then(data => setInboxes(data.filter((p: Inbox) => p.isActive)))
        .catch(err => console.error('Failed to load inboxes:', err))
    }
  }, [open])

  const reset = () => {
    setAddMode('invite')
    setName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setRole('member')
    setInboxIds([])
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleInboxToggle = (inboxId: string, checked: boolean) => {
    setInboxIds(prev =>
      checked ? [...prev, inboxId] : prev.filter(id => id !== inboxId)
    )
  }

  const handleRoleChange = (newRole: 'manager' | 'member' | 'client') => {
    setRole(newRole)
    if (newRole === 'client' && !isSuperAdmin && addMode === 'create') {
      setAddMode('invite')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (role === 'client' && inboxIds.length === 0) {
        throw new Error('Please select at least one inbox for the client')
      }

      if (addMode === 'invite') {
        const invitationId = await inviteMember(email, role)

        // Save inbox assignments for the invitation if any were selected
        if (inboxIds.length > 0) {
          await api.saveInvitationInboxes(invitationId, inboxIds)
        }
      } else {
        if (!name.trim()) throw new Error('Name is required')
        if (!phone.trim()) throw new Error('Phone number is required')
        if (password.length < 8) throw new Error('Password must be at least 8 characters')

        await api.createUserAndAddToOrg({
          name,
          email,
          phone,
          password,
          role,
          inboxIds: (role === 'client' || role === 'member') ? inboxIds : undefined,
        })
      }

      handleClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setLoading(false)
    }
  }

  const showInboxSelection = addMode === 'invite' || (addMode === 'create' && (role === 'client' || role === 'member'))
  const inboxesRequired = role === 'client'

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <DialogTitle>Add User</DialogTitle>
      <DialogDescription>
        {addMode === 'invite'
          ? 'Send an invitation email to add a new user.'
          : 'Create a new user account directly.'}
      </DialogDescription>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          {isSuperAdmin && (
            <div className="mb-6 flex gap-2">
              <Button
                type="button"
                color={addMode === 'invite' ? 'blue' : 'white'}
                onClick={() => setAddMode('invite')}
                className="flex-1"
              >
                <EnvelopeIcon className="h-4 w-4" />
                Send Invitation
              </Button>
              <Button
                type="button"
                color={addMode === 'create' ? 'blue' : 'white'}
                onClick={() => setAddMode('create')}
                className="flex-1"
              >
                <UserPlusIcon className="h-4 w-4" />
                Create User
              </Button>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <FieldGroup>
            {addMode === 'create' && (
              <Field>
                <Label>Name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </Field>
            )}

            <Field>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </Field>

            {addMode === 'create' && (
              <Field>
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </Field>
            )}

            {addMode === 'create' && (
              <Field>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />
                <Description>The user can change this after logging in.</Description>
              </Field>
            )}

            <Field>
              <Label>Role</Label>
              <Select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as 'manager' | 'member' | 'client')}
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="client">Client</option>
              </Select>
              <Description className="mt-2 text-sm text-zinc-500">
                {role === 'manager' && 'Can manage members, inboxes, and tickets'}
                {role === 'member' && 'Can track time and work on tickets'}
                {role === 'client' && 'Can submit and view support tickets'}
              </Description>
            </Field>

            {showInboxSelection && (
              <Field>
                <Label>Inbox Access{inboxesRequired ? ' *' : ''}</Label>
                <Description className="mb-2">
                  {inboxesRequired
                    ? 'Select at least one inbox the client can access.'
                    : 'Optionally assign inboxes the user will have access to.'}
                </Description>
                <InboxCheckboxList
                  inboxes={inboxes}
                  selectedIds={inboxIds}
                  onToggle={handleInboxToggle}
                  emptyMessage="No active inboxes available. Create an inbox first."
                />
              </Field>
            )}
          </FieldGroup>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="blue" type="submit" disabled={loading}>
            {loading
              ? (addMode === 'invite' ? 'Sending...' : 'Creating...')
              : (addMode === 'invite' ? 'Send Invitation' : 'Create User')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
