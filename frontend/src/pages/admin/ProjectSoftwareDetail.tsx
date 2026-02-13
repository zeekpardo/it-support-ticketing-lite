import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ProjectSoftwareDetail as ProjectSoftwareDetailType, SoftwareAccessRequest } from '../../api/client'
import { Text } from '@/components/ui/text'
import {
  DetailsSection,
  AdminsSection,
  RequestsSection,
  EditNotesModal,
  DeleteSoftwareModal,
  AddAdminModal,
  ReviewRequestModal,
  DeleteRequestModal,
} from './project-software-detail'
import type { EditFormState, StaffMember } from './project-software-detail'

export default function ProjectSoftwareDetail() {
  const { projectId, id } = useParams<{ projectId: string; id: string }>()
  const navigate = useNavigate()

  const [software, setSoftware] = useState<ProjectSoftwareDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

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

  // Edit management details
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>({
    renewalDate: '',
    billingCycle: '',
    cost: '',
    costType: '',
    autoRenewal: false,
    licenseType: '',
    totalSeats: '',
    vendorContactEmail: '',
    vendorContactPhone: '',
    contractUrl: '',
    loginUrl: '',
  })

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

  const startEditingDetails = () => {
    if (!software) return
    setEditForm({
      renewalDate: software.renewalDate ? new Date(software.renewalDate).toISOString().split('T')[0] : '',
      billingCycle: software.billingCycle || '',
      cost: software.cost ? String(parseFloat(software.cost)) : '',
      costType: software.costType || '',
      autoRenewal: software.autoRenewal || false,
      licenseType: software.licenseType || '',
      totalSeats: software.totalSeats != null ? String(software.totalSeats) : '',
      vendorContactEmail: software.vendorContactEmail || '',
      vendorContactPhone: software.vendorContactPhone || '',
      contractUrl: software.contractUrl || '',
      loginUrl: software.loginUrl || '',
    })
    setIsEditingDetails(true)
  }

  const handleSaveDetails = async () => {
    if (!projectId || !id) return
    setSavingDetails(true)
    try {
      await api.updateProjectSoftware(projectId, id, {
        renewalDate: editForm.renewalDate || null,
        billingCycle: editForm.billingCycle || null,
        cost: editForm.cost || null,
        costType: editForm.costType || null,
        autoRenewal: editForm.autoRenewal,
        licenseType: editForm.licenseType || null,
        totalSeats: editForm.totalSeats ? parseInt(editForm.totalSeats) : null,
        vendorContactEmail: editForm.vendorContactEmail || null,
        vendorContactPhone: editForm.vendorContactPhone || null,
        contractUrl: editForm.contractUrl || null,
        loginUrl: editForm.loginUrl || null,
      })
      setIsEditingDetails(false)
      loadSoftware()
    } catch (error) {
      console.error('Failed to save details:', error)
    } finally {
      setSavingDetails(false)
    }
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

  const handleQuickApprove = (request: SoftwareAccessRequest) => {
    setReviewingRequest(request)
    setReviewStatus('APPROVED')
    setReviewNotes('')
    handleReviewRequest()
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
      <DetailsSection
        software={software}
        isEditingDetails={isEditingDetails}
        savingDetails={savingDetails}
        editForm={editForm}
        onNavigateBack={() => navigate(`/admin/projects/${projectId}/software`)}
        onOpenWebsite={() => window.open(software.software.websiteUrl, '_blank')}
        onShowDeleteModal={() => setShowDeleteModal(true)}
        onOpenEditNotesModal={openEditModal}
        onStartEditingDetails={startEditingDetails}
        onCancelEditingDetails={() => setIsEditingDetails(false)}
        onSaveDetails={handleSaveDetails}
        onEditFormChange={setEditForm}
      />

      <AdminsSection
        software={software}
        availableMembers={availableMembers}
        onOpenAddAdminModal={openAddAdminModal}
        onRemoveAdmin={handleRemoveAdmin}
        onUpdateAdminRole={handleUpdateAdminRole}
      />

      <RequestsSection
        software={software}
        pendingRequests={pendingRequests}
        onQuickApprove={handleQuickApprove}
        onOpenReviewModal={openReviewModal}
        onOpenDeleteRequestModal={openDeleteRequestModal}
      />

      {showEditModal && (
        <EditNotesModal
          editNotes={editNotes}
          saving={saving}
          onEditNotesChange={setEditNotes}
          onSave={handleSaveNotes}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteSoftwareModal
          deleting={deleting}
          onDelete={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showAddAdminModal && (
        <AddAdminModal
          availableMembers={availableMembers}
          selectedMemberId={selectedMemberId}
          selectedRole={selectedRole}
          addingAdmin={addingAdmin}
          onSelectedMemberIdChange={setSelectedMemberId}
          onSelectedRoleChange={setSelectedRole}
          onAddAdmin={handleAddAdmin}
          onClose={() => setShowAddAdminModal(false)}
        />
      )}

      {showReviewModal && reviewingRequest && (
        <ReviewRequestModal
          reviewingRequest={reviewingRequest}
          reviewStatus={reviewStatus}
          reviewNotes={reviewNotes}
          reviewing={reviewing}
          onReviewStatusChange={setReviewStatus}
          onReviewNotesChange={setReviewNotes}
          onReview={handleReviewRequest}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {showDeleteRequestModal && deletingRequest && (
        <DeleteRequestModal
          deletingRequest={deletingRequest}
          deletingRequestLoading={deletingRequestLoading}
          onDelete={handleDeleteRequest}
          onClose={() => setShowDeleteRequestModal(false)}
        />
      )}
    </div>
  )
}
