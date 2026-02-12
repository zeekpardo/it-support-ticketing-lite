import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type GlobalSoftwareWithStatus, type OrganizationSoftware, type SoftwareCategory } from '../../api/client'
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
  PlusIcon,
  ComputerDesktopIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  BuildingOfficeIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'

type TabType = 'catalog' | 'organization'

export default function AdminSoftwareCatalog() {
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('organization')

  // Global catalog state
  const [globalSoftware, setGlobalSoftware] = useState<GlobalSoftwareWithStatus[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Organization software state
  const [orgSoftware, setOrgSoftware] = useState<OrganizationSoftware[]>([])
  const [loadingOrg, setLoadingOrg] = useState(true)

  // Add to org modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSoftware, setSelectedSoftware] = useState<GlobalSoftwareWithStatus | null>(null)
  const [addNotes, setAddNotes] = useState('')
  const [adding, setAdding] = useState(false)

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
    if (currentOrg) {
      loadOrgSoftware()
      loadCategories()
    }
  }, [currentOrg])

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadGlobalCatalog()
    }
  }, [activeTab, categoryFilter])

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

  const loadOrgSoftware = async () => {
    setLoadingOrg(true)
    try {
      const data = await api.getOrganizationSoftware()
      setOrgSoftware(data)
    } catch (error) {
      console.error('Failed to load organization software:', error)
    } finally {
      setLoadingOrg(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadGlobalCatalog()
  }

  const openAddModal = (software: GlobalSoftwareWithStatus) => {
    setSelectedSoftware(software)
    setAddNotes('')
    setShowAddModal(true)
  }

  const handleAddToOrg = async () => {
    if (!selectedSoftware) return
    setAdding(true)
    try {
      await api.addSoftwareToOrganization(selectedSoftware.id, addNotes || undefined)
      setShowAddModal(false)
      loadGlobalCatalog()
      loadOrgSoftware()
    } catch (error) {
      console.error('Failed to add software:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
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
      setSubmitForm({
        name: '',
        description: '',
        iconUrl: '',
        vendor: '',
        websiteUrl: '',
        categoryId: ''
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit software')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOrgSoftwareClick = (item: OrganizationSoftware) => {
    navigate(`/admin/software/org/${item.id}`)
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>Software Catalog</Heading>
        <Button color="blue" onClick={() => setShowSubmitModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Submit New Software
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('organization')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'organization'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <BuildingOfficeIcon className="h-4 w-4 inline mr-2" />
            Organization Software ({orgSoftware.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <GlobeAltIcon className="h-4 w-4 inline mr-2" />
            Browse Global Catalog
          </button>
        </nav>
      </div>

      {activeTab === 'organization' ? (
        // Organization's Software Tab
        loadingOrg ? (
          <div className="flex h-48 items-center justify-center">
            <Text>Loading...</Text>
          </div>
        ) : orgSoftware.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
            <Subheading className="mt-4">No software added yet</Subheading>
            <Text className="mt-2">
              Browse the global catalog to add software to your organization.
            </Text>
            <Button color="blue" onClick={() => setActiveTab('catalog')} className="mt-4">
              Browse Catalog
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgSoftware.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOrgSoftwareClick(item)}
                className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  {item.software.iconUrl ? (
                    <img
                      src={item.software.iconUrl}
                      alt={item.software.name}
                      className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <ComputerDesktopIcon className="w-6 h-6 text-zinc-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-900 dark:text-white truncate">
                      {item.software.name}
                    </h3>
                    {item.software.vendor && (
                      <p className="text-sm text-zinc-500">{item.software.vendor}</p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {item.software.category && (
                        <Badge color="zinc">{item.software.category.name}</Badge>
                      )}
                      <span className="text-xs text-zinc-400">
                        {item._count?.accessRequests || 0} requests
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Global Catalog Tab
        <>
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

          {loadingCatalog ? (
            <div className="flex h-48 items-center justify-center">
              <Text>Loading catalog...</Text>
            </div>
          ) : globalSoftware.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
              <Subheading className="mt-4">No software found</Subheading>
              <Text className="mt-2">
                Try adjusting your search or submit new software.
              </Text>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {globalSoftware.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <ComputerDesktopIcon className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-zinc-900 dark:text-white truncate">
                        {item.name}
                      </h3>
                      {item.vendor && (
                        <p className="text-sm text-zinc-500">{item.vendor}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {item.category && (
                          <Badge color="zinc">{item.category.name}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    {item.isAdded ? (
                      <Button outline disabled className="w-full">
                        <CheckIcon className="h-4 w-4" />
                        Added to Organization
                      </Button>
                    ) : (
                      <Button color="blue" className="w-full" onClick={() => openAddModal(item)}>
                        <PlusIcon className="h-4 w-4" />
                        Add to Organization
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add to Organization Modal */}
      {showAddModal && selectedSoftware && (
        <Dialog open={true} onClose={() => setShowAddModal(false)} size="md">
          <DialogTitle>Add to Organization</DialogTitle>
          <DialogDescription>
            Add "{selectedSoftware.name}" to your organization's software catalog.
          </DialogDescription>

          <DialogBody>
            <Field>
              <Label>Organization Notes (optional)</Label>
              <Textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Add any organization-specific notes or instructions..."
                rows={3}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowAddModal(false)} disabled={adding}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleAddToOrg} disabled={adding}>
              {adding ? 'Adding...' : 'Add Software'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Submit New Software Modal */}
      {showSubmitModal && (
        <Dialog open={true} onClose={() => setShowSubmitModal(false)} size="lg">
          <DialogTitle>Submit New Software</DialogTitle>
          <DialogDescription>
            Submit software that's not in the global catalog. It will be reviewed by administrators before being added.
          </DialogDescription>

          <form onSubmit={handleSubmitNew}>
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
                    placeholder="Microsoft Office"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={submitForm.description}
                    onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
                    placeholder="Brief description of the software..."
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
                      placeholder="Microsoft"
                    />
                  </Field>

                  <Field>
                    <Label>Category</Label>
                    <Select
                      value={submitForm.categoryId}
                      onChange={(e) => setSubmitForm({ ...submitForm, categoryId: e.target.value })}
                    >
                      <option value="">No category</option>
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
                    placeholder="https://example.com/icon.png"
                  />
                </Field>

                <Field>
                  <Label>Website URL</Label>
                  <Input
                    type="url"
                    value={submitForm.websiteUrl}
                    onChange={(e) => setSubmitForm({ ...submitForm, websiteUrl: e.target.value })}
                    placeholder="https://www.microsoft.com/office"
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
