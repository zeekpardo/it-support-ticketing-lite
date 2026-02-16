import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, PortalSoftware } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Field, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  ComputerDesktopIcon,
  LinkIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function PortalInboxSoftwareDetail() {
  const { inboxId, id } = useParams<{ inboxId: string; id: string }>()
  const navigate = useNavigate()

  const [software, setSoftware] = useState<PortalSoftware | null>(null)
  const [loading, setLoading] = useState(true)

  // Request access modal
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (inboxId && id) {
      loadSoftware()
    }
  }, [inboxId, id])

  const loadSoftware = async () => {
    if (!inboxId || !id) return
    setLoading(true)
    try {
      const data = await api.getPortalInboxSoftwareById(inboxId, id)
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAccess = async () => {
    if (!inboxId || !id) return
    setRequesting(true)
    try {
      await api.submitPortalAccessRequest(inboxId, id, requestReason || undefined)
      setShowRequestModal(false)
      loadSoftware()
    } catch (error) {
      console.error('Failed to request access:', error)
    } finally {
      setRequesting(false)
    }
  }

  const getAccessStatus = () => {
    if (!software?.myAccessRequest) return null

    const request = software.myAccessRequest

    switch (request.status) {
      case 'APPROVED':
        return (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-300">Access Granted</span>
            </div>
            <Text className="mt-1 text-sm text-green-700 dark:text-green-400">
              You have access to this software.
            </Text>
          </div>
        )
      case 'PENDING':
        return (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-800 dark:text-amber-300">Pending Approval</span>
            </div>
            <Text className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Your access request is being reviewed.
            </Text>
          </div>
        )
      case 'DECLINED':
        return (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center gap-2">
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="font-medium text-red-800 dark:text-red-300">Access Declined</span>
            </div>
            <Text className="mt-1 text-sm text-red-700 dark:text-red-400">
              Your access request was declined. You can submit a new request.
            </Text>
            <Button
              className="mt-3"
              outline
              onClick={() => setShowRequestModal(true)}
            >
              Request Again
            </Button>
          </div>
        )
      default:
        return null
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

  const hasExistingRequest = !!software.myAccessRequest
  const canRequestAccess = !hasExistingRequest || software.myAccessRequest?.status === 'DECLINED'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button plain onClick={() => navigate(`/portal/inboxes/${inboxId}/software`)}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            {software.iconUrl ? (
              <img
                src={software.iconUrl}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                <ComputerDesktopIcon className="h-8 w-8 text-zinc-400" />
              </div>
            )}
            <div>
              <Heading>{software.name}</Heading>
              <div className="flex items-center gap-2 mt-1">
                {software.vendor && (
                  <Text className="text-zinc-500">{software.vendor}</Text>
                )}
                {software.category && (
                  <Badge color="zinc">{software.category.name}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        {software.websiteUrl && (
          <Button outline onClick={() => window.open(software.websiteUrl, '_blank')}>
            <LinkIcon className="h-4 w-4" />
            Visit Website
          </Button>
        )}
      </div>

      {/* Access Status */}
      {getAccessStatus()}

      {/* Request Access Button (only if no existing request or declined) */}
      {canRequestAccess && !software.myAccessRequest && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 text-center">
          <Text className="text-zinc-500 mb-4">
            You don't have access to this software yet. Request access to get started.
          </Text>
          <Button color="blue" onClick={() => setShowRequestModal(true)}>
            Request Access
          </Button>
        </div>
      )}

      {/* Description */}
      {software.description && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
          <Text className="font-medium mb-2">Description</Text>
          <Text className="text-zinc-600 dark:text-zinc-400">{software.description}</Text>
        </div>
      )}

      {/* Inbox Notes */}
      {software.notes && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
          <Text className="font-medium mb-2">Setup Instructions</Text>
          <Text className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{software.notes}</Text>
        </div>
      )}

      {/* Request Access Modal */}
      {showRequestModal && (
        <Dialog open={true} onClose={() => setShowRequestModal(false)} size="md">
          <DialogTitle>Request Access</DialogTitle>
          <DialogDescription>
            Request access to {software.name}. Your request will be reviewed by an administrator.
          </DialogDescription>

          <DialogBody>
            <Field>
              <Label>Reason (optional)</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Why do you need access to this software?"
                rows={4}
              />
            </Field>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowRequestModal(false)} disabled={requesting}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleRequestAccess} disabled={requesting}>
              {requesting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}
