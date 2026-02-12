import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type PortalSoftware, type SoftwareCategory } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { ComputerDesktopIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { SoftwareCard, CategoryFilter } from '@/components/software'

export default function PortalSoftwareCatalog() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [software, setSoftware] = useState<PortalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [mySoftwareFilter, setMySoftwareFilter] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg) {
      loadInitialData()
    }
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg) {
      loadSoftware()
    }
  }, [selectedCategory, mySoftwareFilter])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [softwareData, categoriesData] = await Promise.all([
        api.getPortalSoftwareCatalog(),
        api.getPortalSoftwareCategories()
      ])
      setSoftware(softwareData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSoftware = async () => {
    try {
      const data = await api.getPortalSoftwareCatalog({
        categoryId: selectedCategory || undefined,
        filter: mySoftwareFilter ? 'my-software' : undefined
      })
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    }
  }

  const handleSoftwareClick = (item: PortalSoftware) => {
    navigate(`/portal/software/${item.id}`)
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
        <Heading>Software Catalog</Heading>
        <Button outline onClick={() => navigate('/portal/software/requests')}>
          <ClipboardDocumentListIcon className="h-4 w-4" />
          My Requests
        </Button>
      </div>

      {/* Filters */}
      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        showMySoftware={true}
        mySoftwareFilter={mySoftwareFilter}
        onMySoftwareChange={setMySoftwareFilter}
      />

      {software.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">
            {mySoftwareFilter ? 'No software access yet' : 'No software available'}
          </Subheading>
          <Text className="mt-2">
            {mySoftwareFilter
              ? 'Request access to software to see it here.'
              : 'No software has been added to your organization yet.'}
          </Text>
          {mySoftwareFilter && (
            <Button
              outline
              onClick={() => setMySoftwareFilter(false)}
              className="mt-4"
            >
              Browse All Software
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {software.map((item) => (
            <SoftwareCard
              key={item.id}
              software={item}
              onClick={() => handleSoftwareClick(item)}
              showAccessStatus={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
