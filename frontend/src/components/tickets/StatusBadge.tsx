import { Badge } from '../ui/badge'

interface StatusBadgeProps {
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
}

const statusConfig = {
  NEW_REQUEST: { color: 'purple' as const, label: 'New' },
  IN_PROGRESS: { color: 'blue' as const, label: 'In Progress' },
  WAITING_FOR_INFO: { color: 'amber' as const, label: 'Waiting' },
  REVIEW: { color: 'cyan' as const, label: 'Review' },
  RESOLVED: { color: 'green' as const, label: 'Resolved' }
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.NEW_REQUEST

  return <Badge color={config.color}>{config.label}</Badge>
}

export const TICKET_STATUSES = [
  { value: 'NEW_REQUEST', label: 'New Requests' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_INFO', label: 'Waiting for Info' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'RESOLVED', label: 'Resolved' }
] as const
