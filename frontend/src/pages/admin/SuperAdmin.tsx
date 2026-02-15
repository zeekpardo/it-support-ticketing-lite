import { Heading } from '@/components/ui/heading'
import {
  UsersIcon,
  Square3Stack3DIcon,
  TagIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { UsersTab, SoftwareTab, CategoriesTab, AccountsTab } from './super-admin'
import type { TabType } from './super-admin'
import { useTabbedPage } from '../../hooks/useTabbedPage'

// ==========================================
// Tab Button Component
// ==========================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

// ==========================================
// Main Component
// ==========================================

export default function SuperAdmin() {
  const tabs = useTabbedPage({ tabs: ['users', 'software', 'categories', 'accounts'] as const satisfies readonly TabType[], defaultTab: 'users' })

  return (
    <div className="space-y-6">
      <Heading>Super Admin</Heading>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-2">
          <TabButton active={tabs.active ==='users'} onClick={() => tabs.set('users')}>
            <UsersIcon className="h-4 w-4" />
            Users
          </TabButton>
          <TabButton active={tabs.active ==='software'} onClick={() => tabs.set('software')}>
            <Square3Stack3DIcon className="h-4 w-4" />
            Software Catalog
          </TabButton>
          <TabButton active={tabs.active ==='categories'} onClick={() => tabs.set('categories')}>
            <TagIcon className="h-4 w-4" />
            Categories
          </TabButton>
          <TabButton active={tabs.active ==='accounts'} onClick={() => tabs.set('accounts')}>
            <BuildingOffice2Icon className="h-4 w-4" />
            Accounts
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {tabs.active ==='users' && <UsersTab />}
      {tabs.active ==='software' && <SoftwareTab />}
      {tabs.active ==='categories' && <CategoriesTab />}
      {tabs.active ==='accounts' && <AccountsTab />}
    </div>
  )
}
