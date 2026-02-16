import { useState } from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '../ui/dialog'
import { Textarea } from '../ui/textarea'
import { Field, Label } from '../ui/fieldset'
import { AccessRequestStatusBadge } from './AccessRequestStatusBadge'
import type { SoftwareAccessRequest } from '../../api/client'

interface SoftwareAccessRequestListProps {
  requests: SoftwareAccessRequest[]
  onReview: (requestId: string, status: 'APPROVED' | 'DECLINED', reviewNotes?: string) => Promise<void>
  canReview: boolean
  isLoading?: boolean
  showSoftwareName?: boolean
}

export function SoftwareAccessRequestList({
  requests,
  onReview,
  canReview,
  isLoading,
  showSoftwareName = false
}: SoftwareAccessRequestListProps) {
  const [reviewingRequest, setReviewingRequest] = useState<SoftwareAccessRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'DECLINED'>('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')

  const handleReviewClick = (request: SoftwareAccessRequest, action: 'APPROVED' | 'DECLINED') => {
    setReviewingRequest(request)
    setReviewAction(action)
    setReviewNotes('')
  }

  const handleSubmitReview = async () => {
    if (!reviewingRequest) return
    await onReview(reviewingRequest.id, reviewAction, reviewNotes.trim() || undefined)
    setReviewingRequest(null)
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No access requests.
      </p>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {showSoftwareName && request.software && (
                  <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                    {request.software.name}
                    {request.software.inbox && (
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                        {' '}in {request.software.inbox.name}
                      </span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {request.requester?.user.name || 'Unknown'}
                  </p>
                  <AccessRequestStatusBadge status={request.status} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {request.requester?.user.email} • Requested {formatDate(request.createdAt)}
                </p>
                {request.reason && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">
                    <span className="font-medium">Reason:</span> {request.reason}
                  </p>
                )}
                {request.reviewNotes && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    <span className="font-medium">Review notes:</span> {request.reviewNotes}
                  </p>
                )}
                {request.reviewer && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Reviewed by {request.reviewer.user.name}
                  </p>
                )}
              </div>

              {canReview && request.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <Button
                    color="green"
                    onClick={() => handleReviewClick(request, 'APPROVED')}
                    disabled={isLoading}
                  >
                    <CheckIcon className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    color="red"
                    onClick={() => handleReviewClick(request, 'DECLINED')}
                    disabled={isLoading}
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Decline
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewingRequest} onClose={() => setReviewingRequest(null)}>
        <DialogTitle>
          {reviewAction === 'APPROVED' ? 'Approve' : 'Decline'} Access Request
        </DialogTitle>
        <DialogBody>
          {reviewingRequest && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {reviewAction === 'APPROVED'
                  ? `Grant ${reviewingRequest.requester?.user.name} access to this software?`
                  : `Decline ${reviewingRequest.requester?.user.name}'s access request?`}
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
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : reviewAction === 'APPROVED' ? 'Approve' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
