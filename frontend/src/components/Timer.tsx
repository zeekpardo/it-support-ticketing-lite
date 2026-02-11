import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { PlayIcon, StopIcon } from '@heroicons/react/24/solid'

interface Project {
  id: string
  name: string
  projectCode: string
}

interface TimeEntry {
  id: string
  taskName: string
  startTime: string
  endTime?: string
  isRunning: boolean
  project: {
    id: string
    name: string
    projectCode: string
  }
}

interface TimerProps {
  projects: Project[]
  runningEntry: TimeEntry | null
  onStart: (projectId: string, taskName: string) => Promise<void>
  onStop: () => Promise<void>
}

export function Timer({ projects, runningEntry, onStart, onStop }: TimerProps) {
  const [projectId, setProjectId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)

  // Update elapsed time every second when timer is running
  useEffect(() => {
    if (!runningEntry) {
      setElapsed(0)
      return
    }

    const startTime = new Date(runningEntry.startTime).getTime()

    const updateElapsed = () => {
      const now = Date.now()
      setElapsed(Math.floor((now - startTime) / 1000))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [runningEntry])

  // Prefill form when timer is running
  useEffect(() => {
    if (runningEntry) {
      setProjectId(runningEntry.project.id)
      setTaskName(runningEntry.taskName)
    }
  }, [runningEntry])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = async () => {
    if (!projectId || !taskName.trim()) return

    setLoading(true)
    try {
      await onStart(projectId, taskName.trim())
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await onStop()
      setTaskName('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Timer Display */}
      <div className="text-center">
        <div
          className={`inline-block rounded-xl px-8 py-4 text-5xl font-mono font-bold tracking-wider ${
            runningEntry
              ? 'bg-green-50 text-green-600 timer-running dark:bg-green-900/20 dark:text-green-400'
              : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
          }`}
        >
          {formatTime(elapsed)}
        </div>
        {runningEntry && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Working on: {runningEntry.taskName} ({runningEntry.project.name})
          </p>
        )}
      </div>

      {/* Timer Controls */}
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>Project</Label>
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={!!runningEntry}
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      [{project.projectCode}] {project.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>Task</Label>
                <Input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="What are you working on?"
                  disabled={!!runningEntry}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="pb-0.5">
          {runningEntry ? (
            <Button
              color="red"
              onClick={handleStop}
              disabled={loading}
              className="h-[42px] px-6"
            >
              <StopIcon className="h-5 w-5" />
              Stop
            </Button>
          ) : (
            <Button
              color="green"
              onClick={handleStart}
              disabled={loading || !projectId || !taskName.trim()}
              className="h-[42px] px-6"
            >
              <PlayIcon className="h-5 w-5" />
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
