import { useState, useEffect } from 'react'
import { admin } from '../../../lib/auth-client'
import { api } from '../../../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import {
  PlusIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import type { User } from './types'

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Ban modal
  const [showBanModal, setShowBanModal] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDays, setBanDays] = useState('')
  const [banning, setBanning] = useState(false)

  // Impersonation
  const [impersonating, setImpersonating] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [offset])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await api.getSuperAdminUsers({
        limit,
        offset,
        search: searchValue || undefined
      })
      setUsers(result.users || [])
      setTotal(result.total || 0)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    loadUsers()
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)

    try {
      const result = await admin.createUser({
        email: createEmail,
        password: createPassword,
        name: createName,
        role: createRole,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to create user')
      }

      setShowCreateModal(false)
      setCreateEmail('')
      setCreatePassword('')
      setCreateName('')
      setCreateRole('user')
      loadUsers()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleBanUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanning(true)

    try {
      await admin.banUser({
        userId: banUserId,
        banReason: banReason || undefined,
        banExpiresIn: banDays ? parseInt(banDays) * 24 * 60 * 60 : undefined,
      })

      setShowBanModal(false)
      setBanUserId('')
      setBanReason('')
      setBanDays('')
      loadUsers()
    } catch (error) {
      console.error('Failed to ban user:', error)
    } finally {
      setBanning(false)
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      await admin.unbanUser({ userId })
      loadUsers()
    } catch (error) {
      console.error('Failed to unban user:', error)
    }
  }

  const handleSetRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      await admin.setRole({ userId, role })
      loadUsers()
    } catch (error) {
      console.error('Failed to set role:', error)
    }
  }

  const handleImpersonate = async (userId: string) => {
    try {
      setImpersonating(userId)
      await admin.impersonateUser({ userId })
      window.location.href = '/'
    } catch (error) {
      console.error('Failed to impersonate user:', error)
      setImpersonating(null)
    }
  }

  const openBanModal = (userId: string) => {
    setBanUserId(userId)
    setShowBanModal(true)
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  if (loading && users.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">Manage all users across the platform</Text>
        <Button color="blue" onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="flex-1">
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search by email..."
          />
        </div>
        <Button type="submit" outline>
          <MagnifyingGlassIcon className="h-4 w-4" />
          Search
        </Button>
        <Button
          type="button"
          outline
          onClick={() => {
            setSearchValue('')
            setOffset(0)
            loadUsers()
          }}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Reset
        </Button>
      </form>

      {/* Users Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Organizations / Inboxes</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader className="w-[200px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-zinc-500">{user.email}</TableCell>
                <TableCell>
                  {user.members && user.members.length > 0 ? (
                    <div className="space-y-1">
                      {user.members.map((membership) => (
                        <div key={membership.id} className="text-sm">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {membership.organization.name}
                          </span>
                          <span className="text-zinc-400 ml-1">({membership.role})</span>
                          {membership.inboxAssignments.length > 0 && (
                            <div className="ml-3 text-xs text-zinc-500">
                              {membership.inboxAssignments.map(ia => ia.inbox.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-sm">No organizations</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role || 'user'}
                    onChange={(e) => handleSetRole(user.id, e.target.value as 'user' | 'admin')}
                    className="w-24"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </Select>
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <Badge color="red">Banned</Badge>
                  ) : (
                    <Badge color="green">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {user.banned ? (
                      <Tooltip content="Unban user">
                        <Button
                          plain
                          onClick={() => handleUnbanUser(user.id)}
                        >
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Ban user">
                        <Button
                          plain
                          onClick={() => openBanModal(user.id)}
                        >
                          <NoSymbolIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Impersonate user">
                      <Button
                        plain
                        onClick={() => handleImpersonate(user.id)}
                        disabled={impersonating === user.id}
                      >
                        <UserIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} users
          </Text>
          <div className="flex gap-2">
            <Button
              outline
              disabled={currentPage === 1}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              outline
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <Dialog open={true} onClose={() => setShowCreateModal(false)} size="md">
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a new user account.
          </DialogDescription>

          <form onSubmit={handleCreateUser}>
            <DialogBody>
              {createError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {createError}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name</Label>
                  <Input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </Field>

                <Field>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </Field>

                <Field>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </Field>

                <Field>
                  <Label>Role</Label>
                  <Select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </Select>
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Ban User Modal */}
      {showBanModal && (
        <Dialog open={true} onClose={() => setShowBanModal(false)} size="md">
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            Ban this user from the platform. They will be signed out and unable to log in.
          </DialogDescription>

          <form onSubmit={handleBanUser}>
            <DialogBody>
              <FieldGroup>
                <Field>
                  <Label>Ban Reason (optional)</Label>
                  <Input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Violation of terms of service"
                  />
                </Field>

                <Field>
                  <Label>Ban Duration (days, leave empty for permanent)</Label>
                  <Input
                    type="number"
                    value={banDays}
                    onChange={(e) => setBanDays(e.target.value)}
                    placeholder="7"
                    min="1"
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowBanModal(false)} disabled={banning}>
                Cancel
              </Button>
              <Button color="red" type="submit" disabled={banning}>
                {banning ? 'Banning...' : 'Ban User'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  )
}
