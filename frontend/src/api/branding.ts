import { request, upload } from './base'

// ==========================================
// Branding
// ==========================================

export interface Branding {
  appName: string
  primaryColor: string
  logoUrl: string | null
  faviconUrl: string | null
}

export async function getBranding() {
  return request<Branding>('/branding')
}

export async function updateBranding(data: { appName?: string; primaryColor?: string }) {
  return request<Branding>('/branding', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function uploadLogo(file: File) {
  const formData = new FormData()
  formData.append('logo', file)
  return upload<Branding>('/branding/logo', formData)
}

export async function removeLogo() {
  return request<Branding>('/branding/logo', { method: 'DELETE' })
}

export async function uploadFavicon(file: File) {
  const formData = new FormData()
  formData.append('favicon', file)
  return upload<Branding>('/branding/favicon', formData)
}

export async function removeFavicon() {
  return request<Branding>('/branding/favicon', { method: 'DELETE' })
}
