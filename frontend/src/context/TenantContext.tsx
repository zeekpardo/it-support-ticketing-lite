import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getTenantSlug, fetchTenantInfo, type TenantInfo } from '../lib/tenant'

interface TenantContextType {
  /** The tenant slug extracted from the subdomain, or null */
  slug: string | null
  /** Whether we're on an org subdomain (not the main app) */
  isSubdomain: boolean
  /** Tenant info fetched from backend (branding + orgId) */
  tenant: TenantInfo | null
  /** True while fetching tenant info */
  loading: boolean
}

const TenantContext = createContext<TenantContextType>({
  slug: null,
  isSubdomain: false,
  tenant: null,
  loading: false,
})

const DEFAULT_PRIMARY_COLOR = '#2563eb'

function darkenColor(hex: string, percent = 12): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent))
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent))
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [slug] = useState(() => getTenantSlug())
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(!!slug)

  useEffect(() => {
    if (!slug) return

    fetchTenantInfo().then((info) => {
      setTenant(info)
      setLoading(false)
    })
  }, [slug])

  // Apply tenant branding to document (for login/register pages before auth)
  useEffect(() => {
    if (!tenant) return

    const root = document.documentElement
    const color = tenant.primaryColor || DEFAULT_PRIMARY_COLOR
    root.style.setProperty('--color-primary', color)
    root.style.setProperty('--color-primary-hover', darkenColor(color))
    document.title = tenant.appName

    if (tenant.favicon) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = tenant.favicon
    }
  }, [tenant])

  return (
    <TenantContext.Provider value={{ slug, isSubdomain: !!slug, tenant, loading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
