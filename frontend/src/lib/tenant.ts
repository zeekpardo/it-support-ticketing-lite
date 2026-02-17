import { API_BASE } from '../api/base'

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'groovi.support'

export interface TenantInfo {
  organizationId: string
  slug: string
  appName: string
  primaryColor: string
  logo: string | null
  favicon: string | null
}

/**
 * Extract the tenant slug from the current hostname.
 * Returns null if we're on the main app domain, localhost, or an IP.
 *
 * Examples:
 *   acme.groovi.support → "acme"
 *   app.groovi.support  → null (main app)
 *   localhost            → null
 */
export function getTenantSlug(): string | null {
  const host = window.location.hostname.toLowerCase()

  // Skip localhost / IPs
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null
  }

  // Must end with base domain
  if (!host.endsWith(`.${BASE_DOMAIN}`)) {
    return null
  }

  const subdomain = host.slice(0, -(BASE_DOMAIN.length + 1))

  // Skip known service subdomains, empty, or multi-level
  if (!subdomain || subdomain.includes('.') || ['app', 'api', 'www'].includes(subdomain)) {
    return null
  }

  return subdomain
}

/**
 * Fetch tenant info from the backend. The tenant detection middleware
 * on the backend resolves the subdomain from the Host header automatically.
 */
export async function fetchTenantInfo(): Promise<TenantInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/tenant`, { credentials: 'include' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
