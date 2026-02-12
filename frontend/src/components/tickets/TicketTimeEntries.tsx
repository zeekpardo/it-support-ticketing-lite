import { ClockIcon, PlayIcon } from '@heroicons/react/24/outline'
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

interface TicketTimeEntriesProps {
  timeEntries: TimeEntry[]
  totalMinutes: number
  onStartTimer: () => Promise<void>
  hasRunningTimer?: boolean
  isLoading?: boolean
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

export function TicketTimeEntries({
  timeEntries,
  totalMinutes,
  onStartTimer,
  hasRunningTimer,
  isLoading
}: TicketTimeEntriesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Time Tracking
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Total: <strong>{formatDuration(totalMinutes)}</strong>
          </span>
          <Button
            onClick={onStartTimer}
            disabled={hasRunningTimer || isLoading}
            outline
            className="flex items-center gap-1"
          >
            <PlayIcon className="w-4 h-4" />
            Start Timer
          </Button>
        </div>
      </div>

      {timeEntries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
          No time entries yet
        </p>
      ) : (
        <div className="space-y-2">
          {timeEntries.map(entry => (
            <div
              key={entry.id}
              className={`p-3 rounded-lg border ${
                entry.isRunning
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
              }`}
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
                <div className="text-right">
                  {entry.isRunning ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Running
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {entry.durationMins ? formatDuration(entry.durationMins) : '-'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
