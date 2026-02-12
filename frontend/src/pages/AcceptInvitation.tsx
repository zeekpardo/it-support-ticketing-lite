import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { organization } from '../lib/auth-client'
import { useAuth } from '../context/AuthContext'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon, XCircleIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const invitationId = searchParams.get('id')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not-found'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [invitationData, setInvitationData] = useState<{
    organizationName?: string
    role?: string
  } | null>(null)

  useEffect(() => {
    if (!invitationId) {
      setStatus('not-found')
      return
    }

    acceptInvitation()
  }, [invitationId, isAuthenticated])

  const acceptInvitation = async () => {
    if (!invitationId) return

    try {
      setStatus('loading')

      // Try to accept the invitation
      const result = await organization.acceptInvitation({
        invitationId
      })

      if (result.error) {
        setError(result.error.message || 'Failed to accept invitation')
        setStatus('error')
        return
      }

      if (result.data) {
        setInvitationData({
          organizationName: result.data.organization?.name,
          role: result.data.member?.role
        })
      }

      setStatus('success')

      // Redirect to home after a short delay
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStatus('error')
    }
  }

  if (!invitationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 text-center">
          <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <Heading>Invalid Invitation</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            No invitation ID was provided. Please check your invitation link.
          </Text>
          <Link to="/login">
            <Button className="mt-6">Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 text-center">
          <BuildingOfficeIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <Heading>Accept Invitation</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Please log in or create an account to accept this invitation.
          </Text>
          <div className="mt-6 space-y-3">
            <Link to={`/login?redirect=${encodeURIComponent(`/accept-invitation?id=${invitationId}`)}`}>
              <Button className="w-full">Log In</Button>
            </Link>
            <Link to={`/signup?redirect=${encodeURIComponent(`/accept-invitation?id=${invitationId}`)}`}>
              <Button plain className="w-full">Create Account</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <Heading>Accepting Invitation</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Please wait while we process your invitation...
          </Text>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <Heading>Welcome!</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            You've successfully joined{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {invitationData?.organizationName || 'the organization'}
            </span>
            {invitationData?.role && (
              <> as a <span className="font-semibold">{invitationData.role}</span></>
            )}
            .
          </Text>
          <Text className="mt-4 text-sm text-zinc-500">
            Redirecting you to the dashboard...
          </Text>
          <Link to="/">
            <Button className="mt-6">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-8 text-center">
        <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <Heading>Unable to Accept Invitation</Heading>
        <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
          {error || 'This invitation may have expired or already been used.'}
        </Text>
        <div className="mt-6 space-y-3">
          <Button onClick={() => acceptInvitation()}>Try Again</Button>
          <Link to="/">
            <Button plain className="w-full">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
