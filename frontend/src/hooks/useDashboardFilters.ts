import { useState } from 'react'

export function useDashboardFilters() {
  const [filterProject, setFilterProject] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const hasActiveFilters = !!(filterProject || filterAssignee || filterPriority)

  const clearFilters = () => {
    setFilterProject('')
    setFilterAssignee('')
    setFilterPriority('')
  }

  const filterParams = {
    projectId: filterProject || undefined,
    ownerId: filterAssignee || undefined,
    priorityLevel: filterPriority || undefined,
  }

  return {
    filterProject,
    setFilterProject,
    filterAssignee,
    setFilterAssignee,
    filterPriority,
    setFilterPriority,
    hasActiveFilters,
    clearFilters,
    filterParams,
  }
}
