import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Text } from '@/components/ui/text'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface TimeEntry {
  id: string
  taskName: string
  startTime: string
  endTime?: string
  durationMins?: number
  isRunning: boolean
  notes?: string
  inbox: {
    id: string
    name: string
    inboxCode: string
  }
  user: {
    id: string
    name: string
    email: string
  }
}

interface TimeEntryListProps {
  entries: TimeEntry[]
  isAdmin: boolean
  onDelete: (id: string) => void
  onRefresh: () => void
}

export function TimeEntryList({ entries, isAdmin, onDelete, onRefresh }: TimeEntryListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (mins: number | undefined) => {
    if (!mins) return '-'
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center">
        <Text>No time entries yet. Start the timer to track your first entry!</Text>
      </div>
    )
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Date</TableHeader>
          <TableHeader>Inbox</TableHeader>
          <TableHeader>Task</TableHeader>
          {isAdmin && <TableHeader>User</TableHeader>}
          <TableHeader>Time</TableHeader>
          <TableHeader>Duration</TableHeader>
          <TableHeader className="w-[100px]">Actions</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">
              {formatDate(entry.startTime)}
            </TableCell>
            <TableCell>
              <Badge color="blue">
                {entry.inbox.inboxCode}
              </Badge>
              <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                {entry.inbox.name}
              </span>
            </TableCell>
            <TableCell>{entry.taskName}</TableCell>
            {isAdmin && (
              <TableCell className="text-zinc-500">
                {entry.user.name}
              </TableCell>
            )}
            <TableCell className="text-zinc-500">
              {formatTime(entry.startTime)}
              {entry.endTime && ` - ${formatTime(entry.endTime)}`}
            </TableCell>
            <TableCell>
              {entry.isRunning ? (
                <Badge color="green">Running</Badge>
              ) : (
                <span className="font-mono">
                  {formatDuration(entry.durationMins)}
                </span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  plain
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                >
                  <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
