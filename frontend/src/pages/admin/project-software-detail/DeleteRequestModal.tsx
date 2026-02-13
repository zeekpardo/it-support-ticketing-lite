import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/dialog'
import type { SoftwareAccessRequest } from './types'

interface DeleteRequestModalProps {
  deletingRequest: SoftwareAccessRequest
  deletingRequestLoading: boolean
  onDelete: () => void
  onClose: () => void
}

export default function DeleteRequestModal({
  deletingRequest,
  deletingRequestLoading,
  onDelete,
  onClose,
}: DeleteRequestModalProps) {
  return (
    <Dialog open={true} onClose={onClose} size="sm">
      <DialogTitle>Delete Access Request</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this access request from {deletingRequest.requester.user.name}? This action cannot be undone.
      </DialogDescription>

      <DialogActions>
        <Button plain onClick={onClose} disabled={deletingRequestLoading}>
          Cancel
        </Button>
        <Button color="red" onClick={onDelete} disabled={deletingRequestLoading}>
          {deletingRequestLoading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
