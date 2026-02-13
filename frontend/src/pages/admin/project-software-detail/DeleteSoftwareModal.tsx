import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/dialog'

interface DeleteSoftwareModalProps {
  deleting: boolean
  onDelete: () => void
  onClose: () => void
}

export default function DeleteSoftwareModal({
  deleting,
  onDelete,
  onClose,
}: DeleteSoftwareModalProps) {
  return (
    <Dialog open={true} onClose={onClose} size="sm">
      <DialogTitle>Remove Software</DialogTitle>
      <DialogDescription>
        Are you sure you want to remove this software from the project? This will also remove all admins and access requests.
      </DialogDescription>

      <DialogActions>
        <Button plain onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button color="red" onClick={onDelete} disabled={deleting}>
          {deleting ? 'Removing...' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
