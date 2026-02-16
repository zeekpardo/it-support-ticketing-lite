import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api, type SoftwareAccessRequest } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { InboxIcon } from '@heroicons/react/24/outline'
import { SoftwareAccessRequestList } from '@/components/software'

export default function SoftwareAccessRequests() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [requests, setRequests] = useState<SoftwareAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadRequests()
    }
  }, [currentOrg])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await api.getAllPendingAccessRequests()
      setRequests(data)
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (requestId: string, status: 'APPROVED' | 'DECLINED', reviewNotes?: string) => {
    // Find the request to get inboxId and softwareId
    const request = requests.find((r) => r.id === requestId)
    if (!request?.inboxSoftware?.inbox?.id || !request.inboxSoftwareId) {
      alert('Unable to review request - missing data')
      return
    }

    setSaving(true)
    try {
      await api.reviewAccessRequest(
        request.inboxSoftware.inbox.id,
        request.inboxSoftwareId,
        requestId,
        { status, reviewNotes }
      )
      loadRequests()
    } catch (error) {
      console.error('Failed to review request:', error)
      alert(error instanceof Error ? error.message : 'Failed to review request')
    } finally {
      setSaving(false)
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

  return (
    <div className="space-y-6">
      <Heading>Pending Access Requests</Heading>

      {requests.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <InboxIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No pending requests</Subheading>
          <Text className="mt-2">
            All access requests have been processed.
          </Text>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <SoftwareAccessRequestList
            requests={requests}
            onReview={handleReview}
            canReview={true}
            isLoading={saving}
            showSoftwareName={true}
          />
        </div>
      )}
    </div>
  )
}
