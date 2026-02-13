import { useState } from 'react'
import { Heading } from '@/components/ui/heading'
import {
  UsersIcon,
  Square3Stack3DIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { UsersTab, SoftwareTab, CategoriesTab } from './super-admin'
import type { TabType } from './super-admin'

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
  const [activeTab, setActiveTab] = useState<TabType>('users')

  return (
    <div className="space-y-6">
      <Heading>Super Admin</Heading>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-2">
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
            <UsersIcon className="h-4 w-4" />
            Users
          </TabButton>
          <TabButton active={activeTab === 'software'} onClick={() => setActiveTab('software')}>
            <Square3Stack3DIcon className="h-4 w-4" />
            Software Catalog
          </TabButton>
          <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>
            <TagIcon className="h-4 w-4" />
            Categories
          </TabButton>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'software' && <SoftwareTab />}
      {activeTab === 'categories' && <CategoriesTab />}
    </div>
  )
}
