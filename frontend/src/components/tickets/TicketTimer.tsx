import { useState } from 'react'
import { useTimer } from '../../context/TimerContext'
import { formatTime, formatDuration } from '../../utils/time'
import { ClockIcon, StopIcon, PlayIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/button'

interface TimeEntry {
  id: string
  taskName: string
  startTime: string
  endTime?: string | null
  durationMins?: number | null
  isRunning: boolean
  user: {
    id: string
    name: string
  }
}

interface TicketTimerProps {
  ticketId: string
  timeEntries: TimeEntry[]
  totalMinutes: number
  onTimerStarted: () => void
  onTimerStopped: () => void
}

export function TicketTimer({ ticketId, timeEntries, totalMinutes, onTimerStarted, onTimerStopped }: TicketTimerProps) {
  const { runningTimer, elapsedSeconds, startTimer, stopTimer, isLoading, isPaused } = useTimer()
  const [historyOpen, setHistoryOpen] = useState(false)

  const isRunningOnThisTicket = runningTimer?.ticketId === ticketId
  const anotherTimerRunning = !!runningTimer && !isRunningOnThisTicket

  const handleStart = async () => {
    try {
      await startTimer(ticketId)
      onTimerStarted()
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStop = async () => {
    try {
      await stopTimer()
      onTimerStopped()
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Time Tracking
        </h3>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Total: <strong>{formatDuration(totalMinutes)}</strong>
        </span>
      </div>

      {isRunningOnThisTicket ? (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className={`font-mono text-xl font-bold text-green-700 dark:text-green-300 ${isPaused ? 'opacity-50' : ''}`}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <Button
              onClick={handleStop}
              disabled={isLoading}
              color="red"
              className="flex items-center gap-1"
            >
              <StopIcon className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Timer stopped</span>
          <Button
            onClick={handleStart}
            disabled={isLoading || anotherTimerRunning}
            outline
            className="flex items-center gap-1"
            title={anotherTimerRunning ? 'Another timer is running' : undefined}
          >
            <PlayIcon className="w-4 h-4" />
            Start
          </Button>
        </div>
      )}

      <div>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center justify-between w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        >
          <span>History ({timeEntries.filter(e => !e.isRunning).length} entries)</span>
          <ChevronUpIcon className={`w-4 h-4 transition-transform ${historyOpen ? '' : 'rotate-180'}`} />
        </button>

        {historyOpen && (
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {timeEntries.filter(e => !e.isRunning).length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2 text-center">
                No time entries yet
              </p>
            ) : (
              timeEntries
                .filter(e => !e.isRunning)
                .map(entry => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {entry.user.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(entry.startTime).toLocaleString()}
                          {entry.endTime && ` - ${new Date(entry.endTime).toLocaleTimeString()}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {entry.durationMins ? formatDuration(entry.durationMins) : '-'}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
