import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { useTabbedPage } from '../../hooks/useTabbedPage'
import { api } from '../../api/client'
import { useInboxForm } from '../../hooks/useInboxForm'
import { useStageManager } from '../../hooks/useStageManager'
import StageManager from '../../components/StageManager'
import { InboxGeneralTab, InboxEmailRulesTab, InboxAutoReplyTab } from '../../components/inbox'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'email-rules', label: 'Email Rules' },
  { id: 'auto-reply', label: 'Auto-Reply' },
  { id: 'stages', label: 'Stages' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function InboxEdit() {
  const { id } = useParams<{ id: string }>()
  const { currentOrg } = useOrganization()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const tabs = useTabbedPage({ tabs: ['general', 'email-rules', 'auto-reply', 'stages'] as const, defaultTab: 'general' as TabId })

  const inboxForm = useInboxForm(id)
  const stageManager = useStageManager(id)

  useEffect(() => {
    if (currentOrg && id) {
      loadData()
    }
  }, [currentOrg, id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [inboxData, staffData] = await Promise.all([
        api.getInbox(id!),
        api.getStaffMembers(),
      ])
      inboxForm.populateFromInbox(inboxData)
      setStaffMembers(staffData)
      await stageManager.loadStages()
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
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

  if (!inboxForm.inbox) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Inbox not found</Text>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/inboxes"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>Edit Inbox</Heading>
          <Text className="text-zinc-500">Update the inbox details.</Text>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tabs.set(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tabs.active === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {tabs.active === 'general' && (
        <InboxGeneralTab inboxForm={inboxForm} staffMembers={staffMembers} />
      )}

      {tabs.active === 'email-rules' && (
        <InboxEmailRulesTab inboxId={id!} />
      )}

      {tabs.active === 'auto-reply' && (
        <InboxAutoReplyTab inboxForm={inboxForm} inboxId={id!} />
      )}

      {tabs.active === 'stages' && (
        <StageManager
          stages={stageManager.stages}
          error={stageManager.error}
          onDragEnd={stageManager.handleDragEnd}
          onUpdate={stageManager.handleUpdate}
          onSetDefault={stageManager.handleSetDefault}
          onToggleResolved={stageManager.handleToggleResolved}
          onRequestDelete={stageManager.setStageToDelete}
          newStageName={stageManager.newStageName}
          onNewStageNameChange={stageManager.setNewStageName}
          newStageColor={stageManager.newStageColor}
          onNewStageColorChange={stageManager.setNewStageColor}
          onAdd={stageManager.handleAdd}
          stageToDelete={stageManager.stageToDelete}
          moveTicketsToStageId={stageManager.moveTicketsToStageId}
          onMoveTicketsToStageIdChange={stageManager.setMoveTicketsToStageId}
          onConfirmDelete={stageManager.handleDelete}
          onCancelDelete={stageManager.dismissDelete}
        />
      )}

      {/* Danger Zone */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-red-200 dark:ring-red-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {inboxForm.inbox._count?.timeEntries && inboxForm.inbox._count.timeEntries > 0
                ? 'This inbox has time entries and will be archived instead of deleted.'
                : 'Permanently delete this inbox. This action cannot be undone.'}
            </p>
          </div>
          <Button
            color="red"
            onClick={inboxForm.handleDelete}
            disabled={inboxForm.deleting || inboxForm.saving}
          >
            <TrashIcon className="h-4 w-4" />
            {inboxForm.deleting ? 'Deleting...' : 'Delete Inbox'}
          </Button>
        </div>
      </div>
    </div>
  )
}
