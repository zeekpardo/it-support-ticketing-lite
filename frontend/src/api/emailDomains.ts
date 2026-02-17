import { request } from './base'

// ==========================================
// Email Domains
// ==========================================

export interface DnsRecord {
  record_type: string
  name: string
  value: string
  ttl: string
  status: string
  priority?: number
}

export interface EmailDomain {
  id: string
  organizationId: string
  domain: string
  resendDomainId: string
  status: 'PENDING' | 'VERIFIED' | 'FAILED'
  dnsRecords: DnsRecord[] | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrgDefaults {
  defaultEmailDomainId: string | null
  defaultFromUser: string | null
  defaultFromName: string | null
}

export interface EmailDomainsResponse {
  domains: EmailDomain[]
  orgDefaults: OrgDefaults
}

export async function getEmailDomains() {
  return request<EmailDomainsResponse>('/email-domains')
}

export async function addEmailDomain(domain: string) {
  return request<EmailDomain>('/email-domains', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  })
}

export async function verifyEmailDomain(id: string) {
  return request<EmailDomain>(`/email-domains/${id}/verify`, {
    method: 'POST',
  })
}

export async function refreshEmailDomain(id: string) {
  return request<EmailDomain>(`/email-domains/${id}/refresh`, {
    method: 'POST',
  })
}

export async function removeEmailDomain(id: string) {
  return request<{ success: boolean }>(`/email-domains/${id}`, {
    method: 'DELETE',
  })
}

export async function setDefaultDomain(id: string) {
  return request<{ success: boolean }>(`/email-domains/${id}/set-default`, {
    method: 'PUT',
  })
}

export async function clearDefaultDomain() {
  return request<{ success: boolean }>('/email-domains/org-default', {
    method: 'DELETE',
  })
}

export async function updateOrgDefaults(data: { defaultFromUser?: string; defaultFromName?: string }) {
  return request<OrgDefaults>('/email-domains/org-defaults', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
