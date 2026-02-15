import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Text } from '../ui/text'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { GlobalSoftware } from '../../api/client'

interface SoftwareTableProps {
  software: GlobalSoftware[]
  onEdit: (item: GlobalSoftware) => void
  onDelete: (id: string) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  /** Pagination */
  total?: number
  offset?: number
  limit?: number
  onOffsetChange?: (offset: number) => void
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge color="green">Approved</Badge>
    case 'PENDING':
      return <Badge color="amber">Pending</Badge>
    case 'REJECTED':
      return <Badge color="red">Rejected</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export function SoftwareTable({
  software,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  total = 0,
  offset = 0,
  limit = 50,
  onOffsetChange,
}: SoftwareTableProps) {
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Software</TableHeader>
              <TableHeader>Vendor</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Organizations</TableHeader>
              <TableHeader className="w-[180px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {software.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-700" />
                    )}
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-zinc-500 truncate max-w-xs">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500">{item.vendor || '-'}</TableCell>
                <TableCell>
                  {item.category ? (
                    <Badge color="zinc">{item.category.name}</Badge>
                  ) : (
                    <span className="text-zinc-400">Uncategorized</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className="text-zinc-500">
                  {(item._count as any)?.organizationSoftware || 0}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {item.status === 'PENDING' && onApprove && onReject && (
                      <>
                        <Button
                          color="green"
                          className="px-2 py-1 text-xs"
                          onClick={() => onApprove(item.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          color="red"
                          className="px-2 py-1 text-xs"
                          onClick={() => onReject(item.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Button plain onClick={() => onEdit(item)}>
                      <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                    <Button plain onClick={() => onDelete(item.id)}>
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {software.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                  No software found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && onOffsetChange && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} items
          </Text>
          <div className="flex gap-2">
            <Button
              outline
              disabled={currentPage === 1}
              onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              outline
              disabled={currentPage >= totalPages}
              onClick={() => onOffsetChange(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
