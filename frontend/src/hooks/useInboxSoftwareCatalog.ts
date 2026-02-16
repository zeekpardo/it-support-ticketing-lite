import { useState, useEffect, useCallback } from 'react'
import { api, type GlobalSoftware, type InboxSoftware, type SoftwareCategory, type SoftwareBudgetSummary } from '../api/client'

export function getDaysUntilRenewal(renewalDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const renewal = new Date(renewalDate)
  renewal.setHours(0, 0, 0, 0)
  return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function useInboxSoftwareCatalog(inboxId: string | undefined) {
  const [inbox, setInbox] = useState<{ id: string; name: string; inboxCode: string } | null>(null)
  const [categories, setCategories] = useState<SoftwareCategory[]>([])

  // Inbox software
  const [inboxSoftware, setInboxSoftware] = useState<InboxSoftware[]>([])
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [inboxSoftwareIds, setInboxSoftwareIds] = useState<Set<string>>(new Set())

  // Global catalog
  const [globalSoftware, setGlobalSoftware] = useState<GlobalSoftware[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Budget
  const [budgetData, setBudgetData] = useState<SoftwareBudgetSummary | null>(null)
  const [loadingBudget, setLoadingBudget] = useState(false)

  const loadInbox = useCallback(async () => {
    if (!inboxId) return
    try {
      const data = await api.getInbox(inboxId)
      setInbox(data)
    } catch (error) {
      console.error('Failed to load inbox:', error)
    }
  }, [inboxId])

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getGlobalCatalogCategories()
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }, [])

  const loadInboxSoftware = useCallback(async () => {
    if (!inboxId) return
    setLoadingInbox(true)
    try {
      const data = await api.getInboxSoftware(inboxId)
      setInboxSoftware(data)
      setInboxSoftwareIds(new Set(data.map(ps => ps.softwareId)))
    } catch (error) {
      console.error('Failed to load inbox software:', error)
    } finally {
      setLoadingInbox(false)
    }
  }, [inboxId])

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
    if (!inboxId) return
    setLoadingBudget(true)
    try {
      const data = await api.getInboxSoftwareBudget(inboxId)
      setBudgetData(data)
    } catch (error) {
      console.error('Failed to load budget:', error)
    } finally {
      setLoadingBudget(false)
    }
  }, [inboxId])

  const addToInbox = useCallback(async (softwareId: string, notes?: string) => {
    if (!inboxId) return
    await api.addSoftwareToInbox(inboxId, softwareId, notes)
    setInboxSoftwareIds(prev => new Set([...prev, softwareId]))
    loadInboxSoftware()
  }, [inboxId, loadInboxSoftware])

  useEffect(() => {
    if (inboxId) {
      loadInbox()
      loadInboxSoftware()
      loadCategories()
    }
  }, [inboxId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    inbox,
    categories,
    inboxSoftware,
    loadingInbox,
    inboxSoftwareIds,
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
    addToInbox,
  }
}
