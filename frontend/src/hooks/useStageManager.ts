import { useState, useCallback } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { api, TicketStage } from '../api/client'

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export function useStageManager(inboxId: string | undefined) {
  const [stages, setStages] = useState<TicketStage[]>([])
  const [error, setError] = useState('')

  // New stage form
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('gray')

  // Delete modal
  const [stageToDelete, setStageToDelete] = useState<TicketStage | null>(null)
  const [moveTicketsToStageId, setMoveTicketsToStageId] = useState('')

  const loadStages = useCallback(async () => {
    if (!inboxId) return []
    const data = await api.getInboxStages(inboxId)
    const sorted = data.sort((a, b) => a.position - b.position)
    setStages(sorted)
    return sorted
  }, [inboxId])

  const handleAdd = useCallback(async () => {
    if (!newStageName.trim() || !inboxId) return
    setError('')

    try {
      const newStage = await api.createStage(inboxId, {
        name: newStageName.trim(),
        color: newStageColor,
      })
      setStages(prev => [...prev, newStage])
      setNewStageName('')
      setNewStageColor('gray')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create stage'))
    }
  }, [inboxId, newStageName, newStageColor])

  const handleUpdate = useCallback(async (stageId: string, data: { name?: string; color?: string }) => {
    if (!inboxId) return
    setError('')
    try {
      const updated = await api.updateStage(inboxId, stageId, data)
      setStages(prev => prev.map(s => s.id === stageId ? updated : s))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update stage'))
    }
  }, [inboxId])

  const handleSetDefault = useCallback(async (stageId: string) => {
    if (!inboxId) return
    setError('')
    try {
      await api.updateStage(inboxId, stageId, { isDefault: true })
      setStages(prev => prev.map(s => ({ ...s, isDefault: s.id === stageId })))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to set default stage'))
    }
  }, [inboxId])

  const handleToggleResolved = useCallback(async (stageId: string) => {
    if (!inboxId) return
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    setError('')

    try {
      const updated = await api.updateStage(inboxId, stageId, { isResolved: !stage.isResolved })
      setStages(prev => prev.map(s => s.id === stageId ? updated : s))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update stage'))
    }
  }, [inboxId, stages])

  const handleDelete = useCallback(async () => {
    if (!stageToDelete || !inboxId) return
    setError('')

    if (stageToDelete._count?.tickets && stageToDelete._count.tickets > 0 && !moveTicketsToStageId) {
      setError('Please select a stage to move tickets to')
      return
    }

    try {
      await api.deleteStage(inboxId, stageToDelete.id, moveTicketsToStageId)
      setStages(prev => prev.filter(s => s.id !== stageToDelete.id))
      setStageToDelete(null)
      setMoveTicketsToStageId('')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete stage'))
    }
  }, [inboxId, stageToDelete, moveTicketsToStageId])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!inboxId) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    setStages(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id)
      const newIndex = prev.findIndex(s => s.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)

      // Fire-and-forget save; revert on failure
      api.reorderStages(inboxId, reordered.map(s => s.id)).catch(err => {
        setStages(prev) // revert
        setError(getErrorMessage(err, 'Failed to reorder stages'))
      })

      return reordered
    })
  }, [inboxId])

  const dismissDelete = useCallback(() => {
    setStageToDelete(null)
    setMoveTicketsToStageId('')
  }, [])

  return {
    stages,
    setStages,
    error,
    loadStages,

    // Add form
    newStageName,
    setNewStageName,
    newStageColor,
    setNewStageColor,
    handleAdd,

    // CRUD
    handleUpdate,
    handleSetDefault,
    handleToggleResolved,
    handleDragEnd,

    // Delete modal
    stageToDelete,
    setStageToDelete,
    moveTicketsToStageId,
    setMoveTicketsToStageId,
    handleDelete,
    dismissDelete,
  }
}
