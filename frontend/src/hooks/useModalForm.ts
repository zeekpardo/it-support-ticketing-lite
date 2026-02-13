import { useState, useCallback } from 'react'

interface UseModalFormOptions<TFormData, TEditItem = undefined> {
  /** Initial/default values for the form fields */
  initialData: TFormData
  /** Optional transform to populate form data when opening in edit mode */
  mapEditItem?: (item: TEditItem) => TFormData
}

interface UseModalFormReturn<TFormData, TEditItem = undefined> {
  // Modal visibility
  isOpen: boolean
  open: TEditItem extends undefined ? (editItem?: undefined) => void : (editItem?: TEditItem) => void
  close: () => void

  // Form data
  formData: TFormData
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>
  setField: <K extends keyof TFormData>(name: K, value: TFormData[K]) => void

  // Edit mode
  editingItem: TEditItem | null
  isEditing: boolean

  // Error handling
  error: string
  setError: (error: string) => void
  clearError: () => void

  // Submit lifecycle
  saving: boolean
  handleSubmit: (fn: () => Promise<void>) => Promise<void>
}

/**
 * Reusable hook for modal + form state management.
 *
 * Encapsulates the common pattern of:
 * - Modal open/close with form state reset
 * - Edit vs create mode via `editingItem`
 * - Form data with `setField` helper
 * - Error state management
 * - Async submit with `saving` flag
 *
 * @example
 * ```ts
 * const modal = useModalForm({
 *   initialData: { name: '', description: '' },
 *   mapEditItem: (item: Category) => ({ name: item.name, description: item.description || '' })
 * })
 *
 * // Open for create
 * modal.open()
 *
 * // Open for edit
 * modal.open(existingCategory)
 *
 * // In form inputs
 * <Input value={modal.formData.name} onChange={(e) => modal.setField('name', e.target.value)} />
 *
 * // On submit
 * const onSubmit = (e: React.FormEvent) => {
 *   e.preventDefault()
 *   modal.handleSubmit(async () => {
 *     if (modal.isEditing) {
 *       await api.update(modal.editingItem!.id, modal.formData)
 *     } else {
 *       await api.create(modal.formData)
 *     }
 *   })
 * }
 * ```
 */
export function useModalForm<TFormData, TEditItem = undefined>(
  options: UseModalFormOptions<TFormData, TEditItem>
): UseModalFormReturn<TFormData, TEditItem> {
  const { initialData, mapEditItem } = options

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<TFormData>(initialData)
  const [editingItem, setEditingItem] = useState<TEditItem | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const open = useCallback((editItem?: TEditItem) => {
    if (editItem !== undefined && editItem !== null) {
      setEditingItem(editItem)
      if (mapEditItem) {
        setFormData(mapEditItem(editItem))
      }
    } else {
      setEditingItem(null)
      setFormData(initialData)
    }
    setError('')
    setIsOpen(true)
  }, [initialData, mapEditItem])

  const close = useCallback(() => {
    setIsOpen(false)
    setEditingItem(null)
    setFormData(initialData)
    setError('')
    setSaving(false)
  }, [initialData])

  const setField = useCallback(<K extends keyof TFormData>(name: K, value: TFormData[K]) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  const clearError = useCallback(() => {
    setError('')
  }, [])

  const handleSubmit = useCallback(async (fn: () => Promise<void>) => {
    setError('')
    setSaving(true)

    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    isOpen,
    open: open as UseModalFormReturn<TFormData, TEditItem>['open'],
    close,
    formData,
    setFormData,
    setField,
    editingItem,
    isEditing: editingItem !== null,
    error,
    setError,
    clearError,
    saving,
    handleSubmit,
  }
}
