import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type PortalSoftwareDetail as PortalSoftwareDetailType } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { Field, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  ArrowLeftIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { AccessRequestStatusBadge } from '@/components/software'

export default function PortalSoftwareDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [software, setSoftware] = useState<PortalSoftwareDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentOrg && id) {
      loadSoftware()
    }
  }, [currentOrg, id])

  const loadSoftware = async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await api.getPortalSoftware(id)
      setSoftware(data)
    } catch (error) {
      console.error('Failed to load software:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRequest = async () => {
    if (!id) return

    setSubmitting(true)
    try {
      await api.submitAccessRequest(id, { reason: requestReason.trim() || undefined })
      setShowRequestModal(false)
      setRequestReason('')
      loadSoftware()
    } catch (error) {
      console.error('Failed to submit request:', error)
      alert(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
      </div>
    )
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

  const accessRequest = software.myAccessRequest
  const hasAccess = accessRequest?.status === 'APPROVED'
  const hasPending = accessRequest?.status === 'PENDING'
  const wasDeclined = accessRequest?.status === 'DECLINED'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button plain onClick={() => navigate('/portal/software')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>

          {software.iconUrl ? (
            <img
              src={software.iconUrl}
              alt={software.name}
              className="w-16 h-16 rounded-xl object-contain bg-zinc-100 dark:bg-zinc-800"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ComputerDesktopIcon className="w-8 h-8 text-zinc-400" />
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

        {/* Access Status / Request Button */}
        <div>
          {hasAccess ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <span className="text-green-700 dark:text-green-400 font-medium">
                Access Granted
              </span>
            </div>
          ) : hasPending ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <ClockIcon className="h-5 w-5 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Request Pending
              </span>
            </div>
          ) : (
            <Button color="blue" onClick={() => setShowRequestModal(true)}>
              Request Access
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {software.description && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Description
              </h3>
              <Text className="whitespace-pre-wrap">{software.description}</Text>
            </div>
          )}

          {/* Organization Notes */}
          {software.notes && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Organization Notes
              </h3>
              <Text className="whitespace-pre-wrap">{software.notes}</Text>
            </div>
          )}

          {/* Website */}
          {software.websiteUrl && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Website
              </h3>
              <a
                href={software.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                <GlobeAltIcon className="h-4 w-4" />
                {software.websiteUrl}
              </a>
            </div>
          )}
        </div>

        {/* Sidebar - Access Request Status */}
        <div className="space-y-6">
          {accessRequest && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                Your Access Request
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Status</span>
                  <AccessRequestStatusBadge status={accessRequest.status as 'PENDING' | 'APPROVED' | 'DECLINED'} />
                </div>

                <div>
                  <span className="text-sm text-zinc-500">Requested</span>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(accessRequest.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                {accessRequest.reason && (
                  <div>
                    <span className="text-sm text-zinc-500">Your Reason</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {accessRequest.reason}
                    </p>
                  </div>
                )}

                {accessRequest.reviewNotes && (
                  <div>
                    <span className="text-sm text-zinc-500">Review Notes</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {accessRequest.reviewNotes}
                    </p>
                  </div>
                )}

                {wasDeclined && (
                  <Button
                    color="blue"
                    onClick={() => setShowRequestModal(true)}
                    className="w-full mt-4"
                  >
                    Request Again
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Access Modal */}
      <Dialog open={showRequestModal} onClose={() => setShowRequestModal(false)}>
        <DialogTitle>Request Access</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {software.iconUrl ? (
                <img
                  src={software.iconUrl}
                  alt={software.name}
                  className="w-12 h-12 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <ComputerDesktopIcon className="w-6 h-6 text-zinc-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">
                  {software.name}
                </p>
                {software.vendor && (
                  <p className="text-sm text-zinc-500">{software.vendor}</p>
                )}
              </div>
            </div>

            <Field>
              <Label>Reason for Request (optional)</Label>
              <Description>
                Let the admin know why you need access to this software.
              </Description>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="I need this software for..."
                rows={3}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowRequestModal(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleSubmitRequest} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
