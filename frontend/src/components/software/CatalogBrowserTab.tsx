import { api, type GlobalSoftware, type SoftwareCategory } from '../../api/client'
import { useModalForm } from '../../hooks/useModalForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
} from '@heroicons/react/24/outline'

interface CatalogBrowserTabProps {
  globalSoftware: GlobalSoftware[]
  categories: SoftwareCategory[]
  projectSoftwareIds: Set<string>
  loadingCatalog: boolean
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  categoryFilter: string
  onCategoryFilterChange: (filter: string) => void
  onSearch: () => void
  onAddToProject: (softwareId: string, notes?: string) => Promise<void>
}

export function CatalogBrowserTab({
  globalSoftware,
  categories,
  projectSoftwareIds,
  loadingCatalog,
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  onSearch,
  onAddToProject,
}: CatalogBrowserTabProps) {
  // Add-to-project modal
  const addModal = useModalForm<{ notes: string }, GlobalSoftware>({
    initialData: { notes: '' },
  })

  // Submit-new-software modal
  const submitModal = useModalForm({
    initialData: {
      name: '',
      description: '',
      iconUrl: '',
      vendor: '',
      websiteUrl: '',
      categoryId: '',
    },
  })

  const handleAddToProject = async () => {
    if (!addModal.editingItem) return
    try {
      await addModal.handleSubmit(async () => {
        await onAddToProject(addModal.editingItem!.id, addModal.formData.notes || undefined)
        addModal.close()
      })
    } catch (error) {
      console.error('Failed to add software to project:', error)
    }
  }

  const handleSubmitSoftware = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submitModal.handleSubmit(async () => {
        await api.submitNewSoftware({
          name: submitModal.formData.name,
          description: submitModal.formData.description || undefined,
          iconUrl: submitModal.formData.iconUrl || undefined,
          vendor: submitModal.formData.vendor || undefined,
          websiteUrl: submitModal.formData.websiteUrl || undefined,
          categoryId: submitModal.formData.categoryId || undefined,
        })
      })
      submitModal.close()
    } catch {
      // Error already captured in submitModal.error
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">
          Browse and add software from the global catalog
        </Text>
        <Button outline onClick={() => submitModal.open()}>
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
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search software..."
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
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
                    <Button color="blue" className="w-full" onClick={() => addModal.open(software)}>
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

      {/* Add to Project Modal */}
      {addModal.isOpen && addModal.editingItem && (
        <Dialog open={true} onClose={addModal.close} size="md">
          <DialogTitle>Add Software to Project</DialogTitle>
          <DialogDescription>
            Add "{addModal.editingItem.name}" to this project's software catalog
          </DialogDescription>

          <DialogBody>
            <Field>
              <Label>Notes (optional)</Label>
              <Textarea
                value={addModal.formData.notes}
                onChange={(e) => addModal.setField('notes', e.target.value)}
                placeholder="Add project-specific notes or setup instructions..."
                rows={4}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={addModal.close} disabled={addModal.saving}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleAddToProject} disabled={addModal.saving}>
              {addModal.saving ? 'Adding...' : 'Add to Project'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Submit New Software Modal */}
      {submitModal.isOpen && (
        <Dialog open={true} onClose={submitModal.close} size="lg">
          <DialogTitle>Submit New Software</DialogTitle>
          <DialogDescription>
            Submit a new software to be added to the global catalog. It will be reviewed by an admin before becoming available.
          </DialogDescription>

          <form onSubmit={handleSubmitSoftware}>
            <DialogBody>
              {submitModal.error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {submitModal.error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={submitModal.formData.name}
                    onChange={(e) => submitModal.setField('name', e.target.value)}
                    placeholder="Software name"
                    required
                  />
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Textarea
                    value={submitModal.formData.description}
                    onChange={(e) => submitModal.setField('description', e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <Label>Vendor</Label>
                    <Input
                      type="text"
                      value={submitModal.formData.vendor}
                      onChange={(e) => submitModal.setField('vendor', e.target.value)}
                      placeholder="Company name"
                    />
                  </Field>

                  <Field>
                    <Label>Category</Label>
                    <Select
                      value={submitModal.formData.categoryId}
                      onChange={(e) => submitModal.setField('categoryId', e.target.value)}
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
                    value={submitModal.formData.iconUrl}
                    onChange={(e) => submitModal.setField('iconUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </Field>

                <Field>
                  <Label>Website URL</Label>
                  <Input
                    type="url"
                    value={submitModal.formData.websiteUrl}
                    onChange={(e) => submitModal.setField('websiteUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={submitModal.close} disabled={submitModal.saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={submitModal.saving}>
                {submitModal.saving ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  )
}
