// Use environment variable for API URL in production, fallback to relative path for dev
const apiBaseUrl = import.meta.env.VITE_API_URL || ''
export const API_BASE = apiBaseUrl ? `${apiBaseUrl}/api` : '/api'

export interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
}

let organizationId: string | null = null

export function setOrganizationId(orgId: string | null) {
  organizationId = orgId
}

export function getOrganizationId(): string | null {
  return organizationId
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (organizationId) {
    headers['X-Organization-Id'] = organizationId
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  // Handle CSV/file downloads
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('text/csv')) {
    return response.blob() as unknown as T
  }

  return response.json()
}

export async function publicRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

export async function upload<T>(endpoint: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {}

  if (organizationId) {
    headers['X-Organization-Id'] = organizationId
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include'
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || 'Upload failed')
  }

  return response.json()
}

export async function publicUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || 'Upload failed')
  }

  return response.json()
}
