import { useState, useEffect } from 'react'
import { admin } from '../../../lib/auth-client'
import { api } from '../../../api/client'
import type { SuperAdminAccount, SuperAdminAccountMember, AccountInbox } from '../../../api/client'
import { useModalForm } from '../../../hooks/useModalForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  ChevronUpIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  UserIcon,
  FolderIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

const BASE_DOMAIN = 'groovi.support'

// ==========================================
// Members Sub-Table (inline expansion)
// ==========================================

function MembersPanel({
  members,
  loading,
  onRoleChange,
  onBan,
  onUnban,
  onImpersonate,
  onEditProjects,
  onRemoveMember,
  impersonatingUserId,
}: {
  members: SuperAdminAccountMember[]
  loading: boolean
  onRoleChange: (memberId: string, role: string) => void
  onBan: (userId: string) => void
  onUnban: (userId: string) => void
  onImpersonate: (userId: string) => void
  onEditInboxes: (member: SuperAdminAccountMember) => void
  onRemoveMember: (member: SuperAdminAccountMember) => void
  impersonatingUserId: string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Text>Loading members...</Text>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <Text className="text-zinc-400">No members in this account</Text>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>User</TableHeader>
            <TableHeader>Role</TableHeader>
            <TableHeader>Inboxes</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader className="w-[200px]">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div>
                  <span className="font-medium">{member.user.name}</span>
                  <div className="text-xs text-zinc-500">{member.user.email}</div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={member.role}
                  onChange={(e) => onRoleChange(member.id, e.target.value)}
                  className="w-28"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="client">Client</option>
                </Select>
              </TableCell>
              <TableCell>
                {member.inboxAssignments.length > 0 ? (
                  <span className="text-sm text-zinc-500">
                    {member.inboxAssignments.map(ia => ia.inbox.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-sm text-zinc-400">No inboxes</span>
                )}
              </TableCell>
              <TableCell>
                {member.user.banned ? (
                  <Badge color="red">Banned</Badge>
                ) : (
                  <Badge color="green">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Tooltip content="Assign inboxes">
                    <Button plain onClick={() => onEditInboxes(member)}>
                      <FolderIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                  </Tooltip>
                  {member.user.banned ? (
                    <Tooltip content="Unban user">
                      <Button plain onClick={() => onUnban(member.user.id)}>
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Ban user">
                      <Button plain onClick={() => onBan(member.user.id)}>
                        <NoSymbolIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip content="Impersonate user">
                    <Button
                      plain
                      onClick={() => onImpersonate(member.user.id)}
                      disabled={impersonatingUserId === member.user.id}
                    >
                      <UserIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Remove from account">
                    <Button plain onClick={() => onRemoveMember(member)}>
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ==========================================
// Main AccountsTab Component
// ==========================================

export function AccountsTab() {
  // Account list state
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  // Expanded members
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)
  const [members, setMembers] = useState<SuperAdminAccountMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Edit account modal (reuses useModalForm)
  const modal = useModalForm<
    { name: string; slug: string; appName: string; primaryColor: string; subdomainEnabled: boolean },
    SuperAdminAccount
  >({
    initialData: { name: '', slug: '', appName: '', primaryColor: '', subdomainEnabled: false },
    mapEditItem: (account) => ({
      name: account.name,
      slug: account.slug,
      appName: account.appName || '',
      primaryColor: account.primaryColor || '',
      subdomainEnabled: account.subdomainEnabled,
    }),
  })

  // Delete account confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState<SuperAdminAccount | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Ban modal state (matches UsersTab pattern)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDays, setBanDays] = useState('')
  const [banning, setBanning] = useState(false)

  // Impersonation
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // Inbox assignment modal
  const [showInboxesModal, setShowInboxesModal] = useState(false)
  const [inboxesMember, setInboxesMember] = useState<SuperAdminAccountMember | null>(null)
  const [accountInboxes, setAccountInboxes] = useState<AccountInbox[]>([])
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>([])
  const [savingInboxes, setSavingInboxes] = useState(false)

  // Remove member confirmation
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false)
  const [removingMember, setRemovingMember] = useState<SuperAdminAccountMember | null>(null)
  const [removingMemberLoading, setRemovingMemberLoading] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [offset])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const result = await api.getSuperAdminAccounts({
        limit,
        offset,
        search: searchValue || undefined,
      })
      setAccounts(result.accounts || [])
      setTotal(result.total || 0)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    loadAccounts()
  }

  // ==========================================
  // Members expansion
  // ==========================================

  const toggleMembers = async (accountId: string) => {
    if (expandedAccountId === accountId) {
      setExpandedAccountId(null)
      setMembers([])
      return
    }
    setExpandedAccountId(accountId)
    setMembersLoading(true)
    try {
      const result = await api.getSuperAdminAccountMembers(accountId)
      setMembers(result)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setMembersLoading(false)
    }
  }

  const refreshMembers = async () => {
    if (!expandedAccountId) return
    const result = await api.getSuperAdminAccountMembers(expandedAccountId)
    setMembers(result)
  }

  // ==========================================
  // Member role change
  // ==========================================

  const handleMemberRoleChange = async (memberId: string, newRole: string) => {
    if (!expandedAccountId) return
    try {
      await api.updateSuperAdminAccountMember(expandedAccountId, memberId, { role: newRole })
      await refreshMembers()
    } catch (error) {
      console.error('Failed to update member role:', error)
    }
  }

  // ==========================================
  // Ban / Unban (uses better-auth admin client, same as UsersTab)
  // ==========================================

  const openBanModal = (userId: string) => {
    setBanUserId(userId)
    setBanReason('')
    setBanDays('')
    setShowBanModal(true)
  }

  const handleBanUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanning(true)
    try {
      await admin.banUser({
        userId: banUserId,
        banReason: banReason || undefined,
        banExpiresIn: banDays ? parseInt(banDays) * 24 * 60 * 60 : undefined,
      })
      setShowBanModal(false)
      setBanUserId('')
      setBanReason('')
      setBanDays('')
      await refreshMembers()
    } catch (error) {
      console.error('Failed to ban user:', error)
    } finally {
      setBanning(false)
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      await admin.unbanUser({ userId })
      await refreshMembers()
    } catch (error) {
      console.error('Failed to unban user:', error)
    }
  }

  // ==========================================
  // Impersonate (uses better-auth admin client, same as UsersTab)
  // ==========================================

  const handleImpersonate = async (userId: string) => {
    try {
      setImpersonating(userId)
      await admin.impersonateUser({ userId })
      window.location.href = '/'
    } catch (error) {
      console.error('Failed to impersonate user:', error)
      setImpersonating(null)
    }
  }

  // ==========================================
  // Inbox assignments
  // ==========================================

  const openInboxesModal = async (member: SuperAdminAccountMember) => {
    if (!expandedAccountId) return
    setInboxesMember(member)
    setSelectedInboxIds(member.inboxAssignments.map(ia => ia.inbox.id))
    try {
      const inboxes = await api.getSuperAdminAccountInboxes(expandedAccountId)
      setAccountInboxes(inboxes)
    } catch (error) {
      console.error('Failed to load inboxes:', error)
    }
    setShowInboxesModal(true)
  }

  const toggleInboxSelection = (inboxId: string) => {
    setSelectedInboxIds(prev =>
      prev.includes(inboxId)
        ? prev.filter(id => id !== inboxId)
        : [...prev, inboxId]
    )
  }

  const handleSaveInboxes = async () => {
    if (!expandedAccountId || !inboxesMember) return
    setSavingInboxes(true)
    try {
      await api.updateSuperAdminMemberInboxes(expandedAccountId, inboxesMember.id, selectedInboxIds)
      setShowInboxesModal(false)
      setInboxesMember(null)
      await refreshMembers()
    } catch (error) {
      console.error('Failed to update inboxes:', error)
    } finally {
      setSavingInboxes(false)
    }
  }

  // ==========================================
  // Remove member
  // ==========================================

  const openRemoveMemberModal = (member: SuperAdminAccountMember) => {
    setRemovingMember(member)
    setShowRemoveMemberModal(true)
  }

  const handleRemoveMember = async () => {
    if (!expandedAccountId || !removingMember) return
    setRemovingMemberLoading(true)
    try {
      await api.removeSuperAdminAccountMember(expandedAccountId, removingMember.id)
      setShowRemoveMemberModal(false)
      setRemovingMember(null)
      await refreshMembers()
      loadAccounts()
    } catch (error) {
      console.error('Failed to remove member:', error)
    } finally {
      setRemovingMemberLoading(false)
    }
  }

  // ==========================================
  // Edit account
  // ==========================================

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await modal.handleSubmit(async () => {
      await api.updateSuperAdminAccount(modal.editingItem!.id, modal.formData)
      modal.close()
      loadAccounts()
    })
  }

  // ==========================================
  // Toggle subdomain
  // ==========================================

  const handleToggleSubdomain = async (account: SuperAdminAccount) => {
    try {
      await api.updateSuperAdminAccount(account.id, {
        name: account.name,
        subdomainEnabled: !account.subdomainEnabled,
      })
      setAccounts(prev => prev.map(a =>
        a.id === account.id ? { ...a, subdomainEnabled: !a.subdomainEnabled } : a
      ))
    } catch (error) {
      console.error('Failed to toggle subdomain:', error)
    }
  }

  // ==========================================
  // Delete account
  // ==========================================

  const openDeleteModal = (account: SuperAdminAccount) => {
    setDeletingAccount(account)
    setDeleteConfirmName('')
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deletingAccount) return
    setDeleting(true)
    try {
      await api.deleteSuperAdminAccount(deletingAccount.id)
      setShowDeleteModal(false)
      if (expandedAccountId === deletingAccount.id) {
        setExpandedAccountId(null)
        setMembers([])
      }
      setDeletingAccount(null)
      loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  if (loading && accounts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text className="text-zinc-500">Manage all accounts (organizations) across the platform</Text>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="flex-1">
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search by name or slug..."
          />
        </div>
        <Button type="submit" outline>
          <MagnifyingGlassIcon className="h-4 w-4" />
          Search
        </Button>
        <Button
          type="button"
          outline
          onClick={() => {
            setSearchValue('')
            setOffset(0)
            loadAccounts()
          }}
        >
          <ArrowPathIcon className="h-4 w-4" />
          Reset
        </Button>
      </form>

      {/* Accounts Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Subdomain</TableHeader>
              <TableHeader>Members</TableHeader>
              <TableHeader>Inboxes</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader className="w-[160px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <>
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={account.subdomainEnabled}
                        onChange={() => handleToggleSubdomain(account)}
                        className="shrink-0"
                      />
                      {account.subdomainEnabled ? (
                        <a
                          href={`https://${account.slug}.${BASE_DOMAIN}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {account.slug}.{BASE_DOMAIN}
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-400">{account.slug}.{BASE_DOMAIN}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color="zinc">{account._count.members}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge color="zinc">{account._count.inboxes}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Tooltip content={expandedAccountId === account.id ? 'Hide members' : 'View members'}>
                        <Button plain onClick={() => toggleMembers(account.id)}>
                          {expandedAccountId === account.id ? (
                            <ChevronUpIcon className="h-4 w-4 text-blue-500" />
                          ) : (
                            <UsersIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                          )}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Edit account">
                        <Button plain onClick={() => modal.open(account)}>
                          <PencilIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete account">
                        <Button plain onClick={() => openDeleteModal(account)}>
                          <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                        </Button>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedAccountId === account.id && (
                  <TableRow key={`${account.id}-members`}>
                    <TableCell colSpan={6} className="p-0">
                      <MembersPanel
                        members={members}
                        loading={membersLoading}
                        onRoleChange={handleMemberRoleChange}
                        onBan={openBanModal}
                        onUnban={handleUnbanUser}
                        onImpersonate={handleImpersonate}
                        onEditInboxes={openInboxesModal}
                        onRemoveMember={openRemoveMemberModal}
                        impersonatingUserId={impersonating}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                  No accounts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} accounts
          </Text>
          <div className="flex gap-2">
            <Button
              outline
              disabled={currentPage === 1}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              outline
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {modal.isOpen && (
        <Dialog open={true} onClose={modal.close} size="md">
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>Update account details</DialogDescription>

          <form onSubmit={handleEditSubmit}>
            <DialogBody>
              {modal.error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {modal.error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Name *</Label>
                  <Input
                    type="text"
                    value={modal.formData.name}
                    onChange={(e) => modal.setField('name', e.target.value)}
                    placeholder="Account name"
                    required
                  />
                </Field>

                <Field>
                  <Label>Slug</Label>
                  <Input
                    type="text"
                    value={modal.formData.slug}
                    onChange={(e) => modal.setField('slug', e.target.value)}
                    placeholder="account-slug"
                  />
                </Field>

                <Field>
                  <Label>App Name</Label>
                  <Input
                    type="text"
                    value={modal.formData.appName}
                    onChange={(e) => modal.setField('appName', e.target.value)}
                    placeholder="Custom app name (branding)"
                  />
                </Field>

                <Field>
                  <Label>Primary Color</Label>
                  <Input
                    type="text"
                    value={modal.formData.primaryColor}
                    onChange={(e) => modal.setField('primaryColor', e.target.value)}
                    placeholder="#3B82F6"
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Subdomain Routing</Label>
                      <p className="text-sm text-zinc-500">
                        Enable <span className="font-mono text-xs">{modal.formData.slug || 'slug'}.{BASE_DOMAIN}</span>
                      </p>
                    </div>
                    <Switch
                      checked={modal.formData.subdomainEnabled}
                      onChange={(checked) => modal.setField('subdomainEnabled', checked)}
                    />
                  </div>
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={modal.close} disabled={modal.saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={modal.saving}>
                {modal.saving ? 'Saving...' : 'Update Account'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && deletingAccount && (
        <Dialog open={true} onClose={() => setShowDeleteModal(false)} size="md">
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This action is <strong>permanent and irreversible</strong>. Deleting{' '}
            <strong>{deletingAccount.name}</strong> will permanently remove:
          </DialogDescription>

          <DialogBody>
            <ul className="mb-4 list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>{deletingAccount._count.members} member{deletingAccount._count.members !== 1 ? 's' : ''}</li>
              <li>{deletingAccount._count.inboxes} inbox{deletingAccount._count.inboxes !== 1 ? 'es' : ''}</li>
              <li>{deletingAccount._count.tickets} ticket{deletingAccount._count.tickets !== 1 ? 's' : ''}</li>
              <li>{deletingAccount._count.timeEntries} time entr{deletingAccount._count.timeEntries !== 1 ? 'ies' : 'y'}</li>
              <li>All attachments, comments, and associated files</li>
            </ul>

            <Field>
              <Label>
                Type <strong>{deletingAccount.name}</strong> to confirm
              </Label>
              <Input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deletingAccount.name}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deletingAccount.name}
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Ban User Modal (matches UsersTab pattern) */}
      {showBanModal && (
        <Dialog open={true} onClose={() => setShowBanModal(false)} size="md">
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            Ban this user from the platform. They will be signed out and unable to log in.
          </DialogDescription>

          <form onSubmit={handleBanUser}>
            <DialogBody>
              <FieldGroup>
                <Field>
                  <Label>Ban Reason (optional)</Label>
                  <Input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Violation of terms of service"
                  />
                </Field>

                <Field>
                  <Label>Ban Duration (days, leave empty for permanent)</Label>
                  <Input
                    type="number"
                    value={banDays}
                    onChange={(e) => setBanDays(e.target.value)}
                    placeholder="7"
                    min="1"
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowBanModal(false)} disabled={banning}>
                Cancel
              </Button>
              <Button color="red" type="submit" disabled={banning}>
                {banning ? 'Banning...' : 'Ban User'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Inbox Assignment Modal */}
      {showInboxesModal && inboxesMember && (
        <Dialog open={true} onClose={() => setShowInboxesModal(false)} size="md">
          <DialogTitle>Assign Inboxes</DialogTitle>
          <DialogDescription>
            Select inboxes for <strong>{inboxesMember.user.name}</strong>
          </DialogDescription>

          <DialogBody>
            {accountInboxes.length === 0 ? (
              <Text className="text-zinc-400 py-4 text-center">No inboxes in this account</Text>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {accountInboxes.map((inbox) => (
                  <label
                    key={inbox.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInboxIds.includes(inbox.id)}
                      onChange={() => toggleInboxSelection(inbox.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-sm">{inbox.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">{inbox.inboxCode}</span>
                      {!inbox.isActive && (
                        <Badge color="zinc" className="ml-2">Inactive</Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowInboxesModal(false)} disabled={savingInboxes}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleSaveInboxes} disabled={savingInboxes}>
              {savingInboxes ? 'Saving...' : 'Save Inboxes'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveMemberModal && removingMember && (
        <Dialog open={true} onClose={() => setShowRemoveMemberModal(false)} size="sm">
          <DialogTitle>Remove Member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove <strong>{removingMember.user.name}</strong> ({removingMember.user.email}) from this account?
            This will remove their membership, inbox assignments, and associated data within this organization.
          </DialogDescription>

          <DialogActions>
            <Button plain onClick={() => setShowRemoveMemberModal(false)} disabled={removingMemberLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleRemoveMember} disabled={removingMemberLoading}>
              {removingMemberLoading ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}
