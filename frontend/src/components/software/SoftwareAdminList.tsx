import { useState } from 'react'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '../ui/dialog'
import { Select } from '../ui/select'
import { Field, Label } from '../ui/fieldset'
import type { SoftwareAdmin } from '../../api/client'

interface SoftwareAdminListProps {
  admins: SoftwareAdmin[]
  onRemove: (adminId: string) => Promise<void>
  onUpdateRole: (adminId: string, role: 'OWNER' | 'ADMIN') => Promise<void>
  canManage: boolean
  isLoading?: boolean
}

export function SoftwareAdminList({ admins, onRemove, onUpdateRole, canManage, isLoading }: SoftwareAdminListProps) {
  const [editingAdmin, setEditingAdmin] = useState<SoftwareAdmin | null>(null)
  const [newRole, setNewRole] = useState<'OWNER' | 'ADMIN'>('ADMIN')

  const handleEditClick = (admin: SoftwareAdmin) => {
    setEditingAdmin(admin)
    setNewRole(admin.role)
  }

  const handleUpdateRole = async () => {
    if (!editingAdmin) return
    await onUpdateRole(editingAdmin.id, newRole)
    setEditingAdmin(null)
  }

  const handleRemove = async (admin: SoftwareAdmin) => {
    if (!confirm(`Remove ${admin.member.user.name} as an admin?`)) return
    await onRemove(admin.id)
  }

  if (admins.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No admins assigned yet.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              {admin.member.user.image ? (
                <img
                  src={admin.member.user.image}
                  alt={admin.member.user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-sm font-medium">
                  {admin.member.user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {admin.member.user.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {admin.member.user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge color={admin.role === 'OWNER' ? 'blue' : 'zinc'}>
                {admin.role}
              </Badge>
              {canManage && (
                <>
                  <Button plain onClick={() => handleEditClick(admin)} disabled={isLoading}>
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                  <Button plain onClick={() => handleRemove(admin)} disabled={isLoading}>
                    <TrashIcon className="w-4 h-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingAdmin} onClose={() => setEditingAdmin(null)}>
        <DialogTitle>Edit Admin Role</DialogTitle>
        <DialogBody>
          {editingAdmin && (
            <Field>
              <Label>Role for {editingAdmin.member.user.name}</Label>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'OWNER' | 'ADMIN')}
              >
                <option value="OWNER">Owner - Full control</option>
                <option value="ADMIN">Admin - Approve requests only</option>
              </Select>
            </Field>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setEditingAdmin(null)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleUpdateRole} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
