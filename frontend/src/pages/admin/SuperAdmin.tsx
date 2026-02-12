import { useState, useEffect } from 'react'
import { admin } from '../../lib/auth-client'
import { api, GlobalSoftware, SoftwareCategory } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
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
  PencilIcon,
  TrashIcon,
  TagIcon,
  UsersIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'

// ==========================================
// Types
// ==========================================

interface Membership {
  id: string
  role: string
  organization: {
    id: string
    name: string
    slug: string
  }
  projectAssignments: Array<{
    project: {
      id: string
      name: string
      projectCode: string
    }
  }>
}

interface User {
  id: string
  name: string
  email: string
  role?: string
  banned?: boolean
  banReason?: string
  banExpires?: string
  createdAt: string
  members?: Membership[]
}

type TabType = 'users' | 'software' | 'categories'

// ==========================================
// Tab Button Component
// ==========================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

// ==========================================
// Users Tab Component
// ==========================================

function UsersTab() {
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
              <TableHeader>Organizations / Projects</TableHeader>
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
                          {membership.projectAssignments.length > 0 && (
                            <div className="ml-3 text-xs text-zinc-500">
                              {membership.projectAssignments.map(pa => pa.project.name).join(', ')}
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

// ==========================================
// Software Tab Component
// ==========================================

function SoftwareTab() {
  const [software, setSoftware] = useState<GlobalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    iconUrl: '',
    vendor: '',
    websiteUrl: '',
    categoryId: ''
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadSoftware()
  }, [offset, statusFilter, categoryFilter])

  const loadCategories = async () => {
    try {
      const result = await api.getSuperAdminCategories()
      setCategories(result)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadSoftware = async () => {
    setLoading(true)
    try {
      const result = await api.getSuperAdminSoftware({
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: searchValue || undefined,
        limit,
        offset
      })
      setSoftware(result.software || [])
      setTotal(result.total || 0)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    loadSoftware()
  }

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: '',
      description: '',
      iconUrl: '',
      vendor: '',
      websiteUrl: '',
      categoryId: ''
    })
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (item: GlobalSoftware) => {
    setEditingId(item.id)
    setFormData({
      name: item.name,
      description: item.description || '',
      iconUrl: item.iconUrl || '',
      vendor: item.vendor || '',
      websiteUrl: item.websiteUrl || '',
      categoryId: item.categoryId || ''
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        iconUrl: formData.iconUrl || undefined,
        vendor: formData.vendor || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        categoryId: formData.categoryId || undefined
      }

      if (editingId) {
        await api.updateSuperAdminSoftware(editingId, data)
      } else {
        await api.createSuperAdminSoftware(data)
      }

      setShowModal(false)
      loadSoftware()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save software')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (id: string) => {
    setDeletingId(id)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)

    try {
      await api.deleteSuperAdminSoftware(deletingId)
      setShowDeleteModal(false)
      setDeletingId(null)
      loadSoftware()
    } catch (error) {
      console.error('Failed to delete software:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await api.approveSoftware(id)
      loadSoftware()
    } catch (error) {
      console.error('Failed to approve software:', error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.rejectSoftware(id)
      loadSoftware()
    } catch (error) {
      console.error('Failed to reject software:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge color="green">Approved</Badge>
      case 'PENDING':
        return <Badge color="amber">Pending</Badge>
      case 'REJECTED':
        return <Badge color="red">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  if (loading && software.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">Manage the global software catalog available to all projects</Text>
        <Button color="blue" onClick={openCreateModal}>
          <PlusIcon className="h-4 w-4" />
          Add Software
        </Button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search software..."
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setOffset(0)
          }}
          className="w-40"
        >
          <option value="">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setOffset(0)
          }}
          className="w-48"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </Select>
        <Button type="submit" outline>
          <MagnifyingGlassIcon className="h-4 w-4" />
          Search
        </Button>
        <Button
          type="button"
          outline
          onClick={() => {
            setSearchValue('')
            setStatusFilter('')
            setCategoryFilter('')
            setOffset(0)
            loadSoftware()
          }}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Reset
        </Button>
      </form>

      {/* Software Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Software</TableHeader>
              <TableHeader>Vendor</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Projects</TableHeader>
              <TableHeader className="w-[180px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {software.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-700" />
                    )}
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-zinc-500 truncate max-w-xs">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500">{item.vendor || '-'}</TableCell>
                <TableCell>
                  {item.category ? (
                    <Badge color="zinc">{item.category.name}</Badge>
                  ) : (
                    <span className="text-zinc-400">Uncategorized</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className="text-zinc-500">
                  {item._count?.projectSoftware || 0}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {item.status === 'PENDING' && (
                      <>
                        <Button
                          color="green"
                          className="px-2 py-1 text-xs"
                          onClick={() => handleApprove(item.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          color="red"
                          className="px-2 py-1 text-xs"
                          onClick={() => handleReject(item.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Button plain onClick={() => openEditModal(item)}>
                      <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                    <Button plain onClick={() => openDeleteModal(item.id)}>
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {software.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                  No software found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} items
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

      {/* Create/Edit Modal */}
      {showModal && (
        <Dialog open={true} onClose={() => setShowModal(false)} size="lg">
          <DialogTitle>{editingId ? 'Edit Software' : 'Add Software'}</DialogTitle>
          <DialogDescription>
            {editingId ? 'Update software details' : 'Add new software to the global catalog'}
          </DialogDescription>

          <form onSubmit={handleSubmit}>
            <DialogBody>
              {formError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {formError}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Microsoft Office"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the software..."
                    rows={3}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Vendor</Label>
                    <Input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="Microsoft"
                    />
                  </Field>

                  <Field>
                    <Label>Category</Label>
                    <Select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field>
                  <Label>Icon URL</Label>
                  <Input
                    type="url"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                    placeholder="https://example.com/icon.png"
                  />
                </Field>

                <Field>
                  <Label>Website URL</Label>
                  <Input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://www.microsoft.com/office"
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Software'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Dialog open={true} onClose={() => setShowDeleteModal(false)} size="sm">
          <DialogTitle>Delete Software</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this software? This will also remove it from all projects that have added it.
          </DialogDescription>

          <DialogActions>
            <Button plain onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}

// ==========================================
// Categories Tab Component
// ==========================================

function CategoriesTab() {
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [loading, setLoading] = useState(true)

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const result = await api.getSuperAdminCategories()
      setCategories(result)
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({ name: '', description: '' })
    setFormError('')
    setShowModal(true)
  }

  const openEditModal = (cat: SoftwareCategory) => {
    setEditingId(cat.id)
    setFormData({ name: cat.name, description: cat.description || '' })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)

    try {
      if (editingId) {
        await api.updateSuperAdminCategory(editingId, formData)
      } else {
        await api.createSuperAdminCategory(formData)
      }

      setShowModal(false)
      loadCategories()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (id: string) => {
    setDeletingId(id)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)

    try {
      await api.deleteSuperAdminCategory(deletingId)
      setShowDeleteModal(false)
      setDeletingId(null)
      loadCategories()
    } catch (error) {
      console.error('Failed to delete category:', error)
    } finally {
      setDeleting(false)
    }
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">Manage software categories for the global catalog</Text>
        <Button color="blue" onClick={openCreateModal}>
          <PlusIcon className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Categories Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Software Count</TableHeader>
              <TableHeader className="w-[120px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-zinc-500">{cat.description || '-'}</TableCell>
                <TableCell className="text-zinc-500">{cat._count?.software || 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button plain onClick={() => openEditModal(cat)}>
                      <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                    <Button plain onClick={() => openDeleteModal(cat.id)}>
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                  No categories found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Dialog open={true} onClose={() => setShowModal(false)} size="md">
          <DialogTitle>{editingId ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {editingId ? 'Update category details' : 'Add a new software category'}
          </DialogDescription>

          <form onSubmit={handleSubmit}>
            <DialogBody>
              {formError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {formError}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Productivity"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Software for improving productivity..."
                    rows={3}
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Category'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Dialog open={true} onClose={() => setShowDeleteModal(false)} size="sm">
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this category? Software items in this category will become uncategorized.
          </DialogDescription>

          <DialogActions>
            <Button plain onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}

// ==========================================
// Main Component
// ==========================================

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('users')

  return (
    <div className="space-y-6">
      <Heading>Super Admin</Heading>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-2">
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
            <UsersIcon className="h-4 w-4" />
            Users
          </TabButton>
          <TabButton active={activeTab === 'software'} onClick={() => setActiveTab('software')}>
            <Square3Stack3DIcon className="h-4 w-4" />
            Software Catalog
          </TabButton>
          <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>
            <TagIcon className="h-4 w-4" />
            Categories
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'software' && <SoftwareTab />}
      {activeTab === 'categories' && <CategoriesTab />}
    </div>
  )
}
