import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useOrganization } from './OrganizationContext'
import { getBranding, type Branding } from '../api/branding'

const DEFAULT_APP_NAME = 'Groovi Support'
const DEFAULT_PRIMARY_COLOR = '#2563eb'

interface BrandingContextType {
  branding: Branding
  loading: boolean
  refresh: () => Promise<void>
}

const defaultBranding: Branding = {
  appName: DEFAULT_APP_NAME,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  logoUrl: null,
  faviconUrl: null,
}

const BrandingContext = createContext<BrandingContextType | null>(null)

/**
 * Darken a hex color by a percentage (used for hover states).
 */
function darkenColor(hex: string, percent = 12): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent))
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent))
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization()
  const [branding, setBranding] = useState<Branding>(defaultBranding)
  const [loading, setLoading] = useState(false)

  const loadBranding = useCallback(async () => {
    if (!currentOrg) {
      setBranding(defaultBranding)
      return
    }

    try {
      setLoading(true)
      const data = await getBranding()
      setBranding(data)
    } catch (err) {
      console.error('[Branding] Failed to load:', err)
      setBranding(defaultBranding)
    } finally {
      setLoading(false)
    }
  }, [currentOrg?.id])

  // Reload branding when org changes
  useEffect(() => {
    loadBranding()
  }, [loadBranding])

  // Apply primary color CSS variables
  useEffect(() => {
    const root = document.documentElement
    const color = branding.primaryColor || DEFAULT_PRIMARY_COLOR
    root.style.setProperty('--color-primary', color)
    root.style.setProperty('--color-primary-hover', darkenColor(color))

    return () => {
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-hover')
    }
  }, [branding.primaryColor])

  // Set document title
  useEffect(() => {
    document.title = branding.appName || DEFAULT_APP_NAME
  }, [branding.appName])

  // Set favicon
  useEffect(() => {
    if (!branding.faviconUrl) return

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    const originalHref = link.href
    link.href = branding.faviconUrl

    return () => {
      link!.href = originalHref
    }
  }, [branding.faviconUrl])

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh: loadBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}
