import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'

interface Project {
  id: string
  name: string
  projectCode: string
}

interface ManualEntryModalProps {
  projects: Project[]
  onSave: (data: {
    projectId: string
    taskName: string
    startTime: string
    endTime: string
    notes?: string
  }) => Promise<void>
  onClose: () => void
}

export function ManualEntryModal({ projects, onSave, onClose }: ManualEntryModalProps) {
  const [projectId, setProjectId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!projectId || !taskName.trim()) {
      setError('Please fill in all required fields')
      return
    }

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    if (end <= start) {
      setError('End time must be after start time')
      return
    }

    setLoading(true)
    try {
      await onSave({
        projectId,
        taskName: taskName.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: notes.trim() || undefined
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true} onClose={onClose} size="md">
      <DialogTitle>Add Manual Time Entry</DialogTitle>
      <DialogDescription>
        Log time for work you've already completed.
      </DialogDescription>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <FieldGroup>
            <Field>
              <Label>Project</Label>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
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
                placeholder="What did you work on?"
                required
              />
            </Field>

            <Field>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details..."
                rows={3}
              />
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="blue" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Entry'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
