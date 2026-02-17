import { useState, useEffect } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { getOrgPublicForm, generateOrgPublicForm, toggleOrgPublicForm, deleteOrgPublicForm } from '../../api/inboxes'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LinkIcon,
  ClipboardIcon,
  ArrowPathIcon,
  TrashIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline'

export default function OrgPublicForm() {
  const { currentOrg } = useOrganization()
  const [token, setToken] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadForm()
    }
  }, [currentOrg])

  const loadForm = async () => {
    setLoading(true)
    try {
      const data = await getOrgPublicForm()
      setToken(data.token)
      setEnabled(data.enabled)
    } catch (error) {
      console.error('Failed to load org public form:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setActionLoading(true)
    try {
      const data = await generateOrgPublicForm()
      setToken(data.token)
      setEnabled(data.enabled)
    } catch (error) {
      console.error('Failed to generate form link:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggle = async (newEnabled: boolean) => {
    setActionLoading(true)
    try {
      const data = await toggleOrgPublicForm(newEnabled)
      setToken(data.token)
      setEnabled(data.enabled)
    } catch (error) {
      console.error('Failed to toggle form link:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('This will permanently revoke the public form link. Continue?')) return
    setActionLoading(true)
    try {
      await deleteOrgPublicForm()
      setToken(null)
      setEnabled(false)
    } catch (error) {
      console.error('Failed to delete form link:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const formUrl = token
    ? `${window.location.origin}/org-form/${token}`
    : null

  const embedFormUrl = token
    ? `${window.location.origin}/org-form/${token}?embed=true`
    : null

  const embedSnippet = embedFormUrl
    ? `<iframe src="${embedFormUrl}" width="100%" height="700" frameborder="0" style="border: none; border-radius: 12px;"></iframe>`
    : null

  const handleCopyLink = () => {
    if (formUrl) {
      navigator.clipboard.writeText(formUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyEmbed = () => {
    if (embedSnippet) {
      navigator.clipboard.writeText(embedSnippet)
      setEmbedCopied(true)
      setTimeout(() => setEmbedCopied(false), 2000)
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
    <div className="space-y-8">
      <div>
        <Heading>Public Ticket Form</Heading>
        <Text className="mt-1 text-zinc-500">
          Share a public form link that allows anyone to submit tickets to your organization.
          Submitters will choose which inbox to send their request to.
        </Text>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Form Link Management */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-zinc-400" />
            <Subheading>Form Link</Subheading>
          </div>
          <Text className="mt-1 text-sm text-zinc-500">
            Generate a link you can share with clients. They will be able to submit support tickets
            without needing to create an account first.
          </Text>

          {!token ? (
            <Button
              outline
              className="mt-4 w-full"
              onClick={handleGenerate}
              disabled={actionLoading}
            >
              {actionLoading ? 'Generating...' : 'Generate Form Link'}
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color={enabled ? 'green' : 'zinc'}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              <div
                className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
                  enabled
                    ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900'
                    : 'border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono">{formUrl}</span>
                <Button
                  plain
                  onClick={handleCopyLink}
                  title="Copy link"
                  className="shrink-0"
                >
                  <ClipboardIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                </Button>
              </div>
              {copied && (
                <Text className="text-xs text-green-600">Copied!</Text>
              )}

              <div className="flex gap-2">
                <Button
                  outline
                  className="flex-1"
                  onClick={() => handleToggle(!enabled)}
                  disabled={actionLoading}
                >
                  {enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  outline
                  onClick={() => {
                    if (confirm('Generate a new link? The current link will stop working.')) {
                      handleGenerate()
                    }
                  }}
                  disabled={actionLoading}
                  title="Regenerate link"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </Button>
                <Button
                  outline
                  onClick={handleDelete}
                  disabled={actionLoading}
                  title="Delete link"
                >
                  <TrashIcon className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Embed Code */}
        {token && enabled && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <div className="flex items-center gap-2">
              <CodeBracketIcon className="h-5 w-5 text-zinc-400" />
              <Subheading>Embed Code</Subheading>
            </div>
            <Text className="mt-1 text-sm text-zinc-500">
              Embed this form on any website using the snippet below.
            </Text>

            <div className="mt-4 space-y-3">
              <div>
                <Text className="text-xs font-medium text-zinc-500 mb-1">Direct link</Text>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="min-w-0 flex-1 truncate font-mono">{formUrl}</span>
                  <Button
                    plain
                    onClick={handleCopyLink}
                    title="Copy link"
                    className="shrink-0"
                  >
                    <ClipboardIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                  </Button>
                </div>
              </div>

              <div>
                <Text className="text-xs font-medium text-zinc-500 mb-1">Iframe embed code</Text>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-zinc-700 dark:text-zinc-300">
                    {embedSnippet}
                  </pre>
                </div>
                <Button
                  outline
                  className="mt-2 w-full"
                  onClick={handleCopyEmbed}
                >
                  <ClipboardIcon className="h-4 w-4" />
                  {embedCopied ? 'Copied!' : 'Copy Embed Code'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
