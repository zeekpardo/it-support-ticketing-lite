import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signIn } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label, ErrorMessage } from '@/components/ui/fieldset'
import { Heading } from '@/components/ui/heading'
import { Text, TextLink } from '@/components/ui/text'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'password' | 'magicLink'>('password')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: magicError } = await signIn.magicLink({ email })
      if (magicError) {
        throw new Error(magicError.message || 'Failed to send magic link')
      }
      setMagicLinkSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: 'password' | 'magicLink') => {
    setMode(newMode)
    setError('')
    setMagicLinkSent(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="text-center">
            <Heading>Welcome back</Heading>
            <Text className="mt-1">Sign in to your account</Text>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </Field>

                <Field>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                color="blue"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>

              <Text className="text-center text-sm">
                <TextLink href="/forgot-password">Forgot your password?</TextLink>
              </Text>
            </form>
          ) : magicLinkSent ? (
            <div className="mt-8 space-y-4 text-center">
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Check your email for a sign-in link. It will expire in 5 minutes.
              </div>
              <Text className="text-sm">
                Didn't receive it?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() => setMagicLinkSent(false)}
                >
                  Try again
                </button>
              </Text>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="mt-8 space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                color="blue"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => switchMode(mode === 'password' ? 'magicLink' : 'password')}
            >
              {mode === 'password'
                ? 'Sign in with a magic link instead'
                : 'Sign in with password instead'}
            </button>
          </div>

          <Text className="mt-6 text-center">
            Don't have an account?{' '}
            <TextLink href="/register">Create one</TextLink>
          </Text>
        </div>
      </div>
    </div>
  )
}
