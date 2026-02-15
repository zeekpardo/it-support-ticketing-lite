import { useState, useCallback } from 'react'

interface UseTabbedPageReturn<T extends string> {
  /** The currently active tab */
  active: T
  /** Set the active tab */
  set: (tab: T) => void
  /** Check if a specific tab is active */
  is: (tab: T) => boolean
}

/**
 * Reusable hook for tab state management in multi-tab pages.
 *
 * @example
 * ```ts
 * const tabs = useTabbedPage({
 *   tabs: ['general', 'email-rules', 'stages'] as const,
 *   defaultTab: 'general',
 * })
 *
 * // Usage
 * tabs.active        // 'general'
 * tabs.set('stages') // switch tab
 * tabs.is('general') // true/false
 * ```
 */
export function useTabbedPage<T extends string>(options: {
  tabs: readonly T[]
  defaultTab: T
}): UseTabbedPageReturn<T> {
  const [active, setActive] = useState<T>(options.defaultTab)

  const is = useCallback((tab: T) => active === tab, [active])

  return { active, set: setActive, is }
}
