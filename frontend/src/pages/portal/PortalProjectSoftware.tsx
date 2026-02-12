import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

type FilterType = 'all' | 'my-software'

export default function PortalProjectSoftware() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [software, setSoftware] = useState<PortalSoftware[]>([])
  const [categories, setCategories] = useState<SoftwareCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewFilter, setViewFilter] = useState<FilterType>('all')
  const [project, setProject] = useState<{ id: string; name: string; projectCode: string } | null>(null)

  useEffect(() => {
    if (projectId) {
      loadProject()
      loadCategories()
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      loadSoftware()
    }
  }, [projectId, categoryFilter, viewFilter])

  const loadProject = async () => {
    if (!projectId) return
    try {
      const projects = await api.getPortalProjects()
      const proj = projects.find(p => p.id === projectId)
      if (proj) {
        setProject(proj)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const loadCategories = async () => {
    if (!projectId) return
    try {
      const data = await api.getPortalSoftwareCategories(projectId)
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadSoftware = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await api.getPortalProjectSoftware(projectId, {
        categoryId: categoryFilter || undefined,
        filter: viewFilter === 'my-software' ? 'my-software' : undefined
      })
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
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

  if (loading && software.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Heading>Software Catalog</Heading>
        <Text className="mt-1 text-zinc-500">
          {project?.name || 'Project'} - Browse available software and request access
        </Text>
      </div>

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
      </div>

      {/* Software Grid */}
      {software.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Text className="mt-4 text-zinc-500">
            {viewFilter === 'my-software'
              ? 'You don\'t have access to any software yet'
              : 'No software available in this project'}
          </Text>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {software.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer"
              onClick={() => navigate(`/portal/projects/${projectId}/software/${item.id}`)}
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
