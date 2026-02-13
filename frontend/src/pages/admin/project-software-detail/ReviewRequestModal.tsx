import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import type { SoftwareAccessRequest } from './types'

interface ReviewRequestModalProps {
  reviewingRequest: SoftwareAccessRequest
  reviewStatus: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING'
  reviewNotes: string
  reviewing: boolean
  onReviewStatusChange: (status: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING') => void
  onReviewNotesChange: (notes: string) => void
  onReview: () => void
  onClose: () => void
}

export default function ReviewRequestModal({
  reviewingRequest,
  reviewStatus,
  reviewNotes,
  reviewing,
  onReviewStatusChange,
  onReviewNotesChange,
  onReview,
  onClose,
}: ReviewRequestModalProps) {
  return (
    <Dialog open={true} onClose={onClose} size="md">
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
              onChange={(e) => onReviewStatusChange(e.target.value as 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING')}
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
              onChange={(e) => onReviewNotesChange(e.target.value)}
              placeholder="Add a note..."
              rows={3}
            />
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={reviewing}>
          Cancel
        </Button>
        <Button
          color={reviewStatus === 'APPROVED' ? 'green' : reviewStatus === 'PENDING' ? 'amber' : 'red'}
          onClick={onReview}
          disabled={reviewing}
        >
          {reviewing ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
