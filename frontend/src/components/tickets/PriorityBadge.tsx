import { Badge } from '../ui/badge'

interface PriorityBadgeProps {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

const priorityConfig = {
  LOW: { color: 'zinc' as const, label: 'Low' },
  MEDIUM: { color: 'blue' as const, label: 'Medium' },
  HIGH: { color: 'amber' as const, label: 'High' },
  URGENT: { color: 'red' as const, label: 'Urgent' }
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.MEDIUM

  return <Badge color={config.color}>{config.label}</Badge>
}
