import { useState, useEffect } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import {
  getEmailDomains,
  addEmailDomain,
  verifyEmailDomain,
  refreshEmailDomain,
  removeEmailDomain,
  setDefaultDomain,
  clearDefaultDomain,
  updateOrgDefaults,
  type EmailDomain,
  type OrgDefaults,
} from '../../api/emailDomains'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Divider } from '@/components/ui/divider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  StarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

function StatusBadge({ status }: { status: EmailDomain['status'] }) {
  switch (status) {
    case 'VERIFIED':
      return <Badge color="green">Verified</Badge>
    case 'PENDING':
      return <Badge color="yellow">Pending</Badge>
    case 'FAILED':
      return <Badge color="red">Failed</Badge>
    default:
      return <Badge color="zinc">{status}</Badge>
  }
}

export default function EmailDomainSettings() {
  const { currentOrg } = useOrganization()
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [orgDefaults, setOrgDefaults] = useState<OrgDefaults>({
    defaultEmailDomainId: null,
    defaultFromUser: null,
    defaultFromName: null,
  })
  const [loading, setLoading] = useState(true)

  // Add domain form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [adding, setAdding] = useState(false)

  // Org defaults form
  const [fromUser, setFromUser] = useState('')
  const [fromName, setFromName] = useState('')
  const [savingDefaults, setSavingDefaults] = useState(false)

  // DNS records expanded state
  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(null)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingDomain, setDeletingDomain] = useState<EmailDomain | null>(null)

  // Action loading states (per-domain)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Feedback
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setError(msg)
      setSuccess('')
    } else {
      setSuccess(msg)
      setError('')
    }
  }

  useEffect(() => {
    if (currentOrg) loadData()
  }, [currentOrg])

  const loadData = async () => {
    try {
      const data = await getEmailDomains()
      setDomains(data.domains)
      setOrgDefaults(data.orgDefaults)
      setFromUser(data.orgDefaults.defaultFromUser || '')
      setFromName(data.orgDefaults.defaultFromName || '')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to load domains', true)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return
    setAdding(true)
    showFeedback('')
    try {
      await addEmailDomain(newDomain.trim())
      setNewDomain('')
      setShowAddForm(false)
      showFeedback('Domain added — configure the DNS records below, then verify')
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to add domain', true)
    } finally {
      setAdding(false)
    }
  }

  const handleVerify = async (domain: EmailDomain) => {
    setActionLoading((prev) => ({ ...prev, [domain.id]: true }))
    showFeedback('')
    try {
      await verifyEmailDomain(domain.id)
      showFeedback(`Verification triggered for ${domain.domain}`)
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Verification failed', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [domain.id]: false }))
    }
  }

  const handleRefresh = async (domain: EmailDomain) => {
    setActionLoading((prev) => ({ ...prev, [domain.id]: true }))
    showFeedback('')
    try {
      await refreshEmailDomain(domain.id)
      showFeedback(`Status refreshed for ${domain.domain}`)
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Refresh failed', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [domain.id]: false }))
    }
  }

  const handleDelete = async () => {
    if (!deletingDomain) return
    showFeedback('')
    try {
      await removeEmailDomain(deletingDomain.id)
      setShowDeleteDialog(false)
      setDeletingDomain(null)
      showFeedback('Domain removed')
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to remove domain', true)
    }
  }

  const handleSetDefault = async (domain: EmailDomain) => {
    setActionLoading((prev) => ({ ...prev, [domain.id]: true }))
    showFeedback('')
    try {
      if (orgDefaults.defaultEmailDomainId === domain.id) {
        await clearDefaultDomain()
        showFeedback('Default domain cleared')
      } else {
        await setDefaultDomain(domain.id)
        showFeedback(`${domain.domain} set as default sending domain`)
      }
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to update default', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [domain.id]: false }))
    }
  }

  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingDefaults(true)
    showFeedback('')
    try {
      await updateOrgDefaults({
        defaultFromUser: fromUser || '',
        defaultFromName: fromName || '',
      })
      showFeedback('Sender defaults updated')
      await loadData()
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to save defaults', true)
    } finally {
      setSavingDefaults(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showFeedback('Copied to clipboard')
    } catch {
      showFeedback('Failed to copy', true)
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

  const defaultDomain = domains.find((d) => d.id === orgDefaults.defaultEmailDomainId)
  const previewAddress = defaultDomain
    ? `${fromUser || 'support'}@${defaultDomain.domain}`
    : null

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Email Domains</Heading>
          <Text className="mt-1">
            Verify custom sending domains so outbound emails come from your own address.
          </Text>
        </div>
        {!showAddForm && (
          <Button color="blue" onClick={() => setShowAddForm(true)}>
            <PlusIcon className="h-4 w-4" />
            Add Domain
          </Button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Add Domain Form */}
      {showAddForm && (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Subheading>Add Domain</Subheading>
          <Text className="mt-1">Enter the domain you want to send emails from.</Text>
          <form onSubmit={handleAddDomain} className="mt-4 flex items-end gap-3">
            <Field className="flex-1">
              <Label>Domain</Label>
              <Input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="yourdomain.com"
              />
            </Field>
            <Button type="submit" color="blue" disabled={adding || !newDomain.trim()}>
              {adding ? 'Adding...' : 'Add'}
            </Button>
            <Button
              type="button"
              plain
              onClick={() => {
                setShowAddForm(false)
                setNewDomain('')
              }}
            >
              Cancel
            </Button>
          </form>
        </section>
      )}

      {/* Domain List */}
      {domains.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <GlobeAltIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No email domains configured</Subheading>
          <Text className="mt-2">
            Add a custom domain to send emails from your own address instead of the default.
          </Text>
          {!showAddForm && (
            <Button color="blue" onClick={() => setShowAddForm(true)} className="mt-4">
              <PlusIcon className="h-4 w-4" />
              Add First Domain
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => {
            const isDefault = orgDefaults.defaultEmailDomainId === domain.id
            const isExpanded = expandedDomainId === domain.id
            const isLoading = actionLoading[domain.id] || false

            return (
              <div
                key={domain.id}
                className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10"
              >
                {/* Domain header row */}
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSetDefault(domain)}
                      disabled={isLoading || domain.status !== 'VERIFIED'}
                      title={
                        domain.status !== 'VERIFIED'
                          ? 'Domain must be verified to set as default'
                          : isDefault
                            ? 'Remove as default'
                            : 'Set as default'
                      }
                      className="disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {isDefault ? (
                        <StarIconSolid className="h-5 w-5 text-amber-500" />
                      ) : (
                        <StarIcon className="h-5 w-5 text-zinc-400 hover:text-amber-500" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-950 dark:text-white">
                          {domain.domain}
                        </span>
                        <StatusBadge status={domain.status} />
                        {isDefault && <Badge color="blue">Default</Badge>}
                      </div>
                      {domain.verifiedAt && (
                        <Text className="text-xs">
                          Verified {new Date(domain.verifiedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.status !== 'VERIFIED' && (
                      <Button
                        plain
                        onClick={() => handleVerify(domain)}
                        disabled={isLoading}
                        title="Trigger verification"
                      >
                        <ShieldCheckIcon className="h-4 w-4" />
                        <span className="text-sm">Verify</span>
                      </Button>
                    )}
                    <Button
                      plain
                      onClick={() => handleRefresh(domain)}
                      disabled={isLoading}
                      title="Refresh status"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      plain
                      onClick={() =>
                        setExpandedDomainId(isExpanded ? null : domain.id)
                      }
                    >
                      <span className="text-sm text-zinc-500">
                        {isExpanded ? 'Hide DNS' : 'Show DNS'}
                      </span>
                    </Button>
                    <Button
                      plain
                      onClick={() => {
                        setDeletingDomain(domain)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* DNS Records (expandable) */}
                {isExpanded && domain.dnsRecords && (
                  <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-700">
                    <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <strong>SPF record:</strong> If you already have an SPF record for this
                        domain, add the <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">include:</code> value
                        to your existing record — do not replace it, or you may break other email
                        services (like Google Workspace or Microsoft 365).
                      </div>
                    </div>
                    <Table dense>
                      <TableHead>
                        <TableRow>
                          <TableHeader>Type</TableHeader>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>Value</TableHeader>
                          <TableHeader>Status</TableHeader>
                          <TableHeader className="w-10"></TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(domain.dnsRecords as Array<{
                          record_type?: string
                          type?: string
                          name: string
                          value: string
                          status?: string
                          priority?: number
                        }>).map((record, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">
                              {record.record_type || record.type || '—'}
                            </TableCell>
                            <TableCell>
                              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                                {record.name}
                              </code>
                            </TableCell>
                            <TableCell>
                              <code className="break-all rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                                {record.value}
                              </code>
                            </TableCell>
                            <TableCell>
                              {record.status === 'verified' ? (
                                <Badge color="green">Verified</Badge>
                              ) : record.status === 'failed' ? (
                                <Badge color="red">Failed</Badge>
                              ) : (
                                <Badge color="yellow">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => copyToClipboard(record.value)}
                                title="Copy value"
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              >
                                <ClipboardDocumentIcon className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Divider />

      {/* Org-Level Sender Defaults */}
      <section>
        <Subheading>Sender Defaults</Subheading>
        <Text className="mt-1">
          Set the default sender name and address used when an inbox doesn't have its own override.
        </Text>

        <form onSubmit={handleSaveDefaults} className="mt-6">
          <FieldGroup>
            <Field>
              <Label>From Address (local part)</Label>
              <Input
                type="text"
                value={fromUser}
                onChange={(e) => setFromUser(e.target.value)}
                placeholder="support"
              />
              <Description>
                The part before the @ sign. For example, <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-700">support</code> in{' '}
                support@yourdomain.com
              </Description>
            </Field>

            <Field>
              <Label>Display Name</Label>
              <Input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Acme Support"
                maxLength={100}
              />
              <Description>
                The name recipients see in their inbox. Falls back to your app name if not set.
              </Description>
            </Field>

            {previewAddress && (
              <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                <Text className="text-sm">
                  <span className="text-zinc-500">Preview: </span>
                  <span className="font-medium text-zinc-950 dark:text-white">
                    {fromName || currentOrg?.name || 'Your App'} &lt;{previewAddress}&gt;
                  </span>
                </Text>
              </div>
            )}
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" color="blue" disabled={savingDefaults}>
              {savingDefaults ? 'Saving...' : 'Save Defaults'}
            </Button>
          </div>
        </form>
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Remove Domain</DialogTitle>
        <DialogDescription>
          Are you sure you want to remove this domain? Any inboxes using it will fall back to the
          default sender.
        </DialogDescription>
        <DialogBody>
          {deletingDomain && (
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="h-5 w-5 text-zinc-400" />
                <Text className="font-medium">{deletingDomain.domain}</Text>
                <StatusBadge status={deletingDomain.status} />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete}>
            Remove Domain
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
