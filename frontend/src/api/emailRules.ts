import { request } from './base'

export interface EmailRule {
  id: string
  organizationId: string
  projectId: string
  matchType: 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL'
  matchValue: string | null
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  project?: {
    id: string
    name: string
    projectCode: string
  }
  _count?: {
    inboundEmails: number
  }
}

export interface InboundEmail {
  id: string
  messageId: string
  inReplyTo: string | null
  subject: string
  from: string
  fromName: string | null
  to: string
  htmlBody: string | null
  textBody: string | null
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED'
  processingError: string | null
  emailRuleId: string | null
  ticketId: string | null
  commentId: string | null
  receivedAt: string
  processedAt: string | null
  emailRule?: {
    id: string
    matchType: string
    matchValue: string | null
    project: {
      id: string
      name: string
    }
  }
  ticket?: {
    id: string
    subject: string
  }
  comment?: {
    id: string
    ticketId: string
  }
}

export interface CreateEmailRuleData {
  projectId: string
  matchType: 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL'
  matchValue?: string
  priority?: number
}

export interface UpdateEmailRuleData {
  matchType?: 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL'
  matchValue?: string
  priority?: number
  isActive?: boolean
}

export const emailRulesApi = {
  /**
   * Get all email rules for the organization
   */
  async getEmailRules(): Promise<EmailRule[]> {
    return request<EmailRule[]>('/email-rules')
  },

  /**
   * Create a new email rule
   */
  async createEmailRule(data: CreateEmailRuleData): Promise<EmailRule> {
    return request<EmailRule>('/email-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Update an email rule
   */
  async updateEmailRule(id: string, data: UpdateEmailRuleData): Promise<EmailRule> {
    return request<EmailRule>(`/email-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete an email rule
   */
  async deleteEmailRule(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/email-rules/${id}`, {
      method: 'DELETE',
    })
  },

  /**
   * Get inbound email logs
   */
  async getInboundLogs(params?: { status?: string; limit?: number }): Promise<InboundEmail[]> {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.limit) queryParams.append('limit', params.limit.toString())

    const queryString = queryParams.toString()
    return request<InboundEmail[]>(`/email-rules/inbound-logs${queryString ? `?${queryString}` : ''}`)
  },
}
