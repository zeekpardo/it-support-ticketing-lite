import { useState } from 'react'
import { TicketStage } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Bars3Icon, TrashIcon, PlusIcon, CheckCircleIcon, StarIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGE_COLORS = [
  { name: 'purple', class: 'bg-purple-600' },
  { name: 'blue', class: 'bg-blue-600' },
  { name: 'cyan', class: 'bg-cyan-600' },
  { name: 'teal', class: 'bg-teal-600' },
  { name: 'green', class: 'bg-green-600' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'red', class: 'bg-red-600' },
  { name: 'pink', class: 'bg-pink-600' },
  { name: 'indigo', class: 'bg-indigo-600' },
  { name: 'gray', class: 'bg-gray-600' },
]

function getColorClass(color: string) {
  return STAGE_COLORS.find(c => c.name === color)?.class || 'bg-gray-600'
}

// ---- Sortable item ----

function SortableStageItem({
  stage,
  onUpdate,
  onDelete,
  onSetDefault,
  onToggleResolved,
  canDelete,
}: {
  stage: TicketStage
  onUpdate: (stageId: string, data: { name?: string; color?: string }) => void
  onDelete: (stage: TicketStage) => void
  onSetDefault: (stageId: string) => void
  onToggleResolved: (stageId: string) => void
  canDelete: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(stage.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    if (editName.trim() && editName !== stage.name) {
      onUpdate(stage.id, { name: editName.trim() })
    }
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      <div className={`w-4 h-4 rounded ${getColorClass(stage.color)}`} />

      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-zinc-900 dark:text-white cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          {stage.name}
        </span>
      )}

      <div className="flex items-center gap-1">
        <Select
          value={stage.color}
          onChange={(e) => onUpdate(stage.id, { color: e.target.value })}
          className="text-xs w-24"
        >
          {STAGE_COLORS.map(color => (
            <option key={color.name} value={color.name}>
              {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
            </option>
          ))}
        </Select>

        <button
          onClick={() => onSetDefault(stage.id)}
          className={`p-1.5 rounded ${stage.isDefault ? 'text-amber-500' : 'text-zinc-400 hover:text-amber-500'}`}
          title={stage.isDefault ? 'Default stage' : 'Set as default'}
        >
          {stage.isDefault ? <StarSolid className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onToggleResolved(stage.id)}
          className={`p-1.5 rounded ${stage.isResolved ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`}
          title={stage.isResolved ? 'Resolved stage' : 'Mark as resolved stage'}
        >
          {stage.isResolved ? <CheckCircleSolid className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
        </button>

        {canDelete && (
          <button
            onClick={() => onDelete(stage)}
            className="p-1.5 rounded text-zinc-400 hover:text-red-500"
            title="Delete stage"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {stage._count && stage._count.tickets > 0 && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {stage._count.tickets} ticket{stage._count.tickets !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ---- Delete confirmation modal ----

function DeleteStageModal({
  stage,
  stages,
  moveToId,
  onChangeMoveToId,
  onConfirm,
  onCancel,
}: {
  stage: TicketStage
  stages: TicketStage[]
  moveToId: string
  onChangeMoveToId: (id: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const hasTickets = (stage._count?.tickets ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-medium text-zinc-950 dark:text-white mb-2">
          Delete Stage: {stage.name}
        </h3>

        {hasTickets ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This stage has {stage._count!.tickets} ticket{stage._count!.tickets !== 1 ? 's' : ''}.
              Select a stage to move them to:
            </p>
            <Select
              value={moveToId}
              onChange={(e) => onChangeMoveToId(e.target.value)}
              className="w-full mb-4"
            >
              <option value="">Select a stage...</option>
              {stages.filter(s => s.id !== stage.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            This stage has no tickets and can be safely deleted.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button plain onClick={onCancel}>Cancel</Button>
          <Button color="red" onClick={onConfirm}>Delete Stage</Button>
        </div>
      </div>
    </div>
  )
}

// ---- Main exported component ----

interface StageManagerProps {
  stages: TicketStage[]
  error: string
  onDragEnd: (event: DragEndEvent) => void
  onUpdate: (stageId: string, data: { name?: string; color?: string }) => void
  onSetDefault: (stageId: string) => void
  onToggleResolved: (stageId: string) => void
  onRequestDelete: (stage: TicketStage) => void
  // Add stage form
  newStageName: string
  onNewStageNameChange: (val: string) => void
  newStageColor: string
  onNewStageColorChange: (val: string) => void
  onAdd: () => void
  // Delete modal
  stageToDelete: TicketStage | null
  moveTicketsToStageId: string
  onMoveTicketsToStageIdChange: (id: string) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export default function StageManager({
  stages,
  error,
  onDragEnd,
  onUpdate,
  onSetDefault,
  onToggleResolved,
  onRequestDelete,
  newStageName,
  onNewStageNameChange,
  newStageColor,
  onNewStageColorChange,
  onAdd,
  stageToDelete,
  moveTicketsToStageId,
  onMoveTicketsToStageIdChange,
  onConfirmDelete,
  onCancelDelete,
}: StageManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <>
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <h3 className="text-sm font-medium text-zinc-950 dark:text-white mb-4">Ticket Stages</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Customize the workflow stages for your Kanban board. Drag to reorder.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {stages.map(stage => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  onUpdate={onUpdate}
                  onDelete={onRequestDelete}
                  onSetDefault={onSetDefault}
                  onToggleResolved={onToggleResolved}
                  canDelete={stages.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Input
            type="text"
            value={newStageName}
            onChange={(e) => onNewStageNameChange(e.target.value)}
            placeholder="New stage name"
            className="flex-1 min-w-0"
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          <div className="flex items-center gap-1 shrink-0">
            <Select
              value={newStageColor}
              onChange={(e) => onNewStageColorChange(e.target.value)}
              className="text-xs w-24"
            >
              {STAGE_COLORS.map(color => (
                <option key={color.name} value={color.name}>
                  {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                </option>
              ))}
            </Select>
            <Button onClick={onAdd} disabled={!newStageName.trim()}>
              <PlusIcon className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <StarSolid className="w-3 h-3 text-amber-500" /> Default stage for new tickets
          </span>
          <span className="flex items-center gap-1">
            <CheckCircleSolid className="w-3 h-3 text-green-500" /> Resolved/closed stage
          </span>
        </div>
      </div>

      {stageToDelete && (
        <DeleteStageModal
          stage={stageToDelete}
          stages={stages}
          moveToId={moveTicketsToStageId}
          onChangeMoveToId={onMoveTicketsToStageIdChange}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}
    </>
  )
}
