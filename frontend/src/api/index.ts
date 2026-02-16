/**
 * API barrel export
 *
 * Re-exports the backward-compatible `api` class instance plus all types
 * and all domain-specific module functions for direct imports.
 *
 * Usage (existing - still works):
 *   import { api } from '../api/client'
 *   import { api, SoftwareCategory } from '../api/client'
 *
 * Usage (new - preferred for new code):
 *   import { api } from '../api'
 *   import { getInboxes, createInbox } from '../api/inboxes'
 *   import type { TicketStage } from '../api/types'
 */

// Backward-compatible class instance
export { api } from './client'

// Shared base utilities
export { request, upload, setOrganizationId, getOrganizationId } from './base'
export type { RequestOptions } from './base'

// All types
export type {
  SoftwareCategory,
  GlobalSoftware,
  InboxSoftware,
  SoftwareBudgetSummary,
  InboxSoftwareAdmin,
  SoftwareAccessRequest,
  InboxSoftwareDetail,
  PortalSoftware,
  PortalAccessRequest,
  TicketStage,
  NotificationType,
  Notification,
  OrganizationSoftware,
  OrganizationSoftwareDetail,
  SoftwareAdmin,
  GlobalSoftwareWithStatus,
  Software,
  PortalSoftwareDetail,
  MyAccessRequest
} from './types'

// Domain modules (namespace imports for grouped access)
export * as inboxesApi from './inboxes'
export * as ticketsApi from './tickets'
export * as membersApi from './members'
export * as softwareApi from './software'
export * as reportsApi from './reports'
export * as notificationsApi from './notifications'
export * as portalApi from './portal'
export * as superAdminApi from './superAdmin'
export * as brandingApi from './branding'
