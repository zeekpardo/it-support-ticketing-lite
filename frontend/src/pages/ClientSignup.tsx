import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signIn } from '../lib/auth-client'
import { getSignupInfo, submitClientSignup } from '../api/inboxes'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface SignupInfo {
  organizationName: string
  inboxName: string
  branding: { appName: string; primaryColor: string; logoUrl: string | null }
}

export default function ClientSignup() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const [info, setInfo] = useState<SignupInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'invalid'>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    getSignupInfo(token)
      .then((data) => {
        setInfo(data)
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      await submitClientSignup(token!, { name, email, password })

      // Auto sign-in and redirect to portal
      const result = await signIn.email({ email, password })
      if (result.error) {
        // Signup succeeded but auto-login failed — redirect to login
        setStatus('success')
        return
      }

      navigate('/portal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAuthenticatedJoin = async () => {
    if (!token || !user) return
    setSubmitting(true)
    setError('')
    try {
      await submitClientSignup(token, {
        name: user.name || '',
        email: user.email,
        password: '',
      })
      navigate('/portal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <Text className="text-zinc-600 dark:text-zinc-400">Loading...</Text>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <Heading>Link Not Valid</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            This signup link is no longer valid or has been disabled.
          </Text>
          <Link to="/login">
            <Button className="mt-6">Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
          <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <Heading>Account Created!</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Your account has been created. Please log in to continue.
          </Text>
          <Link to="/login">
            <Button className="mt-6">Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Authenticated user — show join prompt
  if (isAuthenticated && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
          <div className="text-center">
            {info?.branding.logoUrl && (
              <img src={info.branding.logoUrl} alt="" className="mx-auto mb-4 h-12" />
            )}
            <Heading>Join {info?.organizationName}</Heading>
            <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
              Inbox: {info?.inboxName}
            </Text>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-700/50">
            <Text>
              You're signed in as <span className="font-semibold">{user.email}</span>.
              Click below to join as a client.
            </Text>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            color="blue"
            className="mt-6 w-full"
            onClick={handleAuthenticatedJoin}
            disabled={submitting}
          >
            {submitting ? 'Joining...' : 'Join'}
          </Button>
        </div>
      </div>
    )
  }

  // Unauthenticated — show signup form
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="text-center">
            {info?.branding.logoUrl && (
              <img src={info.branding.logoUrl} alt="" className="mx-auto mb-4 h-12" />
            )}
            <Heading>Join {info?.organizationName}</Heading>
            <Text className="mt-1">
              Create an account to access <span className="font-semibold">{info?.inboxName}</span>
            </Text>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <FieldGroup>
              <Field>
                <Label>Name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </Field>

              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>

              <Field>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />
              </Field>

              <Field>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </Field>
            </FieldGroup>

            <Button type="submit" color="blue" className="w-full" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <Text className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link to={`/login?redirect=${encodeURIComponent(`/join/${token}`)}`} className="text-blue-600 hover:underline">
              Log in
            </Link>
          </Text>
        </div>
      </div>
    </div>
  )
}
