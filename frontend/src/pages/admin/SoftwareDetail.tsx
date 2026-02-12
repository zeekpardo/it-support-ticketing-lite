import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type OrganizationSoftwareDetail, type SoftwareAdmin } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline'
import { SoftwareAdminList, SoftwareAccessRequestList } from '@/components/software'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export default function SoftwareDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg, membership } = useOrganization()
  const [software, setSoftware] = useState<OrganizationSoftwareDetail | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [newAdminMemberId, setNewAdminMemberId] = useState('')
  const [newAdminRole, setNewAdminRole] = useState<'OWNER' | 'ADMIN'>('ADMIN')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const isOwner = software?.admins.some(
    (admin) => admin.memberId === membership?.id && admin.role === 'OWNER'
  )
  const isOrgAdmin = membership?.role === 'owner' || membership?.role === 'manager'
  const canManage = isOwner || isOrgAdmin

  useEffect(() => {
    if (currentOrg && id) {
      loadData()
    }
  }, [currentOrg, id])

  const loadData = async () => {
    if (!id) return

    setLoading(true)
    try {
      const [softwareData, staffData] = await Promise.all([
        api.getOrganizationSoftwareById(id),
        api.getStaffMembers()
      ])
      setSoftware(softwareData)
      setEditNotes(softwareData.notes || '')
      setStaffMembers(staffData)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateNotes = async () => {
    if (!id) return

    setSaving(true)
    try {
      await api.updateOrganizationSoftware(id, { notes: editNotes })
      setShowEditModal(false)
      loadData()
    } catch (error) {
      console.error('Failed to update:', error)
      alert('Failed to update software')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!id) return

    setSaving(true)
    try {
      await api.removeOrganizationSoftware(id)
      navigate('/admin/software')
    } catch (error) {
      console.error('Failed to remove:', error)
      alert('Failed to remove software from organization')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAdmin = async () => {
    if (!id || !newAdminMemberId) return

    setSaving(true)
    try {
      await api.addOrgSoftwareAdmin(id, {
        memberId: newAdminMemberId,
        role: newAdminRole
      })
      setShowAddAdminModal(false)
      setNewAdminMemberId('')
      setNewAdminRole('ADMIN')
      loadData()
    } catch (error) {
      console.error('Failed to add admin:', error)
      alert(error instanceof Error ? error.message : 'Failed to add admin')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string) => {
    if (!id) return

    setSaving(true)
    try {
      await api.removeOrgSoftwareAdmin(id, adminId)
      loadData()
    } catch (error) {
      console.error('Failed to remove admin:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove admin')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAdminRole = async (adminId: string, role: 'OWNER' | 'ADMIN') => {
    if (!id) return

    setSaving(true)
    try {
      await api.updateOrgSoftwareAdmin(id, adminId, { role })
      loadData()
    } catch (error) {
      console.error('Failed to update admin:', error)
      alert(error instanceof Error ? error.message : 'Failed to update admin')
    } finally {
      setSaving(false)
    }
  }

  const handleReviewRequest = async (requestId: string, status: 'APPROVED' | 'DECLINED', reviewNotes?: string) => {
    if (!id) return

    setSaving(true)
    try {
      await api.reviewAccessRequest(id, requestId, { status, reviewNotes })
      loadData()
    } catch (error) {
      console.error('Failed to review request:', error)
      alert(error instanceof Error ? error.message : 'Failed to review request')
    } finally {
      setSaving(false)
    }
  }

  // Filter out members who are already admins
  const availableStaff = staffMembers.filter(
    (staff) => !software?.admins.some((admin) => admin.memberId === staff.id)
  )

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

  if (!software) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Software not found</Text>
      </div>
    )
  }

  const pendingRequests = software.accessRequests.filter((r) => r.status === 'PENDING')
  const processedRequests = software.accessRequests.filter((r) => r.status !== 'PENDING')
  const globalSoftware = software.software

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button plain onClick={() => navigate('/admin/software')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>

          {globalSoftware.iconUrl ? (
            <img
              src={globalSoftware.iconUrl}
              alt={globalSoftware.name}
              className="w-16 h-16 rounded-xl object-contain bg-zinc-100 dark:bg-zinc-800"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ComputerDesktopIcon className="w-8 h-8 text-zinc-400" />
            </div>
          )}

          <div>
            <Heading>{globalSoftware.name}</Heading>
            <div className="flex items-center gap-2 mt-1">
              {globalSoftware.vendor && (
                <Text className="text-zinc-500">{globalSoftware.vendor}</Text>
              )}
              {globalSoftware.category && (
                <Badge color="zinc">{globalSoftware.category.name}</Badge>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button outline onClick={() => setShowEditModal(true)}>
              <PencilIcon className="h-4 w-4" />
              Edit Notes
            </Button>
            <Button color="red" outline onClick={() => setShowDeleteModal(true)}>
              <TrashIcon className="h-4 w-4" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {globalSoftware.description && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading>Description</Subheading>
              <Text className="mt-2 whitespace-pre-wrap">{globalSoftware.description}</Text>
            </div>
          )}

          {/* Website & Notes */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Subheading>Details</Subheading>
            <dl className="mt-4 space-y-3">
              {globalSoftware.websiteUrl && (
                <div>
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Website</dt>
                  <dd>
                    <a
                      href={globalSoftware.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <GlobeAltIcon className="h-4 w-4" />
                      {globalSoftware.websiteUrl}
                    </a>
                  </dd>
                </div>
              )}
              {software.notes && (
                <div>
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Organization Notes</dt>
                  <dd className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {software.notes}
                  </dd>
                </div>
              )}
              {software.addedBy && (
                <div>
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Added By</dt>
                  <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                    {software.addedBy.user.name}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Access Requests */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="flex items-center justify-between mb-4">
              <Subheading>
                Pending Access Requests
                {pendingRequests.length > 0 && (
                  <Badge color="amber" className="ml-2">{pendingRequests.length}</Badge>
                )}
              </Subheading>
            </div>
            <SoftwareAccessRequestList
              requests={pendingRequests}
              onReview={handleReviewRequest}
              canReview={canManage || software.admins.some((a) => a.memberId === membership?.id)}
              isLoading={saving}
            />
          </div>

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <Subheading className="mb-4">Request History</Subheading>
              <SoftwareAccessRequestList
                requests={processedRequests}
                onReview={handleReviewRequest}
                canReview={false}
                isLoading={saving}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Admins */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="flex items-center justify-between mb-4">
              <Subheading>Admins</Subheading>
              {canManage && availableStaff.length > 0 && (
                <Button plain onClick={() => setShowAddAdminModal(true)}>
                  <UserPlusIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
            <SoftwareAdminList
              admins={software.admins}
              onRemove={handleRemoveAdmin}
              onUpdateRole={handleUpdateAdminRole}
              canManage={canManage || false}
              isLoading={saving}
            />
          </div>
        </div>
      </div>

      {/* Edit Notes Modal */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)}>
        <DialogTitle>Edit Organization Notes</DialogTitle>
        <DialogBody>
          <Field>
            <Label>Notes</Label>
            <Description>
              Add organization-specific notes about this software (e.g., licensing, internal setup instructions).
            </Description>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              placeholder="Add notes..."
            />
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleUpdateNotes} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Confirmation Modal */}
      <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <DialogTitle>Remove Software</DialogTitle>
        <DialogBody>
          <Text>
            Are you sure you want to remove <strong>{globalSoftware.name}</strong> from your organization?
            This will also remove all access requests and admin assignments.
          </Text>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleRemove} disabled={saving}>
            {saving ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Admin Modal */}
      <Dialog open={showAddAdminModal} onClose={() => setShowAddAdminModal(false)}>
        <DialogTitle>Add Admin</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <Field>
              <Label>Staff Member</Label>
              <Select
                value={newAdminMemberId}
                onChange={(e) => setNewAdminMemberId(e.target.value)}
              >
                <option value="">Select a staff member</option>
                {availableStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.user.name} ({staff.role})
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Role</Label>
              <Select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value as 'OWNER' | 'ADMIN')}
              >
                <option value="ADMIN">Admin - Approve requests only</option>
                <option value="OWNER">Owner - Full control</option>
              </Select>
            </Field>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowAddAdminModal(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleAddAdmin} disabled={!newAdminMemberId || saving}>
            {saving ? 'Adding...' : 'Add Admin'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
