import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  FolderIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

interface ProjectClient {
  id: string
  userId: string
  name: string
  email: string
}

interface Project {
  id: string
  name: string
  projectCode: string
  clientName?: string
  description?: string
  isActive: boolean
  defaultAssigneeId?: string | null
  defaultAssignee?: {
    id: string
    role: string
    user: { id: string; name: string }
  } | null
  dueDateLowDays?: number | null
  dueDateMediumDays?: number | null
  dueDateHighDays?: number | null
  dueDateUrgentDays?: number | null
  _count?: {
    timeEntries: number
    tickets: number
  }
  clients?: ProjectClient[]
  createdAt?: string
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (currentOrg && id) {
      loadProject()
    }
  }, [currentOrg, id])

  const loadProject = async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await api.getProject(id)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return

    setDeleting(true)
    try {
      await api.deleteProject(id)
      navigate('/admin/projects')
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('Failed to delete project')
    } finally {
      setDeleting(false)
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

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Project not found</Text>
      </div>
    )
  }

  const hasDueDates = project.dueDateLowDays || project.dueDateMediumDays ||
                       project.dueDateHighDays || project.dueDateUrgentDays

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button plain onClick={() => navigate('/admin/projects')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>

          <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FolderIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <Heading>{project.name}</Heading>
              {project.isActive ? (
                <Badge color="green">Active</Badge>
              ) : (
                <Badge color="zinc">Archived</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge color="blue">{project.projectCode}</Badge>
              {project.clientName && (
                <Text className="text-zinc-500">{project.clientName}</Text>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button outline onClick={() => navigate(`/admin/projects/${id}/edit`)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button color="red" outline onClick={() => setShowDeleteModal(true)}>
            <TrashIcon className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {project.description && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading>Description</Subheading>
              <Text className="mt-2 whitespace-pre-wrap">{project.description}</Text>
            </div>
          )}

          {/* Due Date Settings */}
          {hasDueDates && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading>Due Date Settings</Subheading>
              <Text className="text-sm text-zinc-500 mt-1 mb-4">
                Automatic due dates by priority when tickets are created
              </Text>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Low</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {project.dueDateLowDays ? `${project.dueDateLowDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Medium</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {project.dueDateMediumDays ? `${project.dueDateMediumDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">High</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {project.dueDateHighDays ? `${project.dueDateHighDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Urgent</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {project.dueDateUrgentDays ? `${project.dueDateUrgentDays} days` : '-'}
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* Clients */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Clients</Subheading>
            {project.clients && project.clients.length > 0 ? (
              <div className="mt-4">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Email</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {project.clients.map((client) => (
                      <TableRow key={client.id} href={`/admin/clients/${client.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <span className="font-medium">{client.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-500">{client.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Text className="mt-2 text-zinc-500">No clients assigned to this project</Text>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Details</Subheading>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Default Assignee</dt>
                <dd className="text-sm text-zinc-900 dark:text-white">
                  {project.defaultAssignee?.user.name || 'None'}
                </dd>
              </div>
              {project._count && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Time Entries</dt>
                    <dd className="text-sm text-zinc-900 dark:text-white">
                      {project._count.timeEntries}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Tickets</dt>
                    <dd className="text-sm text-zinc-900 dark:text-white">
                      {project._count.tickets || 0}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status</dt>
                <dd className="text-sm">
                  {project.isActive ? (
                    <Badge color="green">Active</Badge>
                  ) : (
                    <Badge color="zinc">Archived</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Quick Actions</Subheading>
            <div className="mt-4 space-y-2">
              <Link
                to={`/projects/${project.id}/tickets`}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View Tickets
              </Link>
              <Link
                to={`/admin/projects/${project.id}/edit`}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Edit Project
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogBody>
          <Text>
            {project._count?.timeEntries ? (
              <>
                This project has <strong>{project._count.timeEntries}</strong> time entries.
                It will be archived instead of deleted to preserve the data. Continue?
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{project.name}</strong>?
                This action cannot be undone.
              </>
            )}
          </Text>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : project._count?.timeEntries ? 'Archive' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
