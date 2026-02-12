import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, GlobalSoftware, ProjectSoftware, SoftwareCategory, SoftwareBudgetSummary } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
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
  ComputerDesktopIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ArrowLeftIcon,
  GlobeAltIcon,
  FolderIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

type TabType = 'project' | 'catalog' | 'budget'

export default function ProjectSoftwareCatalog() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('project')
  const [project, setProject] = useState<{ id: string; name: string; projectCode: string } | null>(null)

  // Global catalog state
  const [globalSoftware, setGlobalSoftware] = useState<GlobalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Project software state
  const [projectSoftware, setProjectSoftware] = useState<ProjectSoftware[]>([])
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectSoftwareIds, setProjectSoftwareIds] = useState<Set<string>>(new Set())

  // Add to project modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSoftware, setSelectedSoftware] = useState<GlobalSoftware | null>(null)
  const [addNotes, setAddNotes] = useState('')
  const [adding, setAdding] = useState(false)

  // Budget state
  const [budgetData, setBudgetData] = useState<SoftwareBudgetSummary | null>(null)
  const [loadingBudget, setLoadingBudget] = useState(false)

  // Submit new software modal
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitForm, setSubmitForm] = useState({
    name: '',
    description: '',
    iconUrl: '',
    vendor: '',
    websiteUrl: '',
    categoryId: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (projectId) {
      loadProject()
      loadProjectSoftware()
      loadCategories()
    }
  }, [projectId])

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadGlobalCatalog()
    }
    if (activeTab === 'budget') {
      loadBudget()
    }
  }, [activeTab, categoryFilter])

  const loadProject = async () => {
    if (!projectId) return
    try {
      const data = await api.getProject(projectId)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await api.getGlobalCatalogCategories()
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadGlobalCatalog = async () => {
    setLoadingCatalog(true)
    try {
      const data = await api.getGlobalCatalog({
        categoryId: categoryFilter || undefined,
        search: searchQuery || undefined
      })
      setGlobalSoftware(data)
    } catch (error) {
      console.error('Failed to load global catalog:', error)
    } finally {
      setLoadingCatalog(false)
    }
  }

  const loadProjectSoftware = async () => {
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
  }

  const loadBudget = async () => {
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
  }

  const getDaysUntilRenewal = (renewalDate: string) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const renewal = new Date(renewalDate)
    renewal.setHours(0, 0, 0, 0)
    return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadGlobalCatalog()
  }

  const openAddModal = (software: GlobalSoftware) => {
    setSelectedSoftware(software)
    setAddNotes('')
    setShowAddModal(true)
  }

  const handleAddToProject = async () => {
    if (!selectedSoftware || !projectId) return
    setAdding(true)

    try {
      await api.addSoftwareToProject(projectId, selectedSoftware.id, addNotes || undefined)
      setShowAddModal(false)
      setSelectedSoftware(null)
      loadProjectSoftware()
      // Update the set of added software IDs
      setProjectSoftwareIds(prev => new Set([...prev, selectedSoftware.id]))
    } catch (error) {
      console.error('Failed to add software to project:', error)
    } finally {
      setAdding(false)
    }
  }

  const openSubmitModal = () => {
    setSubmitForm({
      name: '',
      description: '',
      iconUrl: '',
      vendor: '',
      websiteUrl: '',
      categoryId: ''
    })
    setSubmitError('')
    setShowSubmitModal(true)
  }

  const handleSubmitSoftware = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')

    try {
      await api.submitNewSoftware({
        name: submitForm.name,
        description: submitForm.description || undefined,
        iconUrl: submitForm.iconUrl || undefined,
        vendor: submitForm.vendor || undefined,
        websiteUrl: submitForm.websiteUrl || undefined,
        categoryId: submitForm.categoryId || undefined
      })
      setShowSubmitModal(false)
      // Show success message or notification
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit software')
    } finally {
      setSubmitting(false)
    }
  }

  const TabButton = ({ tab, label, icon: Icon }: { tab: TabType; label: string; icon: React.ElementType }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === tab
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  if (loadingProject && projectSoftware.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button plain onClick={() => navigate(`/admin/projects/${projectId}`)}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <Heading>Software Catalog</Heading>
          <Text className="mt-1 text-zinc-500">
            {project?.name || 'Project'} - {project?.projectCode}
          </Text>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-2">
          <TabButton tab="project" label="Project Software" icon={FolderIcon} />
          <TabButton tab="catalog" label="Browse Global Catalog" icon={GlobeAltIcon} />
          <TabButton tab="budget" label="Budget Overview" icon={CurrencyDollarIcon} />
        </nav>
      </div>

      {/* Project Software Tab */}
      {activeTab === 'project' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Text className="text-zinc-500">
              Software added to this project ({projectSoftware.length})
            </Text>
            <Button color="blue" onClick={() => setActiveTab('catalog')}>
              <PlusIcon className="h-4 w-4" />
              Add Software
            </Button>
          </div>

          {projectSoftware.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
              <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
              <Text className="mt-4 text-zinc-500">No software added to this project yet</Text>
              <Button className="mt-4" outline onClick={() => setActiveTab('catalog')}>
                Browse Global Catalog
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projectSoftware.map((ps) => (
                <div
                  key={ps.id}
                  className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer"
                  onClick={() => navigate(`/admin/projects/${projectId}/software/${ps.id}`)}
                >
                  <div className="flex items-start gap-3">
                    {ps.software.iconUrl ? (
                      <img
                        src={ps.software.iconUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                        <ComputerDesktopIcon className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-white truncate">
                        {ps.software.name}
                      </div>
                      {ps.software.vendor && (
                        <div className="text-sm text-zinc-500 truncate">{ps.software.vendor}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ps.software.category && (
                      <Badge color="zinc">{ps.software.category.name}</Badge>
                    )}
                    {ps.cost && (
                      <Badge color="blue">
                        ${parseFloat(ps.cost).toFixed(0)}{ps.billingCycle === 'MONTHLY' ? '/mo' : '/yr'}
                      </Badge>
                    )}
                    {ps.renewalDate && (() => {
                      const days = getDaysUntilRenewal(ps.renewalDate)
                      if (days < 0) return <Badge color="zinc">Expired</Badge>
                      if (days <= 7) return <Badge color="red">Renews in {days}d</Badge>
                      if (days <= 30) return <Badge color="amber">Renews in {days}d</Badge>
                      return null
                    })()}
                    {ps.totalSeats != null && (
                      <Badge color={((ps._count?.accessRequests || 0) >= ps.totalSeats) ? 'red' : 'zinc'}>
                        {ps._count?.accessRequests || 0}/{ps.totalSeats} seats
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                    <span>{ps._count?.admins || 0} admins</span>
                    <span>{ps._count?.accessRequests || 0} requests</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Text className="text-zinc-500">
              Browse and add software from the global catalog
            </Text>
            <Button outline onClick={openSubmitModal}>
              <PlusIcon className="h-4 w-4" />
              Submit New Software
            </Button>
          </div>

          {/* Filters */}
          <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search software..."
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-48"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
            <Button type="submit" outline>
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search
            </Button>
          </form>

          {/* Software Grid */}
          {loadingCatalog ? (
            <div className="flex h-64 items-center justify-center">
              <Text>Loading...</Text>
            </div>
          ) : globalSoftware.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
              <Text className="text-zinc-500">No software found matching your criteria</Text>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {globalSoftware.map((software) => {
                const isAdded = projectSoftwareIds.has(software.id)
                return (
                  <div
                    key={software.id}
                    className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="flex items-start gap-3">
                      {software.iconUrl ? (
                        <img
                          src={software.iconUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                          <ComputerDesktopIcon className="h-5 w-5 text-zinc-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-white truncate">
                          {software.name}
                        </div>
                        {software.vendor && (
                          <div className="text-sm text-zinc-500 truncate">{software.vendor}</div>
                        )}
                      </div>
                    </div>
                    {software.description && (
                      <p className="mt-2 text-sm text-zinc-500 line-clamp-2">{software.description}</p>
                    )}
                    {software.category && (
                      <div className="mt-3">
                        <Badge color="zinc">{software.category.name}</Badge>
                      </div>
                    )}
                    <div className="mt-4">
                      {isAdded ? (
                        <Button disabled className="w-full">
                          <CheckIcon className="h-4 w-4" />
                          Added to Project
                        </Button>
                      ) : (
                        <Button color="blue" className="w-full" onClick={() => openAddModal(software)}>
                          <PlusIcon className="h-4 w-4" />
                          Add to Project
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Budget Tab */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {loadingBudget ? (
            <div className="flex h-64 items-center justify-center">
              <Text>Loading budget data...</Text>
            </div>
          ) : !budgetData || budgetData.softwareCount === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
              <CurrencyDollarIcon className="mx-auto h-12 w-12 text-zinc-400" />
              <Text className="mt-4 text-zinc-500">No cost data available. Add cost information to your software to see the budget overview.</Text>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                  <Text className="text-sm text-zinc-500">Monthly Spend</Text>
                  <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                    ${budgetData.totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                  <Text className="text-sm text-zinc-500">Yearly Spend</Text>
                  <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                    ${budgetData.totalYearly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                  <Text className="text-sm text-zinc-500">Software with Costs</Text>
                  <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                    {budgetData.softwareCount}
                  </div>
                </div>
              </div>

              {/* Upcoming Renewals Alert */}
              {(() => {
                const upcoming = budgetData.breakdown.filter(
                  sw => sw.renewalDate && getDaysUntilRenewal(sw.renewalDate) >= 0 && getDaysUntilRenewal(sw.renewalDate) <= 30
                )
                if (upcoming.length === 0) return null
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarDaysIcon className="h-5 w-5 text-amber-600" />
                      <Text className="font-medium text-amber-800 dark:text-amber-300">
                        {upcoming.length} software renewal{upcoming.length > 1 ? 's' : ''} within 30 days
                      </Text>
                    </div>
                    <div className="space-y-1">
                      {upcoming.map(sw => {
                        const days = getDaysUntilRenewal(sw.renewalDate!)
                        return (
                          <Text key={sw.id} className="text-sm text-amber-700 dark:text-amber-400">
                            {sw.name} - renews in {days} day{days !== 1 ? 's' : ''} (${sw.yearly.toFixed(2)}/yr)
                          </Text>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Cost Breakdown Table */}
              <div>
                <Subheading className="mb-4">Cost Breakdown</Subheading>
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Software</TableHeader>
                        <TableHeader>Cost</TableHeader>
                        <TableHeader>Type</TableHeader>
                        <TableHeader>Users</TableHeader>
                        <TableHeader>Monthly</TableHeader>
                        <TableHeader>Yearly</TableHeader>
                        <TableHeader>Renewal</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {budgetData.breakdown
                        .sort((a, b) => b.yearly - a.yearly)
                        .map((sw) => (
                          <TableRow key={sw.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {sw.iconUrl ? (
                                  <img src={sw.iconUrl} alt="" className="h-6 w-6 rounded object-cover" />
                                ) : (
                                  <ComputerDesktopIcon className="h-6 w-6 text-zinc-400" />
                                )}
                                <span className="font-medium">{sw.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              ${sw.cost.toFixed(2)}{sw.billingCycle === 'MONTHLY' ? '/mo' : '/yr'}
                            </TableCell>
                            <TableCell>
                              {sw.costType === 'PER_USER' ? (
                                <Badge color="blue">Per User</Badge>
                              ) : sw.costType === 'PER_ORGANIZATION' ? (
                                <Badge color="zinc">Per Org</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{sw.users}</TableCell>
                            <TableCell className="font-medium">
                              ${sw.monthly.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-medium">
                              ${sw.yearly.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {sw.renewalDate ? (
                                <div className="flex items-center gap-1.5">
                                  <Text className="text-sm">
                                    {new Date(sw.renewalDate).toLocaleDateString()}
                                  </Text>
                                  {sw.autoRenewal && (
                                    <Badge color="green" className="text-[10px]">Auto</Badge>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add to Project Modal */}
      {showAddModal && selectedSoftware && (
        <Dialog open={true} onClose={() => setShowAddModal(false)} size="md">
          <DialogTitle>Add Software to Project</DialogTitle>
          <DialogDescription>
            Add "{selectedSoftware.name}" to this project's software catalog
          </DialogDescription>

          <DialogBody>
            <Field>
              <Label>Notes (optional)</Label>
              <Textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Add project-specific notes or setup instructions..."
                rows={4}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowAddModal(false)} disabled={adding}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleAddToProject} disabled={adding}>
              {adding ? 'Adding...' : 'Add to Project'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Submit New Software Modal */}
      {showSubmitModal && (
        <Dialog open={true} onClose={() => setShowSubmitModal(false)} size="lg">
          <DialogTitle>Submit New Software</DialogTitle>
          <DialogDescription>
            Submit a new software to be added to the global catalog. It will be reviewed by an admin before becoming available.
          </DialogDescription>

          <form onSubmit={handleSubmitSoftware}>
            <DialogBody>
              {submitError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {submitError}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={submitForm.name}
                    onChange={(e) => setSubmitForm({ ...submitForm, name: e.target.value })}
                    placeholder="Software name"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={submitForm.description}
                    onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Vendor</Label>
                    <Input
                      type="text"
                      value={submitForm.vendor}
                      onChange={(e) => setSubmitForm({ ...submitForm, vendor: e.target.value })}
                      placeholder="Company name"
                    />
                  </Field>

                  <Field>
                    <Label>Category</Label>
                    <Select
                      value={submitForm.categoryId}
                      onChange={(e) => setSubmitForm({ ...submitForm, categoryId: e.target.value })}
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field>
                  <Label>Icon URL</Label>
                  <Input
                    type="url"
                    value={submitForm.iconUrl}
                    onChange={(e) => setSubmitForm({ ...submitForm, iconUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </Field>

                <Field>
                  <Label>Website URL</Label>
                  <Input
                    type="url"
                    value={submitForm.websiteUrl}
                    onChange={(e) => setSubmitForm({ ...submitForm, websiteUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  )
}
