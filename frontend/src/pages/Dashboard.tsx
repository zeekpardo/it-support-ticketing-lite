import { useState, useEffect } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
import { Timer } from '../components/Timer'
import { TimeEntryList } from '../components/TimeEntryList'
import { ManualEntryModal } from '../components/ManualEntryModal'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { PlusIcon } from '@heroicons/react/24/outline'

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
  durationMins?: number
  isRunning: boolean
  project: {
    id: string
    name: string
    projectCode: string
  }
  user: {
    id: string
    name: string
    email: string
  }
}

export default function Dashboard() {
  const { currentOrg, isAdmin } = useOrganization()
  const [projects, setProjects] = useState<Project[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [showManualEntry, setShowManualEntry] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadData()
    }
  }, [currentOrg])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsData, entriesData] = await Promise.all([
        api.getProjects(),
        api.getTimeEntries()
      ])
      setProjects(projectsData)
      setEntries(entriesData)

      // Find running entry
      const running = entriesData.find((e: TimeEntry) => e.isRunning)
      setRunningEntry(running || null)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTimer = async (projectId: string, taskName: string) => {
    try {
      const entry = await api.createTimeEntry({
        projectId,
        taskName,
        isRunning: true
      })
      setRunningEntry(entry)
      setEntries([entry, ...entries])
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStopTimer = async () => {
    if (!runningEntry) return

    try {
      const updated = await api.stopTimer(runningEntry.id)
      setRunningEntry(null)
      setEntries(entries.map(e => e.id === updated.id ? updated : e))
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      await api.deleteTimeEntry(id)
      setEntries(entries.filter(e => e.id !== id))
      if (runningEntry?.id === id) {
        setRunningEntry(null)
      }
    } catch (error) {
      console.error('Failed to delete entry:', error)
    }
  }

  const handleManualEntry = async (data: {
    projectId: string
    taskName: string
    startTime: string
    endTime: string
    notes?: string
  }) => {
    try {
      const entry = await api.createTimeEntry({
        ...data,
        isRunning: false
      })
      setEntries([entry, ...entries])
      setShowManualEntry(false)
    } catch (error) {
      console.error('Failed to create manual entry:', error)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to view your time entries</Text>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Timer Section */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Timer
          projects={projects}
          runningEntry={runningEntry}
          onStart={handleStartTimer}
          onStop={handleStopTimer}
        />
      </div>

      {/* Time Entries Section */}
      <div>
        <div className="flex items-center justify-between">
          <Subheading>Recent Time Entries</Subheading>
          <Button
            outline
            onClick={() => setShowManualEntry(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Add Manual Entry
          </Button>
        </div>

        <div className="mt-4 rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <TimeEntryList
            entries={entries}
            isAdmin={isAdmin}
            onDelete={handleDeleteEntry}
            onRefresh={loadData}
          />
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <ManualEntryModal
          projects={projects}
          onSave={handleManualEntry}
          onClose={() => setShowManualEntry(false)}
        />
      )}
    </div>
  )
}
