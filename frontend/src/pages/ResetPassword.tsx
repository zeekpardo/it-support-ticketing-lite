import { useState, FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
        <div className="w-full max-w-sm">
          <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10 text-center">
            <Heading>Invalid Link</Heading>
            <Text className="mt-2">This password reset link is invalid or has expired.</Text>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })

      if (resetError) {
        setError(resetError.message || 'Failed to set password. The link may have expired.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
        <div className="w-full max-w-sm">
          <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10 text-center">
            <Heading>Password Set</Heading>
            <Text className="mt-2">Your password has been set successfully.</Text>
            <Button
              color="blue"
              className="mt-6 w-full"
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="text-center">
            <Heading>Set Your Password</Heading>
            <Text className="mt-1">Choose a password for your account</Text>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <FieldGroup>
              <Field>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              color="blue"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Setting password...' : 'Set Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
