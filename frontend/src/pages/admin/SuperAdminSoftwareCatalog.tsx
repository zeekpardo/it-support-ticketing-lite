import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, GlobalSoftware, SoftwareCategory } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { FileUpload } from '@/components/ui/file-upload'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import { SoftwareFilters } from '@/components/software/SoftwareFilters'
import { SoftwareTable } from '@/components/software/SoftwareTable'
import {
  PlusIcon,
  TagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const STATUS_OPTIONS = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
]

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

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({ name: '', description: '', iconUrl: '', vendor: '', websiteUrl: '', notes: '', categoryId: '' })
    setFormError('')
    setIconFile(null)
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
      notes: (item as any).notes || '',
      categoryId: item.categoryId || ''
    })
    setFormError('')
    setIconFile(null)
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
        iconUrl: iconFile ? undefined : (formData.iconUrl || undefined),
        vendor: formData.vendor || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        notes: formData.notes || undefined,
        categoryId: formData.categoryId || undefined
      }

      let software
      if (editingId) {
        software = await api.updateSuperAdminSoftware(editingId, data)
      } else {
        software = await api.createSuperAdminSoftware(data)
      }

      if (iconFile && software.id) {
        await api.uploadSoftwareIcon(software.id, iconFile)
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

      <SoftwareFilters
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSearch={handleSearch}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryChange={(v) => { setCategoryFilter(v); setOffset(0) }}
        statusFilter={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setOffset(0) }}
        statusOptions={STATUS_OPTIONS}
        onReset={() => {
          setSearchValue('')
          setStatusFilter('')
          setCategoryFilter('')
          setOffset(0)
          loadSoftware()
        }}
      />

      <SoftwareTable
        software={software}
        onEdit={openEditModal}
        onDelete={openDeleteModal}
        onApprove={handleApprove}
        onReject={handleReject}
        total={total}
        offset={offset}
        limit={limit}
        onOffsetChange={setOffset}
      />

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
                  <Label>Icon</Label>
                  <Description>Upload an icon image or paste a URL (max 512KB)</Description>
                  <div className="flex items-start gap-4">
                    {(formData.iconUrl || iconFile) && (
                      <img
                        src={iconFile ? URL.createObjectURL(iconFile) : formData.iconUrl}
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
                        description="JPEG, PNG, GIF, WebP, or SVG (max 512KB)"
                        onFilesSelected={(files) => {
                          setIconFile(files[0])
                          setFormData({ ...formData, iconUrl: '' })
                        }}
                      />
                      <div className="text-center text-xs text-zinc-400">or</div>
                      <Input
                        type="url"
                        value={iconFile ? '' : formData.iconUrl}
                        onChange={(e) => {
                          setIconFile(null)
                          setFormData({ ...formData, iconUrl: e.target.value })
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
