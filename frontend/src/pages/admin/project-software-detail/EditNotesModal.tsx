import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'

interface EditNotesModalProps {
  editNotes: string
  saving: boolean
  onEditNotesChange: (notes: string) => void
  onSave: () => void
  onClose: () => void
}

export default function EditNotesModal({
  editNotes,
  saving,
  onEditNotesChange,
  onSave,
  onClose,
}: EditNotesModalProps) {
  return (
    <Dialog open={true} onClose={onClose} size="md">
      <DialogTitle>Edit Project Notes</DialogTitle>
      <DialogDescription>
        Add project-specific notes or setup instructions for this software.
      </DialogDescription>

      <DialogBody>
        <Field>
          <Textarea
            value={editNotes}
            onChange={(e) => onEditNotesChange(e.target.value)}
            placeholder="Notes..."
            rows={6}
          />
        </Field>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button color="blue" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
