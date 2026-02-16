import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlusIcon, FolderIcon, EyeIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'

interface Inbox {
  id: string
  name: string
  inboxCode: string
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
  }
}

export default function AdminInboxes() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg) {
      loadInboxes()
    }
  }, [currentOrg])

  const loadInboxes = async () => {
    setLoading(true)
    try {
      const data = await api.getInboxes(true) // Include inactive
      setInboxes(data)
    } catch (error) {
      console.error('Failed to load inboxes:', error)
    } finally {
      setLoading(false)
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Heading>Manage Inboxes</Heading>
        <Button color="blue" onClick={() => navigate('/admin/inboxes/new')}>
          <PlusIcon className="h-4 w-4" />
          New Inbox
        </Button>
      </div>

      {inboxes.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <FolderIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No inboxes yet</Subheading>
          <Text className="mt-2">
            Create your first inbox to start tracking time.
          </Text>
          <Button color="blue" onClick={() => navigate('/admin/inboxes/new')} className="mt-4">
            <PlusIcon className="h-4 w-4" />
            Create Inbox
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Default Assignee</TableHeader>
                <TableHeader>Entries</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="w-[150px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboxes.map((inbox) => (
                <TableRow key={inbox.id}>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/admin/inboxes/${inbox.id}/edit`)}
                      className="font-medium text-zinc-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left"
                    >
                      {inbox.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {inbox.clientName || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {inbox.defaultAssignee?.user.name || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {inbox._count?.timeEntries || 0}
                  </TableCell>
                  <TableCell>
                    {inbox.isActive ? (
                      <Badge color="green">Active</Badge>
                    ) : (
                      <Badge color="zinc">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button plain onClick={() => navigate(`/admin/inboxes/${inbox.id}`)}>
                        <EyeIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                      <Button plain onClick={() => navigate(`/admin/inboxes/${inbox.id}/software`)}>
                        <ComputerDesktopIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
