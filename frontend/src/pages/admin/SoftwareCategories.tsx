import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type SoftwareCategory } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, TagIcon } from '@heroicons/react/24/outline'
import { SoftwareCategoryForm } from '@/components/software'

export default function SoftwareCategories() {
  const { inboxId } = useParams<{ inboxId: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [inboxName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<SoftwareCategory | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg && inboxId) {
      loadData()
    }
  }, [currentOrg, inboxId])

  const loadData = async () => {
    if (!inboxId) return

    setLoading(true)
    try {
      const [categoriesData, inboxData] = await Promise.all([
        api.getSoftwareCategories(inboxId),
        api.getInbox(inboxId)
      ])
      setCategories(categoriesData)
      setInboxName(inboxData.name)
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingCategory(null)
    setShowModal(true)
  }

  const openEditModal = (category: SoftwareCategory) => {
    setEditingCategory(category)
    setShowModal(true)
  }

  const handleSubmit = async (data: { name: string; description?: string }) => {
    if (!inboxId) return

    setSaving(true)
    try {
      if (editingCategory) {
        await api.updateSoftwareCategory(inboxId, editingCategory.id, data)
      } else {
        await api.createSoftwareCategory(inboxId, data)
      }
      loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: SoftwareCategory) => {
    if (!inboxId) return

    const message = category._count?.software
      ? `This category has ${category._count.software} software items. They will be moved to "No category". Delete anyway?`
      : 'Are you sure you want to delete this category?'

    if (!confirm(message)) return

    try {
      await api.deleteSoftwareCategory(inboxId, category.id)
      loadData()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Failed to delete category')
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button plain onClick={() => navigate('/admin/software')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <Heading>Software Categories</Heading>
            <Text className="text-zinc-500">{inboxName}</Text>
          </div>
        </div>
        <Button color="blue" onClick={openCreateModal}>
          <PlusIcon className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <TagIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No categories yet</Subheading>
          <Text className="mt-2">
            Create categories to organize software in this inbox.
          </Text>
          <Button color="blue" onClick={openCreateModal} className="mt-4">
            <PlusIcon className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Software Count</TableHeader>
                <TableHeader className="w-[100px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-zinc-500">
                    {category.description || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {category._count?.software || 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button plain onClick={() => openEditModal(category)}>
                        <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                      <Button plain onClick={() => handleDelete(category)}>
                        <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <SoftwareCategoryForm
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        category={editingCategory}
        isLoading={saving}
      />
    </div>
  )
}
