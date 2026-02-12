import { useNavigate } from 'react-router-dom'
import { useTimer } from '../context/TimerContext'
import { PlayIcon, PauseIcon, StopIcon, ClockIcon } from '@heroicons/react/24/solid'
import { Button } from '@/components/ui/button'

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function TimerBanner() {
  const navigate = useNavigate()
  const {
    runningTimer,
    elapsedSeconds,
    isLoading,
    isPaused,
    stopTimer,
    pauseTimer,
    resumeTimer
  } = useTimer()

  if (!runningTimer) return null

  const ticketSubject = runningTimer.ticket?.subject || runningTimer.taskName || 'Timer'
  const projectName = runningTimer.ticket?.project?.name || runningTimer.project?.name

  const handleNavigateToTicket = () => {
    if (runningTimer.ticket && runningTimer.ticket.project) {
      navigate(`/projects/${runningTimer.ticket.project.id}/tickets/${runningTimer.ticket.id}`)
    }
  }

  const handleStop = async () => {
    try {
      await stopTimer()
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  return (
    <div className="flex items-center justify-between bg-green-600 px-4 py-2 text-sm font-medium text-white">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5" />
          <span
            className={`font-mono text-lg font-bold ${isPaused ? 'opacity-50' : ''}`}
          >
            {formatTime(elapsedSeconds)}
          </span>
          {isPaused && (
            <span className="rounded bg-green-800 px-2 py-0.5 text-xs">PAUSED</span>
          )}
        </div>
        <span className="text-green-200">|</span>
        <div className="flex items-center gap-2">
          {projectName && (
            <>
              <span className="text-green-200">{projectName}</span>
              <span className="text-green-300">/</span>
            </>
          )}
          <button
            onClick={handleNavigateToTicket}
            className="hover:underline focus:outline-none"
            disabled={!runningTimer.ticket}
          >
            {ticketSubject}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPaused ? (
          <Button
            onClick={resumeTimer}
            disabled={isLoading}
            className="!bg-green-700 !text-white hover:!bg-green-800 !py-1 !px-3"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            Resume
          </Button>
        ) : (
          <Button
            onClick={pauseTimer}
            disabled={isLoading}
            className="!bg-green-700 !text-white hover:!bg-green-800 !py-1 !px-3"
          >
            <PauseIcon className="h-4 w-4 mr-1" />
            Pause
          </Button>
        )}
        <Button
          onClick={handleStop}
          disabled={isLoading}
          className="!bg-red-600 !text-white hover:!bg-red-700 !py-1 !px-3"
        >
          <StopIcon className="h-4 w-4 mr-1" />
          Stop
        </Button>
      </div>
    </div>
  )
}
