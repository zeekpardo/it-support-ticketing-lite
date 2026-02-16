import { Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { StatusBadge, PriorityBadge } from '../../components/tickets'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  TicketIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'

interface DashboardData {
  stats: {
    total: number
    newRequest: number
    inProgress: number
    waitingForInfo: number
    review: number
    resolved: number
  }
  recentTickets: Array<{
    id: string
    subject: string
    status: string
    priorityLevel: string
    updatedAt: string
    inbox: { id: string; name: string }
  }>
}

export default function PortalDashboard() {
  const { currentOrg } = useOrganization()
  const { data, loading } = useAsync<DashboardData>(
    () => api.getPortalDashboard(),
    [currentOrg],
    { immediate: !!currentOrg }
  )

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
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

  const stats = data?.stats || {
    total: 0,
    newRequest: 0,
    inProgress: 0,
    waitingForInfo: 0,
    review: 0,
    resolved: 0
  }

  const activeTickets = stats.total - stats.resolved

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Support Portal</Heading>
          <Text className="text-zinc-500">Welcome back! Here's an overview of your tickets.</Text>
        </div>
        <Link to="/portal/tickets/new">
          <Button>
            <PlusIcon className="w-4 h-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TicketIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Tickets</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <ClockIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Active</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{activeTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <ExclamationCircleIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Needs Response</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{stats.waitingForInfo}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Resolved</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{stats.resolved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Subheading>Recent Tickets</Subheading>
          <Link to="/portal/tickets" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            View all
          </Link>
        </div>

        {data?.recentTickets && data.recentTickets.length > 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 divide-y divide-zinc-200 dark:divide-zinc-700">
            {data.recentTickets.map(ticket => (
              <Link
                key={ticket.id}
                to={`/portal/tickets/${ticket.id}`}
                className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {ticket.inbox.name} · Updated {new Date(ticket.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <PriorityBadge priority={ticket.priorityLevel as any} />
                  <StatusBadge status={ticket.status as any} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 text-center">
            <TicketIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">No tickets yet</p>
            <Link to="/portal/tickets/new">
              <Button className="mt-4">
                <PlusIcon className="w-4 h-4" />
                Create your first ticket
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
