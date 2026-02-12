import { Badge } from '../ui/badge'

interface AccessRequestStatusBadgeProps {
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
}

const statusConfig = {
  PENDING: { color: 'amber' as const, label: 'Pending' },
  APPROVED: { color: 'green' as const, label: 'Approved' },
  DECLINED: { color: 'red' as const, label: 'Declined' },
  REVOKED: { color: 'zinc' as const, label: 'Revoked' }
}

export function AccessRequestStatusBadge({ status }: AccessRequestStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING

  return <Badge color={config.color}>{config.label}</Badge>
}

export const ACCESS_REQUEST_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'REVOKED', label: 'Revoked' }
] as const
