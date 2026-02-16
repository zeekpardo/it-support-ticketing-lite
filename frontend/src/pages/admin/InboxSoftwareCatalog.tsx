import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import {
  ArrowLeftIcon,
  GlobeAltIcon,
  FolderIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { useTabbedPage } from '../../hooks/useTabbedPage'
import { useInboxSoftwareCatalog } from '../../hooks/useInboxSoftwareCatalog'
import { InboxSoftwareTab } from '../../components/software/InboxSoftwareTab'
import { CatalogBrowserTab } from '../../components/software/CatalogBrowserTab'
import { BudgetTab } from '../../components/software/BudgetTab'

type TabType = 'inbox' | 'catalog' | 'budget'

export default function InboxSoftwareCatalog() {
  const { inboxId } = useParams<{ inboxId: string }>()
  const navigate = useNavigate()
  const tabs = useTabbedPage<TabType>({ tabs: ['inbox', 'catalog', 'budget'], defaultTab: 'inbox' })
  const catalog = useInboxSoftwareCatalog(inboxId)

  useEffect(() => {
    if (tabs.is('catalog')) catalog.loadGlobalCatalog()
    if (tabs.is('budget')) catalog.loadBudget()
  }, [tabs.active, catalog.categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const TabButton = ({ tab, label, icon: Icon }: { tab: TabType; label: string; icon: React.ElementType }) => (
    <button
      type="button"
      onClick={() => tabs.set(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        tabs.is(tab)
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  if (catalog.loadingInbox && catalog.inboxSoftware.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button plain onClick={() => navigate(`/admin/inboxes/${inboxId}`)}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <Heading>Software Catalog</Heading>
          <Text className="mt-1 text-zinc-500">
            {catalog.inbox?.name || 'Inbox'} - {catalog.inbox?.inboxCode}
          </Text>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-2">
          <TabButton tab="inbox" label="Inbox Software" icon={FolderIcon} />
          <TabButton tab="catalog" label="Browse Global Catalog" icon={GlobeAltIcon} />
          <TabButton tab="budget" label="Budget Overview" icon={CurrencyDollarIcon} />
        </nav>
      </div>

      {tabs.is('inbox') && (
        <InboxSoftwareTab
          inboxId={inboxId!}
          inboxSoftware={catalog.inboxSoftware}
          onSwitchToCatalog={() => tabs.set('catalog')}
        />
      )}

      {tabs.is('catalog') && (
        <CatalogBrowserTab
          globalSoftware={catalog.globalSoftware}
          categories={catalog.categories}
          inboxSoftwareIds={catalog.inboxSoftwareIds}
          loadingCatalog={catalog.loadingCatalog}
          searchQuery={catalog.searchQuery}
          onSearchQueryChange={catalog.setSearchQuery}
          categoryFilter={catalog.categoryFilter}
          onCategoryFilterChange={catalog.setCategoryFilter}
          onSearch={catalog.loadGlobalCatalog}
          onAddToInbox={catalog.addToInbox}
        />
      )}

      {tabs.is('budget') && (
        <BudgetTab
          budgetData={catalog.budgetData}
          loading={catalog.loadingBudget}
        />
      )}
    </div>
  )
}
