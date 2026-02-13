import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import type { StaffMember } from './types'

interface AddAdminModalProps {
  availableMembers: StaffMember[]
  selectedMemberId: string
  selectedRole: 'OWNER' | 'ADMIN'
  addingAdmin: boolean
  onSelectedMemberIdChange: (memberId: string) => void
  onSelectedRoleChange: (role: 'OWNER' | 'ADMIN') => void
  onAddAdmin: () => void
  onClose: () => void
}

export default function AddAdminModal({
  availableMembers,
  selectedMemberId,
  selectedRole,
  addingAdmin,
  onSelectedMemberIdChange,
  onSelectedRoleChange,
  onAddAdmin,
  onClose,
}: AddAdminModalProps) {
  return (
    <Dialog open={true} onClose={onClose} size="md">
      <DialogTitle>Add Software Admin</DialogTitle>
      <DialogDescription>
        Add a staff member as an admin for this software.
      </DialogDescription>

      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Staff Member</Label>
            <Select
              value={selectedMemberId}
              onChange={(e) => onSelectedMemberIdChange(e.target.value)}
            >
              <option value="">Select member...</option>
              {availableMembers.map(m => (
                <option key={m.id} value={m.id}>{m.user.name} ({m.user.email})</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onChange={(e) => onSelectedRoleChange(e.target.value as 'OWNER' | 'ADMIN')}
            >
              <option value="ADMIN">Admin</option>
              <option value="OWNER">Owner</option>
            </Select>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={addingAdmin}>
          Cancel
        </Button>
        <Button color="blue" onClick={onAddAdmin} disabled={addingAdmin || !selectedMemberId}>
          {addingAdmin ? 'Adding...' : 'Add Admin'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
