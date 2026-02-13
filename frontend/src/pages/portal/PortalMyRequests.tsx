import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type MyAccessRequest } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { ArrowLeftIcon, ClipboardDocumentListIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { AccessRequestStatusBadge, ACCESS_REQUEST_STATUSES } from '@/components/software'

export default function PortalMyRequests() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: requests, loading } = useAsync<MyAccessRequest[]>(
    () => api.getMyAccessRequests({ status: statusFilter || undefined }),
    [currentOrg, statusFilter],
    { immediate: !!currentOrg }
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
          <Button plain onClick={() => navigate('/portal/software')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <Heading>My Access Requests</Heading>
        </div>
      </div>

      {/* Filter */}
      <div className="w-48">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {ACCESS_REQUEST_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
      </div>

      {(!requests || requests.length === 0) ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No requests yet</Subheading>
          <Text className="mt-2">
            Browse the software catalog and request access to software you need.
          </Text>
          <Button
            color="blue"
            onClick={() => navigate('/portal/software')}
            className="mt-4"
          >
            Browse Software
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10"
            >
              <div className="flex items-start gap-4">
                {request.software?.iconUrl ? (
                  <img
                    src={request.software.iconUrl}
                    alt={request.software.name}
                    className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <ComputerDesktopIcon className="w-6 h-6 text-zinc-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-zinc-900 dark:text-white">
                        {request.software?.name || 'Unknown Software'}
                      </h3>
                      {request.software?.vendor && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {request.software.vendor}
                        </p>
                      )}
                    </div>
                    <AccessRequestStatusBadge status={request.status} />
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-zinc-500">Requested:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {formatDate(request.createdAt)}
                      </span>
                    </div>

                    {request.reason && (
                      <div className="text-sm">
                        <span className="text-zinc-500">Your reason:</span>
                        <p className="text-zinc-700 dark:text-zinc-300 mt-1">
                          {request.reason}
                        </p>
                      </div>
                    )}

                    {request.reviewNotes && (
                      <div className="text-sm">
                        <span className="text-zinc-500">Admin notes:</span>
                        <p className="text-zinc-700 dark:text-zinc-300 mt-1">
                          {request.reviewNotes}
                        </p>
                      </div>
                    )}

                    {request.reviewer && (
                      <div className="text-sm text-zinc-500">
                        Reviewed by {request.reviewer.user.name} on {formatDate(request.updatedAt)}
                      </div>
                    )}
                  </div>

                  {request.status === 'DECLINED' && (
                    <Button
                      color="blue"
                      outline
                      onClick={() => navigate(`/portal/software/${request.organizationSoftwareId}`)}
                      className="mt-4"
                    >
                      Request Again
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
