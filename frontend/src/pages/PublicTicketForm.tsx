import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getPublicFormInfo, submitPublicTicket, uploadPublicTicketAttachments, uploadPublicTicketDescriptionImage } from '../api/inboxes'
import { TicketForm } from '../components/tickets/TicketForm'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface FormInfo {
  inboxId: string
  inboxName: string
  allowedEmailDomains: string[]
  branding: { appName: string; primaryColor: string; logoUrl: string | null }
}

export default function PublicTicketForm() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const isEmbed = searchParams.get('embed') === 'true'

  const [info, setInfo] = useState<FormInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitted' | 'invalid'>('loading')
  const [domainError, setDomainError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    getPublicFormInfo(token)
      .then((data) => {
        setInfo(data)
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  if (status === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <Text className="text-zinc-600 dark:text-zinc-400">Loading...</Text>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <Heading>Form Not Available</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            This form is no longer available or has been disabled.
          </Text>
        </div>
      </div>
    )
  }

  if (status === 'submitted') {
    return (
      <div className={`flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4 ${isEmbed ? 'min-h-0' : 'min-h-screen'}`}>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <Heading>Request Submitted!</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Your request has been submitted. Check your email for a link to track your ticket.
          </Text>
          <Button
            outline
            className="mt-6"
            onClick={() => { setStatus('ready'); setDomainError('') }}
          >
            Submit Another Request
          </Button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (data: any) => {
    setDomainError('')

    // Client-side domain validation
    if (info!.allowedEmailDomains.length > 0) {
      const emailDomain = data.email.toLowerCase().split('@')[1]
      if (!info!.allowedEmailDomains.includes(emailDomain)) {
        setDomainError(
          `Email domain "${emailDomain}" is not allowed. Accepted domains: ${info!.allowedEmailDomains.join(', ')}`
        )
        throw new Error(`Email domain "${emailDomain}" is not allowed. Accepted domains: ${info!.allowedEmailDomains.join(', ')}`)
      }
    }

    const result = await submitPublicTicket(token!, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      subject: data.subject,
      description: data.description,
      descriptionHtml: data.descriptionHtml,
      priorityLevel: data.priorityLevel,
    })
    // Normalize so TicketForm can find the ID to upload attachments
    return { ...result, id: result.ticketId }
  }

  return (
    <div className={`flex justify-center bg-zinc-50 dark:bg-zinc-900 ${isEmbed ? 'p-4' : 'min-h-screen px-4 py-12'}`}>
      <div className="w-full max-w-2xl">
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="text-center mb-8">
            <Heading>{info?.inboxName}</Heading>
            <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
              Submit a request
            </Text>
          </div>

          {domainError && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {domainError}
            </div>
          )}

          <TicketForm
            inboxes={[{ id: info!.inboxId, name: info!.inboxName, inboxCode: '' }]}
            onSubmit={handleSubmit}
            showContactFields={true}
            showPriority={true}
            showAttachments={true}
            onUploadAttachments={(ticketId, files) => uploadPublicTicketAttachments(token!, ticketId, files)}
            onInlineImageUpload={(file) => uploadPublicTicketDescriptionImage(token!, file)}
            preselectedInboxId={info!.inboxId}
            onSuccess={() => setStatus('submitted')}
          />

          <Text className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-500 hover:underline">Log in</Link>{' '}
            to view your tickets.
          </Text>
        </div>
      </div>
    </div>
  )
}
