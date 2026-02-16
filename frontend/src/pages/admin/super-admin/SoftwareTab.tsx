import { useState, useEffect } from 'react'
import { api, GlobalSoftware, SoftwareCategory } from '../../../api/client'
import { useModalForm } from '../../../hooks/useModalForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { FileUpload } from '@/components/ui/file-upload'
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
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

export function SoftwareTab() {
  const [software, setSoftware] = useState<GlobalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const modal = useModalForm<
    { name: string; description: string; iconUrl: string; vendor: string; websiteUrl: string; categoryId: string },
    GlobalSoftware
  >({
    initialData: { name: '', description: '', iconUrl: '', vendor: '', websiteUrl: '', categoryId: '' },
    mapEditItem: (item) => ({
      name: item.name,
      description: item.description || '',
      iconUrl: item.iconUrl || '',
      vendor: item.vendor || '',
      websiteUrl: item.websiteUrl || '',
      categoryId: item.categoryId || '',
    }),
  })

  // Icon file upload (managed outside useModalForm since it's not serializable form data)
  const [iconFile, setIconFile] = useState<File | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await modal.handleSubmit(async () => {
      const data = {
        name: modal.formData.name,
        description: modal.formData.description || undefined,
        iconUrl: iconFile ? undefined : (modal.formData.iconUrl || undefined),
        vendor: modal.formData.vendor || undefined,
        websiteUrl: modal.formData.websiteUrl || undefined,
        categoryId: modal.formData.categoryId || undefined,
      }

      let software
      if (modal.isEditing) {
        software = await api.updateSuperAdminSoftware(modal.editingItem!.id, data)
      } else {
        software = await api.createSuperAdminSoftware(data)
      }

      if (iconFile && software.id) {
        await api.uploadSoftwareIcon(software.id, iconFile)
      }

      setIconFile(null)
      modal.close()
      loadSoftware()
    })
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
        <Button color="blue" onClick={() => { setIconFile(null); modal.open() }}>
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
                  {item._count?.inboxSoftware || 0}
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
                    <Button plain onClick={() => { setIconFile(null); modal.open(item) }}>
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
      {modal.isOpen && (
        <Dialog open={true} onClose={modal.close} size="lg">
          <DialogTitle>{modal.isEditing ? 'Edit Software' : 'Add Software'}</DialogTitle>
          <DialogDescription>
            {modal.isEditing ? 'Update software details' : 'Add new software to the global catalog'}
          </DialogDescription>

          <form onSubmit={handleSubmit}>
            <DialogBody>
              {modal.error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {modal.error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={modal.formData.name}
                    onChange={(e) => modal.setField('name', e.target.value)}
                    placeholder="Microsoft Office"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={modal.formData.description}
                    onChange={(e) => modal.setField('description', e.target.value)}
                    placeholder="Brief description of the software..."
                    rows={3}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Vendor</Label>
                    <Input
                      type="text"
                      value={modal.formData.vendor}
                      onChange={(e) => modal.setField('vendor', e.target.value)}
                      placeholder="Microsoft"
                    />
                  </Field>

                  <Field>
                    <Label>Category</Label>
                    <Select
                      value={modal.formData.categoryId}
                      onChange={(e) => modal.setField('categoryId', e.target.value)}
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field>
                  <Label>Icon</Label>
                  <Description>Upload an icon image or paste a URL (max 512KB)</Description>
                  <div className="flex items-start gap-4">
                    {(modal.formData.iconUrl || iconFile) && (
                      <img
                        src={iconFile ? URL.createObjectURL(iconFile) : modal.formData.iconUrl}
                        alt="Icon preview"
                        className="h-12 w-12 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 shrink-0"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <FileUpload
                        accept="image/*"
                        compact
                        maxSizeMB={0.5}
                        label="Upload icon"
                        description="JPEG, PNG, GIF, WebP, or SVG"
                        onFilesSelected={(files) => {
                          setIconFile(files[0])
                          modal.setField('iconUrl', '')
                        }}
                      />
                      <div className="text-center text-xs text-zinc-400">or</div>
                      <Input
                        type="url"
                        value={iconFile ? '' : modal.formData.iconUrl}
                        onChange={(e) => {
                          setIconFile(null)
                          modal.setField('iconUrl', e.target.value)
                        }}
                        placeholder="https://example.com/icon.png"
                        disabled={!!iconFile}
                      />
                    </div>
                  </div>
                </Field>

                <Field>
                  <Label>Website URL</Label>
                  <Input
                    type="url"
                    value={modal.formData.websiteUrl}
                    onChange={(e) => modal.setField('websiteUrl', e.target.value)}
                    placeholder="https://www.microsoft.com/office"
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={modal.close} disabled={modal.saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={modal.saving}>
                {modal.saving ? 'Saving...' : modal.isEditing ? 'Update' : 'Add Software'}
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
