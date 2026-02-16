import { Badge } from '@/components/ui/badge'

export function getMatchTypeBadge(matchType: string) {
  switch (matchType) {
    case 'EXACT_ADDRESS':
      return <Badge color="blue">Exact Address</Badge>
    case 'DOMAIN':
      return <Badge color="purple">Domain</Badge>
    case 'CATCH_ALL':
      return <Badge color="amber">Catch-All</Badge>
    default:
      return <Badge color="zinc">{matchType}</Badge>
  }
}

export function getMatchTypeDescription(matchType: string) {
  switch (matchType) {
    case 'EXACT_ADDRESS':
      return 'Matches exact recipient email address (e.g., support@groovi.support)'
    case 'DOMAIN':
      return 'Matches sender domain (e.g., @clientdomain.com)'
    case 'CATCH_ALL':
      return 'Matches any email not caught by other rules'
    default:
      return ''
  }
}
