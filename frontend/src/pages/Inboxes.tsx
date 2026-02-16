import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
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
import { FolderIcon, TicketIcon } from '@heroicons/react/24/outline'

interface Inbox {
  id: string
  name: string
  inboxCode: string
  clientName?: string
  description?: string
  isActive: boolean
  _count?: {
    timeEntries: number
  }
}

export default function Inboxes() {
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
      const data = await api.getInboxes()
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
        <Text>Select an organization to view inboxes</Text>
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
        <Heading>Inboxes</Heading>
      </div>

      {inboxes.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <FolderIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No inboxes yet</Subheading>
          <Text className="mt-2">
            Inboxes will be created by administrators. Contact your admin to set up inboxes.
          </Text>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Code</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Entries</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {inboxes.map((inbox) => (
                <TableRow key={inbox.id}>
                  <TableCell>
                    <Badge color="blue">{inbox.inboxCode}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{inbox.name}</TableCell>
                  <TableCell className="text-zinc-500">
                    {inbox.clientName || '-'}
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
                    <Link to={`/inboxes/${inbox.id}/tickets`}>
                      <Button outline className="flex items-center gap-1">
                        <TicketIcon className="w-4 h-4" />
                        Tickets
                      </Button>
                    </Link>
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
