import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ProjectSoftwareDetail as ProjectSoftwareDetailType, ProjectSoftwareAdmin, SoftwareAccessRequest } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  ArrowLeftIcon,
  ComputerDesktopIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

export default function ProjectSoftwareDetail() {
  const { projectId, id } = useParams<{ projectId: string; id: string }>()
  const navigate = useNavigate()

  const [software, setSoftware] = useState<ProjectSoftwareDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; user: { id: string; name: string; email: string } }>>([])

  // Edit notes
  const [showEditModal, setShowEditModal] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add admin modal
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'ADMIN'>('ADMIN')
  const [addingAdmin, setAddingAdmin] = useState(false)

  // Review request modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewingRequest, setReviewingRequest] = useState<SoftwareAccessRequest | null>(null)
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING'>('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewing, setReviewing] = useState(false)

  // Delete request modal
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false)
  const [deletingRequest, setDeletingRequest] = useState<SoftwareAccessRequest | null>(null)
  const [deletingRequestLoading, setDeletingRequestLoading] = useState(false)

  useEffect(() => {
    if (projectId && id) {
      loadSoftware()
      loadStaffMembers()
    }
  }, [projectId, id])

  const loadSoftware = async () => {
    if (!projectId || !id) return
    setLoading(true)
    try {
      const data = await api.getProjectSoftwareById(projectId, id)
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStaffMembers = async () => {
    try {
      const data = await api.getStaffMembers()
      setStaffMembers(data)
    } catch (error) {
      console.error('Failed to load staff members:', error)
    }
  }

  const openEditModal = () => {
    setEditNotes(software?.notes || '')
    setShowEditModal(true)
  }

  const handleSaveNotes = async () => {
    if (!projectId || !id) return
    setSaving(true)
    try {
      await api.updateProjectSoftware(projectId, id, { notes: editNotes })
      setShowEditModal(false)
      loadSoftware()
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId || !id) return
    setDeleting(true)
    try {
      await api.removeProjectSoftware(projectId, id)
      navigate(`/admin/projects/${projectId}/software`)
    } catch (error) {
      console.error('Failed to delete software:', error)
    } finally {
      setDeleting(false)
    }
  }

  const openAddAdminModal = () => {
    setSelectedMemberId('')
    setSelectedRole('ADMIN')
    setShowAddAdminModal(true)
  }

  const handleAddAdmin = async () => {
    if (!projectId || !id || !selectedMemberId) return
    setAddingAdmin(true)
    try {
      await api.addProjectSoftwareAdmin(projectId, id, {
        memberId: selectedMemberId,
        role: selectedRole
      })
      setShowAddAdminModal(false)
      loadSoftware()
    } catch (error) {
      console.error('Failed to add admin:', error)
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string) => {
    if (!projectId || !id) return
    try {
      await api.removeProjectSoftwareAdmin(projectId, id, adminId)
      loadSoftware()
    } catch (error) {
      console.error('Failed to remove admin:', error)
    }
  }

  const handleUpdateAdminRole = async (adminId: string, role: 'OWNER' | 'ADMIN') => {
    if (!projectId || !id) return
    try {
      await api.updateProjectSoftwareAdmin(projectId, id, adminId, { role })
      loadSoftware()
    } catch (error) {
      console.error('Failed to update admin role:', error)
    }
  }

  const openReviewModal = (request: SoftwareAccessRequest, defaultStatus?: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING') => {
    setReviewingRequest(request)
    setReviewStatus(defaultStatus || 'APPROVED')
    setReviewNotes('')
    setShowReviewModal(true)
  }

  const handleReviewRequest = async () => {
    if (!projectId || !id || !reviewingRequest) return
    setReviewing(true)
    try {
      await api.reviewAccessRequest(projectId, id, reviewingRequest.id, {
        status: reviewStatus,
        reviewNotes: reviewNotes || undefined
      })
      setShowReviewModal(false)
      setReviewingRequest(null)
      loadSoftware()
    } catch (error) {
      console.error('Failed to review request:', error)
    } finally {
      setReviewing(false)
    }
  }

  const openDeleteRequestModal = (request: SoftwareAccessRequest) => {
    setDeletingRequest(request)
    setShowDeleteRequestModal(true)
  }

  const handleDeleteRequest = async () => {
    if (!projectId || !id || !deletingRequest) return
    setDeletingRequestLoading(true)
    try {
      await api.deleteAccessRequest(projectId, id, deletingRequest.id)
      setShowDeleteRequestModal(false)
      setDeletingRequest(null)
      loadSoftware()
    } catch (error) {
      console.error('Failed to delete request:', error)
    } finally {
      setDeletingRequestLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge color="green">Approved</Badge>
      case 'PENDING':
        return <Badge color="amber">Pending</Badge>
      case 'DECLINED':
        return <Badge color="red">Declined</Badge>
      case 'REVOKED':
        return <Badge color="zinc">Revoked</Badge>
      default:
        return <Badge>{status}</Badge>
    }
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

  const existingAdminIds = new Set(software.admins.map(a => a.memberId))
  const availableMembers = staffMembers.filter(m => !existingAdminIds.has(m.id))
  const pendingRequests = software.accessRequests.filter(r => r.status === 'PENDING')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button plain onClick={() => navigate(`/admin/projects/${projectId}/software`)}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            {software.software.iconUrl ? (
              <img
                src={software.software.iconUrl}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                <ComputerDesktopIcon className="h-8 w-8 text-zinc-400" />
              </div>
            )}
            <div>
              <Heading>{software.software.name}</Heading>
              <div className="flex items-center gap-2 mt-1">
                {software.software.vendor && (
                  <Text className="text-zinc-500">{software.software.vendor}</Text>
                )}
                {software.software.category && (
                  <Badge color="zinc">{software.software.category.name}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {software.software.websiteUrl && (
            <Button outline onClick={() => window.open(software.software.websiteUrl, '_blank')}>
              <LinkIcon className="h-4 w-4" />
              Website
            </Button>
          )}
          <Button color="red" outline onClick={() => setShowDeleteModal(true)}>
            <TrashIcon className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Description */}
      {software.software.description && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
          <Text>{software.software.description}</Text>
        </div>
      )}

      {/* Project Notes */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <Subheading>Project Notes</Subheading>
          <Button plain onClick={openEditModal}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        </div>
        {software.notes ? (
          <Text className="whitespace-pre-wrap">{software.notes}</Text>
        ) : (
          <Text className="text-zinc-400 italic">No notes added</Text>
        )}
      </div>

      {/* Admins Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Subheading>Software Admins</Subheading>
          <Button outline onClick={openAddAdminModal} disabled={availableMembers.length === 0}>
            <UserPlusIcon className="h-4 w-4" />
            Add Admin
          </Button>
        </div>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader className="w-[100px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {software.admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.member.user.name}</TableCell>
                  <TableCell className="text-zinc-500">{admin.member.user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={admin.role}
                      onChange={(e) => handleUpdateAdminRole(admin.id, e.target.value as 'OWNER' | 'ADMIN')}
                      className="w-24"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button plain onClick={() => handleRemoveAdmin(admin.id)}>
                      <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {software.admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                    No admins assigned
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Access Requests Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Subheading>
            Access Requests
            {pendingRequests.length > 0 && (
              <Badge color="amber" className="ml-2">{pendingRequests.length} pending</Badge>
            )}
          </Subheading>
        </div>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Requester</TableHeader>
                <TableHeader>Reason</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader className="w-[150px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {software.accessRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.requester.user.name}</div>
                      <div className="text-sm text-zinc-500">{request.requester.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-500 max-w-xs truncate">
                    {request.reason || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {request.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button
                            color="green"
                            className="px-2 py-1 text-xs"
                            onClick={() => {
                              setReviewingRequest(request)
                              setReviewStatus('APPROVED')
                              setReviewNotes('')
                              handleReviewRequest()
                            }}
                          >
                            <CheckIcon className="h-3 w-3" />
                          </Button>
                          <Button
                            color="red"
                            className="px-2 py-1 text-xs"
                            onClick={() => openReviewModal(request, 'DECLINED')}
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <Select
                        value=""
                        onChange={(e) => {
                          const action = e.target.value
                          if (action === 'delete') {
                            openDeleteRequestModal(request)
                          } else if (action) {
                            openReviewModal(request, action as 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING')
                          }
                        }}
                        className="w-28 text-xs"
                      >
                        <option value="">Actions</option>
                        {request.status !== 'APPROVED' && <option value="APPROVED">Approve</option>}
                        {request.status !== 'DECLINED' && <option value="DECLINED">Decline</option>}
                        {request.status !== 'REVOKED' && <option value="REVOKED">Revoke</option>}
                        {request.status !== 'PENDING' && <option value="PENDING">Set Pending</option>}
                        <option value="delete">Delete</option>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {software.accessRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No access requests
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Notes Modal */}
      {showEditModal && (
        <Dialog open={true} onClose={() => setShowEditModal(false)} size="md">
          <DialogTitle>Edit Project Notes</DialogTitle>
          <DialogDescription>
            Add project-specific notes or setup instructions for this software.
          </DialogDescription>

          <DialogBody>
            <Field>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes..."
                rows={6}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowEditModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleSaveNotes} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Dialog open={true} onClose={() => setShowDeleteModal(false)} size="sm">
          <DialogTitle>Remove Software</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this software from the project? This will also remove all admins and access requests.
          </DialogDescription>

          <DialogActions>
            <Button plain onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <Dialog open={true} onClose={() => setShowAddAdminModal(false)} size="md">
          <DialogTitle>Add Software Admin</DialogTitle>
          <DialogDescription>
            Add a staff member as an admin for this software.
          </DialogDescription>

          <DialogBody>
            <FieldGroup>
              <Field>
                <Label>Staff Member</Label>
                <Select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Select member...</option>
                  {availableMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.user.name} ({m.user.email})</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Role</Label>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'OWNER' | 'ADMIN')}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </Select>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowAddAdminModal(false)} disabled={addingAdmin}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleAddAdmin} disabled={addingAdmin || !selectedMemberId}>
              {addingAdmin ? 'Adding...' : 'Add Admin'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Review Request Modal */}
      {showReviewModal && reviewingRequest && (
        <Dialog open={true} onClose={() => setShowReviewModal(false)} size="md">
          <DialogTitle>
            {reviewingRequest.status === 'PENDING' ? 'Review Access Request' : 'Update Access Status'}
          </DialogTitle>
          <DialogDescription>
            {reviewingRequest.status === 'PENDING'
              ? `Review the access request from ${reviewingRequest.requester.user.name}`
              : `Change the access status for ${reviewingRequest.requester.user.name}`}
          </DialogDescription>

          <DialogBody>
            {reviewingRequest.reason && (
              <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <Text className="text-sm font-medium">Reason:</Text>
                <Text className="text-zinc-600 dark:text-zinc-400">{reviewingRequest.reason}</Text>
              </div>
            )}
            <FieldGroup>
              <Field>
                <Label>Status</Label>
                <Select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING')}
                >
                  <option value="APPROVED">Approved</option>
                  <option value="DECLINED">Declined</option>
                  <option value="REVOKED">Revoked</option>
                  <option value="PENDING">Pending</option>
                </Select>
              </Field>
              <Field>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowReviewModal(false)} disabled={reviewing}>
              Cancel
            </Button>
            <Button
              color={reviewStatus === 'APPROVED' ? 'green' : reviewStatus === 'PENDING' ? 'amber' : 'red'}
              onClick={handleReviewRequest}
              disabled={reviewing}
            >
              {reviewing ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Request Modal */}
      {showDeleteRequestModal && deletingRequest && (
        <Dialog open={true} onClose={() => setShowDeleteRequestModal(false)} size="sm">
          <DialogTitle>Delete Access Request</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this access request from {deletingRequest.requester.user.name}? This action cannot be undone.
          </DialogDescription>

          <DialogActions>
            <Button plain onClick={() => setShowDeleteRequestModal(false)} disabled={deletingRequestLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteRequest} disabled={deletingRequestLoading}>
              {deletingRequestLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}
