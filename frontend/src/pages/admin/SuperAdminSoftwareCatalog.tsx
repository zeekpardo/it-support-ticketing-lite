import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

export default function SuperAdminSoftwareCatalog() {
  const navigate = useNavigate()
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
    notes: '',
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
      notes: '',
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
      notes: item.notes || '',
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
        notes: formData.notes || undefined,
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
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Global Software Catalog</Heading>
          <Text className="mt-1">Manage the global software catalog available to all organizations</Text>
        </div>
        <div className="flex gap-2">
          <Button outline onClick={() => navigate('/super-admin/software/categories')}>
            <TagIcon className="h-4 w-4" />
            Categories
          </Button>
          <Button outline onClick={() => navigate('/super-admin/software/pending')}>
            <ClockIcon className="h-4 w-4" />
            Pending
          </Button>
          <Button color="blue" onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4" />
            Add Software
          </Button>
        </div>
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
              <TableHeader>Organizations</TableHeader>
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
                  {item._count?.organizationSoftware || 0}
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

                <Field>
                  <Label>Internal Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notes for super-admins..."
                    rows={2}
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
            Are you sure you want to delete this software? This will also remove it from all organizations that have added it.
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
