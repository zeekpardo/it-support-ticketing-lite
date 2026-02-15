import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { SoftwareCategory } from '../../api/client'

interface SoftwareFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSearch: (e: React.FormEvent) => void
  categories: SoftwareCategory[]
  categoryFilter: string
  onCategoryChange: (value: string) => void
  /** Optional status filter (used by super admin) */
  statusFilter?: string
  onStatusChange?: (value: string) => void
  statusOptions?: Array<{ value: string; label: string }>
  /** Show a reset button */
  onReset?: () => void
}

export function SoftwareFilters({
  searchValue,
  onSearchChange,
  onSearch,
  categories,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  onReset,
}: SoftwareFiltersProps) {
  return (
    <form onSubmit={onSearch} className="flex gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <Input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search software..."
        />
      </div>
      {statusFilter !== undefined && onStatusChange && statusOptions && (
        <Select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-40"
        >
          <option value="">All Status</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      )}
      <Select
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-48"
      >
        <option value="">All Categories</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </Select>
      <Button type="submit" outline>
        <MagnifyingGlassIcon className="h-4 w-4" />
        Search
      </Button>
      {onReset && (
        <Button type="button" outline onClick={onReset}>
          <ArrowPathIcon className="h-4 w-4" />
          Reset
        </Button>
      )}
    </form>
  )
}
