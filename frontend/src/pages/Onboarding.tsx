import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { BuildingOfficeIcon, UserGroupIcon } from '@heroicons/react/24/outline'

type Step = 'choice' | 'create' | 'join'

export default function Onboarding() {
  const [step, setStep] = useState<Step>('choice')
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { createOrganization, organizations } = useOrganization()
  const navigate = useNavigate()

  // If user already has organizations, redirect to dashboard
  if (organizations.length > 0) {
    navigate('/')
    return null
  }

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await createOrganization(orgName, orgSlug)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setOrgName(name)
    setOrgSlug(generateSlug(name))
  }

  if (step === 'choice') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
        <div className="w-full max-w-md">
          <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="text-center">
              <Heading>Welcome to Groovi Support!</Heading>
              <Text className="mt-1">Let's get you set up</Text>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={() => setStep('create')}
                className="flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <BuildingOfficeIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Create an Organization
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Start fresh with your own workspace
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep('join')}
                className="flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600 text-white">
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Join an Organization
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    I have an invite from my team
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
        <div className="w-full max-w-md">
          <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Button
              plain
              onClick={() => setStep('choice')}
              className="mb-4"
            >
              ← Back
            </Button>

            <div className="text-center">
              <Heading>Create Organization</Heading>
              <Text className="mt-1">Set up your team's workspace</Text>
            </div>

            <form onSubmit={handleCreateOrg} className="mt-8 space-y-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Organization Name</Label>
                  <Input
                    type="text"
                    value={orgName}
                    onChange={handleNameChange}
                    placeholder="Acme Inc"
                    required
                  />
                </Field>

                <Field>
                  <Label>URL Slug</Label>
                  <Input
                    type="text"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme-inc"
                    required
                  />
                  <Description>This will be used in URLs</Description>
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                color="blue"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'join') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
        <div className="w-full max-w-md">
          <div className="rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Button
              plain
              onClick={() => setStep('choice')}
              className="mb-4"
            >
              ← Back
            </Button>

            <div className="text-center">
              <Heading>Join Organization</Heading>
              <Text className="mt-1">
                Check your email for an invite link from your team admin
              </Text>
            </div>

            <div className="mt-8 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-700/50">
              <Text>
                When your team admin invites you, you'll receive an email with a
                link to join their organization.
              </Text>
              <Text className="mt-3">
                If you've already accepted an invite, try refreshing the page.
              </Text>
            </div>

            <Button
              outline
              onClick={() => window.location.reload()}
              className="mt-6 w-full"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
