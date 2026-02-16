import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import type { InboxSoftware } from '../../api/client'
import { getDaysUntilRenewal } from '../../hooks/useInboxSoftwareCatalog'

interface InboxSoftwareTabProps {
  inboxId: string
  inboxSoftware: InboxSoftware[]
  onSwitchToCatalog: () => void
}

export function InboxSoftwareTab({ inboxId, inboxSoftware, onSwitchToCatalog }: InboxSoftwareTabProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">
          Software added to this inbox ({inboxSoftware.length})
        </Text>
        <Button color="blue" onClick={onSwitchToCatalog}>
          <PlusIcon className="h-4 w-4" />
          Add Software
        </Button>
      </div>

      {inboxSoftware.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <ComputerDesktopIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Text className="mt-4 text-zinc-500">No software added to this inbox yet</Text>
          <Button className="mt-4" outline onClick={onSwitchToCatalog}>
            Browse Global Catalog
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inboxSoftware.map((ps) => (
            <div
              key={ps.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer"
              onClick={() => navigate(`/admin/inboxes/${inboxId}/software/${ps.id}`)}
            >
              <div className="flex items-start gap-3">
                {ps.software.iconUrl ? (
                  <img
                    src={ps.software.iconUrl}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                    <ComputerDesktopIcon className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white truncate">
                    {ps.software.name}
                  </div>
                  {ps.software.vendor && (
                    <div className="text-sm text-zinc-500 truncate">{ps.software.vendor}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ps.software.category && (
                  <Badge color="zinc">{ps.software.category.name}</Badge>
                )}
                {ps.cost && (
                  <Badge color="blue">
                    ${parseFloat(ps.cost).toFixed(0)}{ps.billingCycle === 'MONTHLY' ? '/mo' : '/yr'}
                  </Badge>
                )}
                {ps.renewalDate && (() => {
                  const days = getDaysUntilRenewal(ps.renewalDate)
                  if (days < 0) return <Badge color="zinc">Expired</Badge>
                  if (days <= 7) return <Badge color="red">Renews in {days}d</Badge>
                  if (days <= 30) return <Badge color="amber">Renews in {days}d</Badge>
                  return null
                })()}
                {ps.totalSeats != null && (
                  <Badge color={((ps._count?.accessRequests || 0) >= ps.totalSeats) ? 'red' : 'zinc'}>
                    {ps._count?.accessRequests || 0}/{ps.totalSeats} seats
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                <span>{ps._count?.admins || 0} admins</span>
                <span>{ps._count?.accessRequests || 0} requests</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
