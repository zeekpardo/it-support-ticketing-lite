import { Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { ProjectSoftwareDetailType, SoftwareAccessRequest } from './types'

interface RequestsSectionProps {
  software: ProjectSoftwareDetailType
  pendingRequests: SoftwareAccessRequest[]
  onQuickApprove: (request: SoftwareAccessRequest) => void
  onOpenReviewModal: (request: SoftwareAccessRequest, defaultStatus?: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING') => void
  onOpenDeleteRequestModal: (request: SoftwareAccessRequest) => void
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge color="green">Approved</Badge>
    case 'PENDING':
      return <Badge color="amber">Pending</Badge>
    case 'DECLINED':
      return <Badge color="red">Declined</Badge>
    case 'REVOKED':
      return <Badge color="zinc">Revoked</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function RequestsSection({
  software,
  pendingRequests,
  onQuickApprove,
  onOpenReviewModal,
  onOpenDeleteRequestModal,
}: RequestsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Subheading>
          Access Requests
          {pendingRequests.length > 0 && (
            <Badge color="amber" className="ml-2">{pendingRequests.length} pending</Badge>
          )}
        </Subheading>
      </div>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Requester</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader className="w-[150px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {software.accessRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{request.requester.user.name}</div>
                    <div className="text-sm text-zinc-500">{request.requester.user.email}</div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500 max-w-xs truncate">
                  {request.reason || '-'}
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell className="text-zinc-500">
                  {new Date(request.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {request.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button
                          color="green"
                          className="px-2 py-1 text-xs"
                          onClick={() => onQuickApprove(request)}
                        >
                          <CheckIcon className="h-3 w-3" />
                        </Button>
                        <Button
                          color="red"
                          className="px-2 py-1 text-xs"
                          onClick={() => onOpenReviewModal(request, 'DECLINED')}
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Select
                      value=""
                      onChange={(e) => {
                        const action = e.target.value
                        if (action === 'delete') {
                          onOpenDeleteRequestModal(request)
                        } else if (action) {
                          onOpenReviewModal(request, action as 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING')
                        }
                      }}
                      className="w-28 text-xs"
                    >
                      <option value="">Actions</option>
                      {request.status !== 'APPROVED' && <option value="APPROVED">Approve</option>}
                      {request.status !== 'DECLINED' && <option value="DECLINED">Decline</option>}
                      {request.status !== 'REVOKED' && <option value="REVOKED">Revoke</option>}
                      {request.status !== 'PENDING' && <option value="PENDING">Set Pending</option>}
                      <option value="delete">Delete</option>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {software.accessRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                  No access requests
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
