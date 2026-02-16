// ==========================================
// Software Catalog Types
// ==========================================

export interface SoftwareCategory {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  _count?: { software: number }
}

export interface GlobalSoftware {
  id: string
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
  category?: SoftwareCategory
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedById?: string
  submittedBy?: { id: string; name: string; email: string }
  createdAt: string
  updatedAt: string
  _count?: { inboxSoftware: number }
}

export interface InboxSoftware {
  id: string
  inboxId: string
  softwareId: string
  software: GlobalSoftware
  notes?: string
  addedBy: {
    id: string
    user: { id: string; name: string; email: string }
  }
  createdAt: string
  updatedAt: string
  _count?: { admins: number; accessRequests: number }

  // Renewal & Billing
  renewalDate?: string | null
  billingCycle?: 'MONTHLY' | 'YEARLY' | null
  cost?: string | null
  costType?: 'PER_USER' | 'PER_ORGANIZATION' | null
  autoRenewal?: boolean

  // License Management
  licenseType?: 'PER_SEAT' | 'ENTERPRISE' | 'FREE' | 'OTHER' | null
  totalSeats?: number | null

  // Vendor & Contract Info
  vendorContactEmail?: string | null
  vendorContactPhone?: string | null
  contractUrl?: string | null
  loginUrl?: string | null
}

export interface SoftwareBudgetSummary {
  totalMonthly: number
  totalYearly: number
  softwareCount: number
  breakdown: Array<{
    id: string
    name: string
    iconUrl?: string
    cost: number
    costType: 'PER_USER' | 'PER_ORGANIZATION' | null
    billingCycle: 'MONTHLY' | 'YEARLY' | null
    users: number
    effectiveCost: number
    monthly: number
    yearly: number
    renewalDate?: string | null
    autoRenewal: boolean
  }>
}

export interface InboxSoftwareAdmin {
  id: string
  inboxSoftwareId: string
  memberId: string
  member: {
    id: string
    user: { id: string; name: string; email: string }
  }
  role: 'OWNER' | 'ADMIN'
  createdAt: string
}

export interface SoftwareAccessRequest {
  id: string
  inboxSoftwareId: string
  requesterId: string
  requester: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reason?: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
  assigneeId?: string
  assignee?: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reviewerId?: string
  reviewer?: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

export interface InboxSoftwareDetail extends InboxSoftware {
  admins: InboxSoftwareAdmin[]
  accessRequests: SoftwareAccessRequest[]
}

export interface PortalSoftware {
  id: string
  softwareId: string
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  category?: { id: string; name: string }
  notes?: string
  myAccessRequest?: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
    createdAt: string
  } | null
}

export interface PortalAccessRequest {
  id: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
  reason?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
  inboxSoftwareId: string
  inbox: { id: string; name: string; inboxCode: string }
  software: { id: string; name: string; iconUrl?: string; vendor?: string }
  reviewer?: { id: string; user: { name: string } }
}

// ==========================================
// Ticket Stage Types
// ==========================================

export interface TicketStage {
  id: string
  inboxId: string
  name: string
  slug: string
  color: string
  position: number
  isDefault: boolean
  isResolved: boolean
  createdAt?: string
  updatedAt?: string
  _count?: { tickets: number }
}

// ==========================================
// Notification Types
// ==========================================

export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_comment'
  | 'ticket_comment_client'
  | 'mention'
  | 'mention_client'
  | 'ticket_status_changed'
  | 'access_request_submitted'
  | 'access_request_approved'
  | 'access_request_declined'
  | 'access_request_revoked'

export interface Notification {
  id: string
  organizationId: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  readAt?: string
  createdAt: string
  entityType?: string
  entityId?: string
}

// ==========================================
// Compatibility Type Aliases
// ==========================================
// These types are referenced across the codebase as aliases
// for the inbox-level types, or as extended variants.

/** Organization software is the same shape as InboxSoftware */
export type OrganizationSoftware = InboxSoftware

/** Organization software detail is the same shape as InboxSoftwareDetail */
export type OrganizationSoftwareDetail = InboxSoftwareDetail

/** SoftwareAdmin is the same shape as InboxSoftwareAdmin with optional image */
export interface SoftwareAdmin {
  id: string
  inboxSoftwareId: string
  memberId: string
  member: {
    id: string
    user: { id: string; name: string; email: string; image?: string }
  }
  role: 'OWNER' | 'ADMIN'
  createdAt: string
}

/** GlobalSoftware with an additional flag indicating if it's already added */
export interface GlobalSoftwareWithStatus extends GlobalSoftware {
  isAdded?: boolean
}

/** Generic software type used in forms */
export interface Software {
  id?: string
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
  notes?: string
}

/** Portal software detail extends PortalSoftware with additional fields */
export interface PortalSoftwareDetail extends PortalSoftware {
  loginUrl?: string
  admins?: Array<{
    id: string
    role: string
    member: {
      id: string
      user: { id: string; name: string; email: string }
    }
  }>
}

/** Access request as viewed from the portal (my requests) */
export type MyAccessRequest = PortalAccessRequest
