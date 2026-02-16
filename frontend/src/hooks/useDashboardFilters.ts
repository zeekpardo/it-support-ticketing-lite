import { useState } from 'react'

export function useDashboardFilters() {
  const [filterInbox, setFilterInbox] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const hasActiveFilters = !!(filterInbox || filterAssignee || filterPriority)

  const clearFilters = () => {
    setFilterInbox('')
    setFilterAssignee('')
    setFilterPriority('')
  }

  const filterParams = {
    inboxId: filterInbox || undefined,
    ownerId: filterAssignee || undefined,
    priorityLevel: filterPriority || undefined,
  }

  return {
    filterInbox,
    setFilterInbox,
    filterAssignee,
    setFilterAssignee,
    filterPriority,
    setFilterPriority,
    hasActiveFilters,
    clearFilters,
    filterParams,
  }
}
