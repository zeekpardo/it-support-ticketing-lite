import { useState, useEffect } from 'react'
import { api, SoftwareCategory } from '../../../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from '@heroicons/react/24/outline'

export function CategoriesTab() {
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
