import { useState, useEffect } from 'react'
import { useBranding } from '../../context/BrandingContext'
import { updateBranding, uploadLogo, removeLogo, uploadFavicon, removeFavicon } from '../../api/branding'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Divider } from '@/components/ui/divider'
import { FileUpload } from '@/components/ui/file-upload'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function AdminBranding() {
  const { branding, refresh } = useBranding()

  const [appName, setAppName] = useState(branding.appName)
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor)

  // Sync form state when branding loads async
  useEffect(() => {
    setAppName(branding.appName)
    setPrimaryColor(branding.primaryColor)
  }, [branding.appName, branding.primaryColor])

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [faviconUploading, setFaviconUploading] = useState(false)

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setError(msg)
      setSuccess('')
    } else {
      setSuccess(msg)
      setError('')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    showFeedback('')

    try {
      await updateBranding({ appName, primaryColor })
      await refresh()
      showFeedback('Branding updated')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to save', true)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (files: File[]) => {
    setLogoUploading(true)
    showFeedback('')
    try {
      await uploadLogo(files[0])
      await refresh()
      showFeedback('Logo uploaded')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Upload failed', true)
    } finally {
      setLogoUploading(false)
    }
  }

  const handleLogoRemove = async () => {
    showFeedback('')
    try {
      await removeLogo()
      await refresh()
      showFeedback('Logo removed')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to remove logo', true)
    }
  }

  const handleFaviconUpload = async (files: File[]) => {
    setFaviconUploading(true)
    showFeedback('')
    try {
      await uploadFavicon(files[0])
      await refresh()
      showFeedback('Favicon uploaded')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Upload failed', true)
    } finally {
      setFaviconUploading(false)
    }
  }

  const handleFaviconRemove = async () => {
    showFeedback('')
    try {
      await removeFavicon()
      await refresh()
      showFeedback('Favicon removed')
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : 'Failed to remove favicon', true)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <Heading>Branding</Heading>
        <Text className="mt-1">Customize how your organization appears to users and in emails.</Text>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* App Name & Primary Color */}
      <section>
        <Subheading>General</Subheading>
        <Text className="mt-1">Set your app name and brand color.</Text>

        <form onSubmit={handleSave} className="mt-6">
          <FieldGroup>
            <Field>
              <Label>App Name</Label>
              <Input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My App"
                maxLength={50}
              />
              <Description>Shown in emails, page title, and sidebar. Max 50 characters.</Description>
            </Field>

            <Field>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-zinc-300 p-1 dark:border-zinc-600"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563eb"
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="max-w-32 font-mono"
                />
                <div
                  className="h-10 flex-1 rounded-lg"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
              <Description>Used for buttons and accent elements throughout the app and emails.</Description>
            </Field>
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" color="blue" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </section>

      <Divider />

      {/* Logo */}
      <section>
        <Subheading>Logo</Subheading>
        <Text className="mt-1">Displayed in the sidebar and email headers.</Text>

        <div className="mt-6">
          {branding.logoUrl && (
            <div className="mb-4 flex items-center gap-4">
              <img
                src={branding.logoUrl}
                alt="Current logo"
                className="h-12 max-w-48 rounded object-contain bg-zinc-100 p-2 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={handleLogoRemove}
                className="text-sm text-red-600 hover:text-red-500"
              >
                Remove logo
              </button>
            </div>
          )}
          <FileUpload
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            compact
            maxSizeMB={1}
            label={logoUploading ? 'Uploading...' : 'Upload logo'}
            description="JPEG, PNG, GIF, WebP, or SVG. Max 1MB."
            onFilesSelected={handleLogoUpload}
          />
        </div>
      </section>

      <Divider />

      {/* Favicon */}
      <section>
        <Subheading>Favicon</Subheading>
        <Text className="mt-1">The small icon shown in browser tabs.</Text>

        <div className="mt-6">
          {branding.faviconUrl && (
            <div className="mb-4 flex items-center gap-4">
              <img
                src={branding.faviconUrl}
                alt="Current favicon"
                className="h-8 w-8 rounded object-contain bg-zinc-100 p-1 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={handleFaviconRemove}
                className="text-sm text-red-600 hover:text-red-500"
              >
                Remove favicon
              </button>
            </div>
          )}
          <FileUpload
            accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
            compact
            maxSizeMB={0.25}
            label={faviconUploading ? 'Uploading...' : 'Upload favicon'}
            description="ICO, PNG, or SVG. Max 256KB."
            onFilesSelected={handleFaviconUpload}
          />
        </div>
      </section>
    </div>
  )
}
