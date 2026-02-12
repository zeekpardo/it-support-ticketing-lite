import { Select } from '../ui/select'
import type { SoftwareCategory } from '../../api/client'

interface CategoryFilterProps {
  categories: SoftwareCategory[]
  selectedCategory: string
  onCategoryChange: (categoryId: string) => void
  showMySoftware?: boolean
  mySoftwareFilter?: boolean
  onMySoftwareChange?: (value: boolean) => void
  showProjectFilter?: boolean
  projects?: Array<{ id: string; name: string }>
  selectedProject?: string
  onProjectChange?: (projectId: string) => void
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  showMySoftware = false,
  mySoftwareFilter = false,
  onMySoftwareChange,
  showProjectFilter = false,
  projects = [],
  selectedProject = '',
  onProjectChange
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {showProjectFilter && projects.length > 0 && onProjectChange && (
        <div className="w-48">
          <Select
            value={selectedProject}
            onChange={(e) => onProjectChange(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="w-48">
        <Select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} {category._count ? `(${category._count.software})` : ''}
            </option>
          ))}
        </Select>
      </div>

      {showMySoftware && onMySoftwareChange && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mySoftwareFilter}
            onChange={(e) => onMySoftwareChange(e.target.checked)}
            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            My Software Only
          </span>
        </label>
      )}
    </div>
  )
}
