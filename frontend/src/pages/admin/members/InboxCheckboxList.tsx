import { Text } from '@/components/ui/text'
import { Label } from '@/components/ui/fieldset'
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/ui/checkbox'

interface Inbox {
  id: string
  name: string
  inboxCode: string
  isActive: boolean
}

interface InboxCheckboxListProps {
  inboxes: Inbox[]
  selectedIds: string[] | Set<string>
  onToggle: (inboxId: string, checked: boolean) => void
  emptyMessage?: string
  activeOnly?: boolean
}

export default function InboxCheckboxList({
  inboxes,
  selectedIds,
  onToggle,
  emptyMessage = 'No inboxes available.',
  activeOnly = true,
}: InboxCheckboxListProps) {
  const filtered = activeOnly ? inboxes.filter(p => p.isActive) : inboxes

  if (filtered.length === 0) {
    return (
      <Text className="text-amber-600 dark:text-amber-400">
        {emptyMessage}
      </Text>
    )
  }

  const isSelected = (id: string) =>
    selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id)

  return (
    <CheckboxGroup>
      {filtered.map((inbox) => (
        <CheckboxField key={inbox.id}>
          <Checkbox
            checked={isSelected(inbox.id)}
            onChange={(checked) => onToggle(inbox.id, checked)}
          />
          <Label>
            {inbox.name}
            <span className="ml-2 text-zinc-500">({inbox.inboxCode})</span>
          </Label>
        </CheckboxField>
      ))}
    </CheckboxGroup>
  )
}
