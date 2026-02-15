import { useState, useCallback } from 'react'

interface UseCrudFormOptions<TFormData> {
  /** Initial/default values for the form fields */
  initialData: TFormData
}

interface UseCrudFormReturn<TFormData> {
  /** Current form data */
  data: TFormData
  /** Replace entire form data */
  setData: React.Dispatch<React.SetStateAction<TFormData>>
  /** Update a single field by key */
  setField: <K extends keyof TFormData>(name: K, value: TFormData[K]) => void
  /** Reset form to initial data */
  reset: () => void

  /** Whether a submit is in progress */
  saving: boolean
  /** Current error message (empty string if none) */
  error: string
  /** Set error manually */
  setError: (error: string) => void

  /**
   * Wraps an async submit function with saving/error lifecycle.
   * Sets saving=true, clears error, runs fn, catches errors, sets saving=false.
   */
  handleSubmit: (fn: () => Promise<void>) => Promise<void>
}

/**
 * Reusable hook for page-level CRUD form state management.
 *
 * Encapsulates the common pattern of:
 * - Form data with `setField` helper
 * - `saving` boolean for submit loading state
 * - `error` string for inline error display
 * - `handleSubmit` wrapper for async operations
 *
 * @example
 * ```ts
 * const form = useCrudForm({
 *   initialData: { name: '', cost: '', renewalDate: '' },
 * })
 *
 * // Update fields
 * form.setField('name', 'New Name')
 *
 * // Submit
 * const onSave = () => form.handleSubmit(async () => {
 *   await api.update(id, form.data)
 * })
 * ```
 */
export function useCrudForm<TFormData>(
  options: UseCrudFormOptions<TFormData>
): UseCrudFormReturn<TFormData> {
  const { initialData } = options

  const [data, setData] = useState<TFormData>(initialData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = useCallback(<K extends keyof TFormData>(name: K, value: TFormData[K]) => {
    setData(prev => ({ ...prev, [name]: value }))
  }, [])

  const reset = useCallback(() => {
    setData(initialData)
    setError('')
  }, [initialData])

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
    data,
    setData,
    setField,
    reset,
    saving,
    error,
    setError,
    handleSubmit,
  }
}
