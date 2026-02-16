import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, PortalSoftware, SoftwareCategory } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import {
  ComputerDesktopIcon,
  FolderIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

interface Inbox {
  id: string
  name: string
  inboxCode: string
  clientName?: string
}

type FilterType = 'all' | 'my-software'

export default function PortalCatalog() {
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [selectedInboxId, setSelectedInboxId] = useState<string>('')
  const [software, setSoftware] = useState<PortalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [softwareLoading, setSoftwareLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewFilter, setViewFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (currentOrg) {
      loadInboxes()
    }
  }, [currentOrg])

  useEffect(() => {
    if (selectedInboxId) {
      loadCategories()
      loadSoftware()
    }
  }, [selectedInboxId, categoryFilter, viewFilter])

  const loadInboxes = async () => {
    setLoading(true)
    try {
      const data = await api.getPortalInboxes()
      setInboxes(data)
      // Auto-select the first inbox if there's only one or more
      if (data.length > 0) {
        setSelectedInboxId(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load inboxes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    if (!selectedInboxId) return
    try {
      const data = await api.getPortalSoftwareCategories(selectedInboxId)
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadSoftware = async () => {
    if (!selectedInboxId) return
    setSoftwareLoading(true)
    try {
      const data = await api.getPortalInboxSoftware(selectedInboxId, {
        categoryId: categoryFilter || undefined,
        filter: viewFilter === 'my-software' ? 'my-software' : undefined
      })
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setSoftwareLoading(false)
    }
  }

  const getAccessStatusIcon = (request: PortalSoftware['myAccessRequest']) => {
    if (!request) return null

    switch (request.status) {
      case 'APPROVED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'PENDING':
        return <ClockIcon className="h-5 w-5 text-amber-500" />
      case 'DECLINED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getAccessStatusBadge = (request: PortalSoftware['myAccessRequest']) => {
    if (!request) return null

    switch (request.status) {
      case 'APPROVED':
        return <Badge color="green">Access Granted</Badge>
      case 'PENDING':
        return <Badge color="amber">Pending Approval</Badge>
      case 'DECLINED':
        return <Badge color="red">Declined</Badge>
      default:
        return null
    }
  }

  const selectedInbox = inboxes.find(p => p.id === selectedInboxId)

  if (!currentOrg || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  if (inboxes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Heading>Software Catalog</Heading>
          <Text className="text-zinc-500">
            Browse available software for your inboxes.
          </Text>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <FolderIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Text className="mt-4 text-zinc-500">
            No inboxes available.
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading>Software Catalog</Heading>
          <Text className="mt-1 text-zinc-500">
            Browse available software and request access
          </Text>
        </div>
        {/* Inbox selector - only show if multiple inboxes */}
        {inboxes.length > 1 && (
          <Select
            value={selectedInboxId}
            onChange={(e) => {
              setSelectedInboxId(e.target.value)
              setCategoryFilter('')
            }}
            className="w-full sm:w-64"
          >
            {inboxes.map(inbox => (
              <option key={inbox.id} value={inbox.id}>
                {inbox.name} ({inbox.inboxCode})
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Show current inbox badge if only one inbox */}
      {inboxes.length === 1 && selectedInbox && (
        <div className="flex items-center gap-2">
          <Badge color="blue">{selectedInbox.inboxCode}</Badge>
          <Text className="text-sm text-zinc-500">{selectedInbox.name}</Text>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            outline={viewFilter !== 'all'}
            color={viewFilter === 'all' ? 'blue' : undefined}
            onClick={() => setViewFilter('all')}
          >
            <FolderIcon className="h-4 w-4" />
            All Software
          </Button>
          <Button
            outline={viewFilter !== 'my-software'}
            color={viewFilter === 'my-software' ? 'blue' : undefined}
            onClick={() => setViewFilter('my-software')}
          >
            <CheckCircleIcon className="h-4 w-4" />
            My Software
          </Button>
        </div>
        {categories.length > 0 && (
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
        )}
      </div>

      {/* Software Grid */}
      {softwareLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Text>Loading software...</Text>
        </div>
      ) : software.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Text className="mt-4 text-zinc-500">
            {viewFilter === 'my-software'
              ? 'You don\'t have access to any software yet'
              : 'No software available in this inbox'}
          </Text>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {software.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer"
              onClick={() => navigate(`/portal/inboxes/${selectedInboxId}/software/${item.id}`)}
            >
              <div className="flex items-start gap-3">
                {item.iconUrl ? (
                  <img
                    src={item.iconUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                    <ComputerDesktopIcon className="h-6 w-6 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-white truncate">
                      {item.name}
                    </span>
                    {getAccessStatusIcon(item.myAccessRequest)}
                  </div>
                  {item.vendor && (
                    <div className="text-sm text-zinc-500 truncate">{item.vendor}</div>
                  )}
                </div>
              </div>

              {item.description && (
                <p className="mt-3 text-sm text-zinc-500 line-clamp-2">{item.description}</p>
              )}

              <div className="mt-3 flex items-center justify-between">
                {item.category && (
                  <Badge color="zinc">{item.category.name}</Badge>
                )}
                {getAccessStatusBadge(item.myAccessRequest)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
