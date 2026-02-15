import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ProjectSoftwareDetail as ProjectSoftwareDetailType, SoftwareAccessRequest } from '../../api/client'
import { useModalForm } from '../../hooks/useModalForm'
import { useCrudForm } from '../../hooks/useCrudForm'
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

  // Edit notes modal
  const editNotesModal = useModalForm({
    initialData: { notes: '' },
  })

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add admin modal
  const addAdminModal = useModalForm({
    initialData: { memberId: '', role: 'ADMIN' as 'OWNER' | 'ADMIN' },
  })

  // Review request modal
  const reviewModal = useModalForm<
    { status: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING'; notes: string },
    SoftwareAccessRequest
  >({
    initialData: { status: 'APPROVED', notes: '' },
    mapEditItem: () => ({ status: 'APPROVED', notes: '' }),
  })

  // Delete request modal
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false)
  const [deletingRequest, setDeletingRequest] = useState<SoftwareAccessRequest | null>(null)
  const [deletingRequestLoading, setDeletingRequestLoading] = useState(false)

  // Edit management details
  const detailsForm = useCrudForm<EditFormState>({
    initialData: {
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
    },
  })
  const [isEditingDetails, setIsEditingDetails] = useState(false)

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
    editNotesModal.open()
    editNotesModal.setField('notes', software?.notes || '')
  }

  const startEditingDetails = () => {
    if (!software) return
    detailsForm.setData({
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
    try {
      await detailsForm.handleSubmit(async () => {
        await api.updateProjectSoftware(projectId!, id!, {
          renewalDate: detailsForm.data.renewalDate || null,
          billingCycle: detailsForm.data.billingCycle || null,
          cost: detailsForm.data.cost || null,
          costType: detailsForm.data.costType || null,
          autoRenewal: detailsForm.data.autoRenewal,
          licenseType: detailsForm.data.licenseType || null,
          totalSeats: detailsForm.data.totalSeats ? parseInt(detailsForm.data.totalSeats) : null,
          vendorContactEmail: detailsForm.data.vendorContactEmail || null,
          vendorContactPhone: detailsForm.data.vendorContactPhone || null,
          contractUrl: detailsForm.data.contractUrl || null,
          loginUrl: detailsForm.data.loginUrl || null,
        })
        setIsEditingDetails(false)
        loadSoftware()
      })
    } catch (error) {
      console.error('Failed to save details:', error)
    }
  }

  const handleSaveNotes = async () => {
    if (!projectId || !id) return
    try {
      await editNotesModal.handleSubmit(async () => {
        await api.updateProjectSoftware(projectId!, id!, { notes: editNotesModal.formData.notes })
        editNotesModal.close()
        loadSoftware()
      })
    } catch (error) {
      console.error('Failed to save notes:', error)
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
    addAdminModal.open()
  }

  const handleAddAdmin = async () => {
    if (!projectId || !id || !addAdminModal.formData.memberId) return
    try {
      await addAdminModal.handleSubmit(async () => {
        await api.addProjectSoftwareAdmin(projectId!, id!, {
          memberId: addAdminModal.formData.memberId,
          role: addAdminModal.formData.role
        })
        addAdminModal.close()
        loadSoftware()
      })
    } catch (error) {
      console.error('Failed to add admin:', error)
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
    reviewModal.open(request)
    if (defaultStatus) reviewModal.setField('status', defaultStatus)
  }

  const handleReviewRequest = async () => {
    if (!projectId || !id || !reviewModal.editingItem) return
    try {
      await reviewModal.handleSubmit(async () => {
        await api.reviewAccessRequest(projectId!, id!, reviewModal.editingItem!.id, {
          status: reviewModal.formData.status,
          reviewNotes: reviewModal.formData.notes || undefined
        })
        reviewModal.close()
        loadSoftware()
      })
    } catch (error) {
      console.error('Failed to review request:', error)
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
    openReviewModal(request, 'APPROVED')
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
        savingDetails={detailsForm.saving}
        editForm={detailsForm.data}
        onNavigateBack={() => navigate(`/admin/projects/${projectId}/software`)}
        onOpenWebsite={() => window.open(software.software.websiteUrl, '_blank')}
        onShowDeleteModal={() => setShowDeleteModal(true)}
        onOpenEditNotesModal={openEditModal}
        onStartEditingDetails={startEditingDetails}
        onCancelEditingDetails={() => setIsEditingDetails(false)}
        onSaveDetails={handleSaveDetails}
        onEditFormChange={detailsForm.setData}
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

      {editNotesModal.isOpen && (
        <EditNotesModal
          editNotes={editNotesModal.formData.notes}
          saving={editNotesModal.saving}
          onEditNotesChange={(v) => editNotesModal.setField('notes', v)}
          onSave={handleSaveNotes}
          onClose={editNotesModal.close}
        />
      )}

      {showDeleteModal && (
        <DeleteSoftwareModal
          deleting={deleting}
          onDelete={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {addAdminModal.isOpen && (
        <AddAdminModal
          availableMembers={availableMembers}
          selectedMemberId={addAdminModal.formData.memberId}
          selectedRole={addAdminModal.formData.role}
          addingAdmin={addAdminModal.saving}
          onSelectedMemberIdChange={(v) => addAdminModal.setField('memberId', v)}
          onSelectedRoleChange={(v) => addAdminModal.setField('role', v)}
          onAddAdmin={handleAddAdmin}
          onClose={addAdminModal.close}
        />
      )}

      {reviewModal.isOpen && reviewModal.editingItem && (
        <ReviewRequestModal
          reviewingRequest={reviewModal.editingItem}
          reviewStatus={reviewModal.formData.status}
          reviewNotes={reviewModal.formData.notes}
          reviewing={reviewModal.saving}
          onReviewStatusChange={(v) => reviewModal.setField('status', v)}
          onReviewNotesChange={(v) => reviewModal.setField('notes', v)}
          onReview={handleReviewRequest}
          onClose={reviewModal.close}
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
