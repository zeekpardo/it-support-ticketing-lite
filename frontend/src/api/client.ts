/**
 * API Client - Backward-compatible wrapper
 *
 * This file maintains the original `api` class instance that the entire app
 * imports. Internally it delegates to the domain-specific modules in this
 * directory. New code can import directly from the modules or from the
 * barrel `index.ts`.
 *
 * Modules:
 *   base.ts          - shared request/upload helpers, org-id state
 *   types.ts         - all shared TypeScript types
 *   inboxes.ts       - inbox CRUD, stages
 *   tickets.ts       - ticket & time-entry CRUD, comments, attachments
 *   members.ts       - member management, inbox assignments, profile
 *   software.ts      - software catalog, inbox software, access requests
 *   reports.ts       - report generation endpoints
 *   notifications.ts - notification CRUD, unread count
 *   portal.ts        - portal-specific endpoints
 *   superAdmin.ts    - super-admin user management
 */

// Re-export every type so existing `import { SomeType } from '../api/client'` keeps working
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

export type { SuperAdminAccount, SuperAdminAccountMember, AccountInbox } from './superAdmin'
export type { RequestOptions } from './base'

// Import base helpers (used by the class)
import { setOrganizationId, request, upload } from './base'

// Import all module functions
import * as inboxesApi from './inboxes'
import * as ticketsApi from './tickets'
import * as membersApi from './members'
import * as softwareApi from './software'
import * as reportsApi from './reports'
import * as notificationsApi from './notifications'
import * as portalApi from './portal'
import * as superAdminApi from './superAdmin'

// Re-export the Notification type as a value-compatible import
// (some files do `import { Notification } from '../api/client'`)
import type { Notification as _Notification } from './types'

/**
 * ApiClient class - preserved for backward compatibility.
 * Every method delegates to the corresponding standalone module function.
 */
class ApiClient {
  setOrganizationId(orgId: string | null) {
    setOrganizationId(orgId)
  }

  // Expose request/upload for any code that calls api.request() or api.upload() directly
  request = request
  upload = upload

  // === Time Entries ===
  getTimeEntries = ticketsApi.getTimeEntries
  getTimeEntry = ticketsApi.getTimeEntry
  createTimeEntry = ticketsApi.createTimeEntry
  updateTimeEntry = ticketsApi.updateTimeEntry
  deleteTimeEntry = ticketsApi.deleteTimeEntry
  stopTimer = ticketsApi.stopTimer

  // === Inboxes ===
  getInboxes = inboxesApi.getInboxes
  getInbox = inboxesApi.getInbox
  createInbox = inboxesApi.createInbox
  updateInbox = inboxesApi.updateInbox
  deleteInbox = inboxesApi.deleteInbox
  getInboxStats = inboxesApi.getInboxStats

  // === Client Signup Links ===
  generateSignupLink = inboxesApi.generateSignupLink
  toggleSignupLink = inboxesApi.toggleSignupLink
  deleteSignupLink = inboxesApi.deleteSignupLink

  // === Inbox Stages ===
  getInboxStages = inboxesApi.getInboxStages
  createStage = inboxesApi.createStage
  updateStage = inboxesApi.updateStage
  reorderStages = inboxesApi.reorderStages
  deleteStage = inboxesApi.deleteStage

  // === Reports ===
  getReportSummary = reportsApi.getReportSummary
  exportTimeEntries = reportsApi.exportTimeEntries
  getBillingReport = reportsApi.getBillingReport

  // === Tickets (Staff) ===
  getTickets = ticketsApi.getTickets
  getTicket = ticketsApi.getTicket
  createTicket = ticketsApi.createTicket
  updateTicket = ticketsApi.updateTicket
  updateTicketStatus = ticketsApi.updateTicketStatus
  updateTicketStage = ticketsApi.updateTicketStage
  assignTicket = ticketsApi.assignTicket
  deleteTicket = ticketsApi.deleteTicket

  // Ticket Comments
  getTicketComments = ticketsApi.getTicketComments
  addTicketComment = ticketsApi.addTicketComment
  getTicketMentionableMembers = ticketsApi.getTicketMentionableMembers

  // Ticket Time Entries
  getTicketTimeEntries = ticketsApi.getTicketTimeEntries
  startTicketTimer = ticketsApi.startTicketTimer

  // Ticket Attachments
  getTicketAttachments = ticketsApi.getTicketAttachments
  deleteTicketAttachment = ticketsApi.deleteTicketAttachment
  uploadTicketAttachments = ticketsApi.uploadTicketAttachments
  uploadInlineImage = ticketsApi.uploadInlineImage

  // === Portal (Client) ===
  getPortalInboxes = portalApi.getPortalInboxes
  getPortalDashboard = portalApi.getPortalDashboard
  getPortalTickets = portalApi.getPortalTickets
  getPortalTicket = portalApi.getPortalTicket
  submitPortalTicket = portalApi.submitPortalTicket
  uploadPortalTicketAttachments = portalApi.uploadPortalTicketAttachments
  addPortalMessage = portalApi.addPortalMessage
  uploadPortalInlineImage = portalApi.uploadPortalInlineImage
  getPortalTicketMentionableMembers = portalApi.getPortalTicketMentionableMembers

