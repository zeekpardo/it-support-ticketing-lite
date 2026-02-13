import { useState, useEffect, useCallback, useRef, type DependencyList } from 'react'

interface UseAsyncOptions {
  /** Whether to run the async function immediately on mount. Defaults to true. */
  immediate?: boolean
}

interface UseAsyncReturn<T> {
  data: T | null
  loading: boolean
  error: Error | null
  /** Manually trigger the async function. */
  refetch: () => Promise<void>
  /** Directly update the data state (useful for optimistic updates). */
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/**
 * A hook that manages the loading/error/data lifecycle for an async function.
 *
 * @param asyncFn - An async function that returns the data.
 * @param deps - Dependency array. The async function re-runs when these change (like useEffect).
 * @param options - Optional configuration.
 *
 * @example
 * ```ts
 * const { data, loading, error, refetch } = useAsync(
 *   () => api.getPortalDashboard(),
 *   [currentOrg]
 * )
 * ```
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList = [],
  options: UseAsyncOptions = {}
): UseAsyncReturn<T> {
  const { immediate = true } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<Error | null>(null)

  // Track whether the component is still mounted to prevent state updates after unmount.
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn()
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        console.error(error)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (immediate) {
      execute()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute])

  return { data, loading, error, refetch: execute, setData }
}
