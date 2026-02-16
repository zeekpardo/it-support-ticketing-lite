import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  FolderIcon,
  UserIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  ClipboardIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { ClientImportWizard } from '@/components/import/ClientImportWizard'

interface InboxClient {
  id: string
  userId: string
  name: string
  email: string
}

interface Inbox {
  id: string
  name: string
  inboxCode: string
  clientName?: string
  description?: string
  isActive: boolean
  defaultAssigneeId?: string | null
  defaultAssignee?: {
    id: string
    role: string
    user: { id: string; name: string }
  } | null
  dueDateLowDays?: number | null
  dueDateMediumDays?: number | null
  dueDateHighDays?: number | null
  dueDateUrgentDays?: number | null
  clientSignupToken?: string | null
  clientSignupEnabled?: boolean
  _count?: {
    timeEntries: number
    tickets: number
  }
  clients?: InboxClient[]
  createdAt?: string
}

export default function InboxDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [signupLinkLoading, setSignupLinkLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (currentOrg && id) {
      loadInbox()
    }
  }, [currentOrg, id])

  const loadInbox = async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await api.getInbox(id)
      setInbox(data)
    } catch (error) {
      console.error('Failed to load inbox:', error)
    } finally {
      setLoading(false)
    }
  }

  const signupUrl = inbox?.clientSignupToken
    ? `${window.location.origin}/join/${inbox.clientSignupToken}`
    : null

  const handleCopyLink = () => {
    if (signupUrl) {
      navigator.clipboard.writeText(signupUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGenerateLink = async () => {
    if (!id) return
    setSignupLinkLoading(true)
    try {
      const result = await api.generateSignupLink(id)
      setInbox((prev) => prev ? { ...prev, clientSignupToken: result.token, clientSignupEnabled: result.enabled } : prev)
    } catch (error) {
      console.error('Failed to generate signup link:', error)
    } finally {
      setSignupLinkLoading(false)
    }
  }

  const handleToggleLink = async (enabled: boolean) => {
    if (!id) return
    setSignupLinkLoading(true)
    try {
      const result = await api.toggleSignupLink(id, enabled)
      setInbox((prev) => prev ? { ...prev, clientSignupToken: result.token, clientSignupEnabled: result.enabled } : prev)
    } catch (error) {
      console.error('Failed to toggle signup link:', error)
    } finally {
      setSignupLinkLoading(false)
    }
  }

  const handleDeleteLink = async () => {
    if (!id || !confirm('This will permanently revoke the signup link. Continue?')) return
    setSignupLinkLoading(true)
    try {
      await api.deleteSignupLink(id)
      setInbox((prev) => prev ? { ...prev, clientSignupToken: null, clientSignupEnabled: false } : prev)
    } catch (error) {
      console.error('Failed to delete signup link:', error)
    } finally {
      setSignupLinkLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return

    setDeleting(true)
    try {
      await api.deleteInbox(id)
      navigate('/admin/inboxes')
    } catch (error) {
      console.error('Failed to delete inbox:', error)
      alert('Failed to delete inbox')
    } finally {
      setDeleting(false)
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

  if (!inbox) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Inbox not found</Text>
      </div>
    )
  }

  const hasDueDates = inbox.dueDateLowDays || inbox.dueDateMediumDays ||
                       inbox.dueDateHighDays || inbox.dueDateUrgentDays

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button plain onClick={() => navigate('/admin/inboxes')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>

          <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FolderIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <Heading>{inbox.name}</Heading>
              {inbox.isActive ? (
                <Badge color="green">Active</Badge>
              ) : (
                <Badge color="zinc">Archived</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge color="blue">{inbox.inboxCode}</Badge>
              {inbox.clientName && (
                <Text className="text-zinc-500">{inbox.clientName}</Text>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button outline onClick={() => navigate(`/admin/inboxes/${id}/edit`)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button color="red" outline onClick={() => setShowDeleteModal(true)}>
            <TrashIcon className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {inbox.description && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading>Description</Subheading>
              <Text className="mt-2 whitespace-pre-wrap">{inbox.description}</Text>
            </div>
          )}

          {/* Due Date Settings */}
          {hasDueDates && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading>Due Date Settings</Subheading>
              <Text className="text-sm text-zinc-500 mt-1 mb-4">
                Automatic due dates by priority when tickets are created
              </Text>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Low</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {inbox.dueDateLowDays ? `${inbox.dueDateLowDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Medium</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {inbox.dueDateMediumDays ? `${inbox.dueDateMediumDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">High</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {inbox.dueDateHighDays ? `${inbox.dueDateHighDays} days` : '-'}
                  </Text>
                </div>
                <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                  <Text className="text-xs text-zinc-500 uppercase tracking-wide">Urgent</Text>
                  <Text className="text-lg font-semibold mt-1">
                    {inbox.dueDateUrgentDays ? `${inbox.dueDateUrgentDays} days` : '-'}
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* Clients */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="flex items-center justify-between">
              <Subheading>Clients</Subheading>
              <Button outline onClick={() => setShowImportWizard(true)}>
                <ArrowUpTrayIcon className="h-4 w-4" />
                Import Clients
              </Button>
            </div>
            {inbox.clients && inbox.clients.length > 0 ? (
              <div className="mt-4">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Email</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inbox.clients.map((client) => (
                      <TableRow key={client.id} href={`/admin/clients/${client.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <span className="font-medium">{client.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-500">{client.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Text className="mt-2 text-zinc-500">No clients assigned to this inbox</Text>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Details</Subheading>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Default Assignee</dt>
                <dd className="text-sm text-zinc-900 dark:text-white">
                  {inbox.defaultAssignee?.user.name || 'None'}
                </dd>
              </div>
              {inbox._count && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Time Entries</dt>
                    <dd className="text-sm text-zinc-900 dark:text-white">
                      {inbox._count.timeEntries}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Tickets</dt>
                    <dd className="text-sm text-zinc-900 dark:text-white">
                      {inbox._count.tickets || 0}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status</dt>
                <dd className="text-sm">
                  {inbox.isActive ? (
                    <Badge color="green">Active</Badge>
                  ) : (
                    <Badge color="zinc">Archived</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Quick Actions</Subheading>
            <div className="mt-4 space-y-2">
              <Link
                to={`/inboxes/${inbox.id}/tickets`}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View Tickets
              </Link>
              <Link
                to={`/admin/inboxes/${inbox.id}/edit`}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Edit Inbox
              </Link>
            </div>
          </div>

          {/* Client Signup Link */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-zinc-400" />
              <Subheading>Client Signup Link</Subheading>
            </div>
            <Text className="mt-1 text-sm text-zinc-500">
              Share this link so clients can sign up and access this inbox.
            </Text>

            {!inbox.clientSignupToken ? (
              <Button
                outline
                className="mt-4 w-full"
                onClick={handleGenerateLink}
                disabled={signupLinkLoading}
              >
                {signupLinkLoading ? 'Generating...' : 'Generate Link'}
              </Button>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge color={inbox.clientSignupEnabled ? 'green' : 'zinc'}>
                    {inbox.clientSignupEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
                    inbox.clientSignupEnabled
                      ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{signupUrl}</span>
                  <Button
                    plain
                    onClick={handleCopyLink}
                    title="Copy link"
                    className="shrink-0"
                  >
                    <ClipboardIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                  </Button>
                </div>
                {copied && (
                  <Text className="text-xs text-green-600">Copied!</Text>
                )}

                <div className="flex gap-2">
                  <Button
                    outline
                    className="flex-1"
                    onClick={() => handleToggleLink(!inbox.clientSignupEnabled)}
                    disabled={signupLinkLoading}
                  >
                    {inbox.clientSignupEnabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    outline
                    onClick={() => {
                      if (confirm('Generate a new link? The current link will stop working.')) {
                        handleGenerateLink()
                      }
                    }}
                    disabled={signupLinkLoading}
                    title="Regenerate link"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    outline
                    onClick={handleDeleteLink}
                    disabled={signupLinkLoading}
                    title="Delete link"
                  >
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <DialogTitle>Delete Inbox</DialogTitle>
        <DialogBody>
          <Text>
            {inbox._count?.timeEntries ? (
              <>
                This inbox has <strong>{inbox._count.timeEntries}</strong> time entries.
                It will be archived instead of deleted to preserve the data. Continue?
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{inbox.name}</strong>?
                This action cannot be undone.
              </>
            )}
          </Text>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : inbox._count?.timeEntries ? 'Archive' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Import Wizard */}
      <ClientImportWizard
        inboxId={inbox.id}
        inboxName={inbox.name}
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onComplete={loadInbox}
      />
    </div>
  )
}
