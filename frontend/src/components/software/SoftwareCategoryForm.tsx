import { FormEvent, useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field, Label } from '../ui/fieldset'
import type { SoftwareCategory } from '../../api/client'

interface SoftwareCategoryFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description?: string }) => Promise<void>
  category?: SoftwareCategory | null
  isLoading?: boolean
}

export function SoftwareCategoryForm({ open, onClose, onSubmit, category, isLoading }: SoftwareCategoryFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const isEditing = !!category

  useEffect(() => {
    if (category) {
      setName(category.name)
      setDescription(category.description || '')
    } else {
      setName('')
      setDescription('')
    }
    setError('')
  }, [category, open])

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
        description: description.trim() || undefined
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
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
                placeholder="e.g., Engineering, Marketing, Finance"
                required
              />
            </Field>

            <Field>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this category..."
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
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