  // === Members ===
  createUserAndAddToOrg = membersApi.createUserAndAddToOrg
  getStaffMembers = membersApi.getStaffMembers
  getClients = membersApi.getClients
  getClientDetail = membersApi.getClientDetail
  updateClient = membersApi.updateClient
  getMemberInboxes = membersApi.getMemberInboxes
  assignInbox = membersApi.assignInbox
  unassignInbox = membersApi.unassignInbox
  updateMemberInboxes = membersApi.updateMemberInboxes
  getInvitationInboxes = membersApi.getInvitationInboxes
  saveInvitationInboxes = membersApi.saveInvitationInboxes
  getProfile = membersApi.getProfile
  updateProfile = membersApi.updateProfile
  uploadAvatar = membersApi.uploadAvatar
  removeAvatar = membersApi.removeAvatar
  getAvatarUrl = membersApi.getAvatarUrl

  // === Super Admin ===
  getSuperAdminUsers = superAdminApi.getSuperAdminUsers

  // Super Admin - Accounts
  getSuperAdminAccounts = superAdminApi.getSuperAdminAccounts
  getSuperAdminAccountMembers = superAdminApi.getSuperAdminAccountMembers
  updateSuperAdminAccount = superAdminApi.updateSuperAdminAccount
  updateSuperAdminAccountMember = superAdminApi.updateSuperAdminAccountMember
  deleteSuperAdminAccount = superAdminApi.deleteSuperAdminAccount
  getSuperAdminAccountInboxes = superAdminApi.getSuperAdminAccountInboxes
  updateSuperAdminMemberInboxes = superAdminApi.updateSuperAdminMemberInboxes
  removeSuperAdminAccountMember = superAdminApi.removeSuperAdminAccountMember

  // === Super Admin - Software Catalog ===
  getSuperAdminSoftware = softwareApi.getSuperAdminSoftware
  getSuperAdminSoftwareById = softwareApi.getSuperAdminSoftwareById
  createSuperAdminSoftware = softwareApi.createSuperAdminSoftware
  updateSuperAdminSoftware = softwareApi.updateSuperAdminSoftware
  uploadSoftwareIcon = softwareApi.uploadSoftwareIcon
  deleteSuperAdminSoftware = softwareApi.deleteSuperAdminSoftware
  approveSoftware = softwareApi.approveSoftware
  rejectSoftware = softwareApi.rejectSoftware

  // Super Admin Categories
  getSuperAdminCategories = softwareApi.getSuperAdminCategories
  createSuperAdminCategory = softwareApi.createSuperAdminCategory
  updateSuperAdminCategory = softwareApi.updateSuperAdminCategory
  deleteSuperAdminCategory = softwareApi.deleteSuperAdminCategory

  // === Inbox Software (Admin) ===
  getGlobalCatalog = softwareApi.getGlobalCatalog
  getGlobalCatalogCategories = softwareApi.getGlobalCatalogCategories
  submitNewSoftware = softwareApi.submitNewSoftware
  getInboxSoftware = softwareApi.getInboxSoftware
  getInboxSoftwareById = softwareApi.getInboxSoftwareById
  addSoftwareToInbox = softwareApi.addSoftwareToInbox
  updateInboxSoftware = softwareApi.updateInboxSoftware
  getInboxSoftwareBudget = softwareApi.getInboxSoftwareBudget
  removeInboxSoftware = softwareApi.removeInboxSoftware

  // Inbox software admins
  getInboxSoftwareAdmins = softwareApi.getInboxSoftwareAdmins
  addInboxSoftwareAdmin = softwareApi.addInboxSoftwareAdmin
  updateInboxSoftwareAdmin = softwareApi.updateInboxSoftwareAdmin
  removeInboxSoftwareAdmin = softwareApi.removeInboxSoftwareAdmin

  // Inbox software access requests
  getInboxSoftwareRequests = softwareApi.getInboxSoftwareRequests
  getAllInboxRequests = softwareApi.getAllInboxRequests
  getAllPendingAccessRequests = softwareApi.getAllPendingAccessRequests
  assignAccessRequest = softwareApi.assignAccessRequest
  reviewAccessRequest = softwareApi.reviewAccessRequest
  deleteAccessRequest = softwareApi.deleteAccessRequest

  // === Portal Software ===
  getPortalInboxSoftware = portalApi.getPortalInboxSoftware
  getPortalInboxSoftwareById = portalApi.getPortalInboxSoftwareById
  getPortalSoftwareCategories = portalApi.getPortalSoftwareCategories
  submitPortalAccessRequest = portalApi.submitPortalAccessRequest
  getPortalMyRequests = portalApi.getPortalMyRequests

  // === Import ===
  importClients = membersApi.importClients

  // === Notifications ===
  getNotifications = notificationsApi.getNotifications
  getUnreadNotificationCount = notificationsApi.getUnreadNotificationCount
  markNotificationAsRead = notificationsApi.markNotificationAsRead
  markAllNotificationsAsRead = notificationsApi.markAllNotificationsAsRead
  deleteNotification = notificationsApi.deleteNotification
}

export const api = new ApiClient()
