import { useState } from 'react'
import { api, SoftwareAccessRequest } from '../../api/client'
import { Subheading } from '@/components/ui/heading'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import { Field, Label } from '@/components/ui/fieldset'
import { Textarea } from '@/components/ui/textarea'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface PendingSoftwareRequest extends SoftwareAccessRequest {
  inboxSoftware: {
    software: { id: string; name: string; iconUrl?: string }
    inbox: { id: string; name: string; inboxCode: string; defaultAssigneeId?: string }
  }
}

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface SoftwareAccessRequestReviewProps {
  pendingRequests: PendingSoftwareRequest[]
  staffMembers: StaffMember[]
  onRequestReviewed: () => void
  onRequestAssigned: (requestId: string, assigneeId: string | null) => void
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SoftwareAccessRequestReview({
  pendingRequests,
  staffMembers,
  onRequestReviewed,
  onRequestAssigned,
}: SoftwareAccessRequestReviewProps) {
  const [reviewingRequest, setReviewingRequest] = useState<PendingSoftwareRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'DECLINED'>('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const handleReviewClick = (request: PendingSoftwareRequest, action: 'APPROVED' | 'DECLINED') => {
    setReviewingRequest(request)
    setReviewAction(action)
    setReviewNotes('')
  }

  const handleSubmitReview = async () => {
    if (!reviewingRequest) return
    setReviewLoading(true)
    try {
      await api.reviewAccessRequest(
        reviewingRequest.inboxSoftware.inbox.id,
        reviewingRequest.inboxSoftwareId,
        reviewingRequest.id,
        { status: reviewAction, reviewNotes: reviewNotes.trim() || undefined }
      )
      setReviewingRequest(null)
      onRequestReviewed()
    } catch (error) {
      console.error('Failed to review request:', error)
    } finally {
      setReviewLoading(false)
    }
  }

  if (pendingRequests.length === 0) return null

  return (
    <>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <Subheading className="mb-4">Pending Software Requests ({pendingRequests.length})</Subheading>
        <div className="space-y-3">
          {pendingRequests.map((request) => (
            <div
              key={request.id}
              className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {request.inboxSoftware.software.iconUrl && (
                      <img
                        src={request.inboxSoftware.software.iconUrl}
                        alt=""
                        className="w-6 h-6 rounded"
                      />
                    )}
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {request.inboxSoftware.software.name}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      {request.inboxSoftware.inbox.name}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    <span className="font-medium">{request.requester?.user.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500"> ({request.requester?.user.email})</span>
                  </p>
                  {request.reason && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      <span className="font-medium">Reason:</span> {request.reason}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Requested {formatDate(request.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-40">
                    <Select
                      value={request.assigneeId || ''}
                      onChange={(e) => onRequestAssigned(request.id, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {staffMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    color="green"
                    onClick={() => handleReviewClick(request, 'APPROVED')}
                  >
                    <CheckIcon className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    color="red"
                    onClick={() => handleReviewClick(request, 'DECLINED')}
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Access Request Modal */}
      <Dialog open={!!reviewingRequest} onClose={() => setReviewingRequest(null)}>
        <DialogTitle>
          {reviewAction === 'APPROVED' ? 'Approve' : 'Decline'} Access Request
        </DialogTitle>
        <DialogBody>
          {reviewingRequest && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {reviewAction === 'APPROVED'
                  ? `Grant ${reviewingRequest.requester?.user.name} access to ${reviewingRequest.inboxSoftware.software.name}?`
                  : `Decline ${reviewingRequest.requester?.user.name}'s request for ${reviewingRequest.inboxSoftware.software.name}?`}
              </p>
              <Field>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewAction === 'APPROVED'
                      ? 'Any additional instructions or information...'
                      : 'Reason for declining...'
                  }
                  rows={3}
                />
              </Field>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setReviewingRequest(null)}>
            Cancel
          </Button>
          <Button
            color={reviewAction === 'APPROVED' ? 'green' : 'red'}
            onClick={handleSubmitReview}
            disabled={reviewLoading}
          >
            {reviewLoading ? 'Saving...' : reviewAction === 'APPROVED' ? 'Approve' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
