import { FormEvent, useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { Field, Label, Description } from '../ui/fieldset'
import type { Software, SoftwareCategory } from '../../api/client'

interface SoftwareFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SoftwareFormData) => Promise<void>
  software?: Software | null
  categories: SoftwareCategory[]
  isLoading?: boolean
}

export interface SoftwareFormData {
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  notes?: string
  categoryId?: string | null
}

export function SoftwareForm({ open, onClose, onSubmit, software, categories, isLoading }: SoftwareFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [vendor, setVendor] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')

  const isEditing = !!software

  useEffect(() => {
    if (software) {
      setName(software.name)
      setDescription(software.description || '')
      setIconUrl(software.iconUrl || '')
      setVendor(software.vendor || '')
      setWebsiteUrl(software.websiteUrl || '')
      setNotes(software.notes || '')
      setCategoryId(software.categoryId || '')
    } else {
      setName('')
      setDescription('')
      setIconUrl('')
      setVendor('')
      setWebsiteUrl('')
      setNotes('')
      setCategoryId('')
    }
    setError('')
  }, [software, open])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        vendor: vendor.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        categoryId: categoryId || null
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save software')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{isEditing ? 'Edit Software' : 'Add Software'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Field>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Microsoft Office"
                required
              />
            </Field>

            <Field>
              <Label>Vendor</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., Microsoft"
              />
            </Field>

            <Field>
              <Label>Category</Label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the software..."
                rows={3}
              />
            </Field>

            <Field>
              <Label>Icon URL</Label>
              <Description>URL to the software's icon or logo</Description>
              <Input
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/icon.png"
              />
            </Field>

            <Field>
              <Label>Website URL</Label>
              <Input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </Field>

            <Field>
              <Label>Notes</Label>
              <Description>Internal notes (not visible to clients)</Description>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="License information, setup instructions, etc."
                rows={3}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={onClose} type="button">
            Cancel
          </Button>
          <Button color="blue" type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Software'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
