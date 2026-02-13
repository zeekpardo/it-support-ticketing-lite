import { Text } from '@/components/ui/text'
import { Label } from '@/components/ui/fieldset'
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/ui/checkbox'

interface Project {
  id: string
  name: string
  projectCode: string
  isActive: boolean
}

interface ProjectCheckboxListProps {
  projects: Project[]
  selectedIds: string[] | Set<string>
  onToggle: (projectId: string, checked: boolean) => void
  emptyMessage?: string
  activeOnly?: boolean
}

export default function ProjectCheckboxList({
  projects,
  selectedIds,
  onToggle,
  emptyMessage = 'No projects available.',
  activeOnly = true,
}: ProjectCheckboxListProps) {
  const filtered = activeOnly ? projects.filter(p => p.isActive) : projects

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
      {filtered.map((project) => (
        <CheckboxField key={project.id}>
          <Checkbox
            checked={isSelected(project.id)}
            onChange={(checked) => onToggle(project.id, checked)}
          />
          <Label>
            {project.name}
            <span className="ml-2 text-zinc-500">({project.projectCode})</span>
          </Label>
        </CheckboxField>
      ))}
    </CheckboxGroup>
  )
}
