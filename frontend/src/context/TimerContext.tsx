import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { api } from '../api/client'
import { useOrganization } from './OrganizationContext'

interface RunningTimer {
  id: string
  ticketId?: string | null
  projectId?: string
  taskName?: string
  startTime: string
  ticket?: {
    id: string
    subject: string
    project?: {
      id: string
      name: string
      projectCode: string
    }
  } | null
  project?: {
    id: string
    name: string
    projectCode: string
  }
}

interface TimerContextType {
  runningTimer: RunningTimer | null
  elapsedSeconds: number
  isLoading: boolean
  isPaused: boolean
  startTimer: (ticketId: string) => Promise<void>
  stopTimer: () => Promise<void>
  pauseTimer: () => void
  resumeTimer: () => void
  refreshTimer: () => Promise<void>
}

const TimerContext = createContext<TimerContextType | null>(null)

export function TimerProvider({ children }: { children: ReactNode }) {
  const { currentOrg, isClient } = useOrganization()
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [pausedElapsed, setPausedElapsed] = useState(0)

  const fetchRunningTimer = useCallback(async () => {
    if (!currentOrg || isClient) {
      setRunningTimer(null)
      return
    }

    try {
      const timer = await api.getRunningTimer()
      setRunningTimer(timer)
      if (timer) {
        const startTime = new Date(timer.startTime).getTime()
        const now = Date.now()
        setElapsedSeconds(Math.floor((now - startTime) / 1000))
        setIsPaused(false)
        setPausedAt(null)
        setPausedElapsed(0)
      } else {
        setElapsedSeconds(0)
      }
    } catch (error) {
      console.error('Failed to fetch running timer:', error)
      setRunningTimer(null)
    }
  }, [currentOrg, isClient])

  // Fetch running timer on org change
  useEffect(() => {
    fetchRunningTimer()
  }, [fetchRunningTimer])

  // Update elapsed time every second
  useEffect(() => {
    if (!runningTimer || isPaused) return

    const interval = setInterval(() => {
      const startTime = new Date(runningTimer.startTime).getTime()
      const now = Date.now()
      setElapsedSeconds(Math.floor((now - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [runningTimer, isPaused])

  const startTimer = async (ticketId: string) => {
    setIsLoading(true)
    try {
      await api.startTicketTimer(ticketId)
      // Fetch the full timer data including ticket info
      await fetchRunningTimer()
    } catch (error) {
      console.error('Failed to start timer:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const stopTimer = async () => {
    if (!runningTimer) return

    setIsLoading(true)
    try {
      await api.stopTimer(runningTimer.id)
      setRunningTimer(null)
      setElapsedSeconds(0)
      setIsPaused(false)
      setPausedAt(null)
      setPausedElapsed(0)
    } catch (error) {
      console.error('Failed to stop timer:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Client-side pause (doesn't affect backend)
  const pauseTimer = () => {
    if (!runningTimer || isPaused) return
    setIsPaused(true)
    setPausedAt(Date.now())
    setPausedElapsed(elapsedSeconds)
  }

  // Client-side resume
  const resumeTimer = () => {
    if (!runningTimer || !isPaused) return
    setIsPaused(false)
    setPausedAt(null)
    // Elapsed will recalculate from startTime on next interval tick
  }

  return (
    <TimerContext.Provider
      value={{
        runningTimer,
        elapsedSeconds: isPaused ? pausedElapsed : elapsedSeconds,
        isLoading,
        isPaused,
        startTimer,
        stopTimer,
        pauseTimer,
        resumeTimer,
        refreshTimer: fetchRunningTimer
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}
