import { ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { Badge } from '../ui/badge'
import type { GlobalSoftware, PortalSoftware, OrganizationSoftware } from '../../api/client'

type SoftwareItem = GlobalSoftware | PortalSoftware | OrganizationSoftware

interface SoftwareCardProps {
  software: SoftwareItem
  onClick?: () => void
  showAccessStatus?: boolean
}

export function SoftwareCard({ software, onClick, showAccessStatus = false }: SoftwareCardProps) {
  // Handle PortalSoftware which has access request info
  const portalSoftware = software as PortalSoftware
  const accessRequest = portalSoftware.myAccessRequest

  // Get software name, description, etc. - handle both OrganizationSoftware and flat software types
  const isOrgSoftware = 'software' in software && software.software
  const name = isOrgSoftware ? (software as OrganizationSoftware).software.name : (software as GlobalSoftware).name
  const description = isOrgSoftware ? (software as OrganizationSoftware).software.description : (software as GlobalSoftware).description
  const iconUrl = isOrgSoftware ? (software as OrganizationSoftware).software.iconUrl : (software as GlobalSoftware).iconUrl
  const vendor = isOrgSoftware ? (software as OrganizationSoftware).software.vendor : (software as GlobalSoftware).vendor
  const category = isOrgSoftware ? (software as OrganizationSoftware).software.category : (software as GlobalSoftware).category

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 ${onClick ? 'cursor-pointer hover:border-blue-500 hover:shadow-md transition-all' : ''}`}
    >
      <div className="flex items-start gap-3">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={name}
            className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <ComputerDesktopIcon className="w-6 h-6 text-zinc-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-white truncate">
              {name}
            </h3>
            {showAccessStatus && accessRequest && (
              <Badge
                color={
                  accessRequest.status === 'APPROVED' ? 'green' :
                  accessRequest.status === 'PENDING' ? 'amber' : 'red'
                }
              >
                {accessRequest.status === 'APPROVED' ? 'Access Granted' :
                 accessRequest.status === 'PENDING' ? 'Pending' : 'Declined'}
              </Badge>
            )}
          </div>

          {vendor && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {vendor}
            </p>
          )}

          {description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">
              {description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {category && (
              <Badge color="zinc">{category.name}</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
