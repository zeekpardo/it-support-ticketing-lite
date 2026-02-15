import { useState, useEffect, useCallback } from 'react'
import { api, type GlobalSoftware, type ProjectSoftware, type SoftwareCategory, type SoftwareBudgetSummary } from '../api/client'

export function getDaysUntilRenewal(renewalDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const renewal = new Date(renewalDate)
  renewal.setHours(0, 0, 0, 0)
  return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function useProjectSoftwareCatalog(projectId: string | undefined) {
  const [project, setProject] = useState<{ id: string; name: string; projectCode: string } | null>(null)
  const [categories, setCategories] = useState<SoftwareCategory[]>([])

  // Project software
  const [projectSoftware, setProjectSoftware] = useState<ProjectSoftware[]>([])
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectSoftwareIds, setProjectSoftwareIds] = useState<Set<string>>(new Set())

  // Global catalog
  const [globalSoftware, setGlobalSoftware] = useState<GlobalSoftware[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Budget
  const [budgetData, setBudgetData] = useState<SoftwareBudgetSummary | null>(null)
  const [loadingBudget, setLoadingBudget] = useState(false)

  const loadProject = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await api.getProject(projectId)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }, [projectId])

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getGlobalCatalogCategories()
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }, [])

  const loadProjectSoftware = useCallback(async () => {
    if (!projectId) return
    setLoadingProject(true)
    try {
      const data = await api.getProjectSoftware(projectId)
      setProjectSoftware(data)
      setProjectSoftwareIds(new Set(data.map(ps => ps.softwareId)))
    } catch (error) {
      console.error('Failed to load project software:', error)
    } finally {
      setLoadingProject(false)
    }
  }, [projectId])

  const loadGlobalCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      const data = await api.getGlobalCatalog({
        categoryId: categoryFilter || undefined,
        search: searchQuery || undefined,
      })
      setGlobalSoftware(data)
    } catch (error) {
      console.error('Failed to load global catalog:', error)
    } finally {
      setLoadingCatalog(false)
    }
  }, [categoryFilter, searchQuery])

  const loadBudget = useCallback(async () => {
    if (!projectId) return
    setLoadingBudget(true)
    try {
      const data = await api.getProjectSoftwareBudget(projectId)
      setBudgetData(data)
    } catch (error) {
      console.error('Failed to load budget:', error)
    } finally {
      setLoadingBudget(false)
    }
  }, [projectId])

  const addToProject = useCallback(async (softwareId: string, notes?: string) => {
    if (!projectId) return
    await api.addSoftwareToProject(projectId, softwareId, notes)
    setProjectSoftwareIds(prev => new Set([...prev, softwareId]))
    loadProjectSoftware()
  }, [projectId, loadProjectSoftware])

  useEffect(() => {
    if (projectId) {
      loadProject()
      loadProjectSoftware()
      loadCategories()
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    project,
    categories,
    projectSoftware,
    loadingProject,
    projectSoftwareIds,
    globalSoftware,
    loadingCatalog,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    loadGlobalCatalog,
    budgetData,
    loadingBudget,
    loadBudget,
    addToProject,
  }
}
