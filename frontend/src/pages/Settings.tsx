import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { authClient } from '../lib/auth-client'
import { api } from '../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Divider } from '@/components/ui/divider'
import { Avatar } from '@/components/ui/avatar'
import { FileUpload } from '@/components/ui/file-upload'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function Settings() {
  const { user } = useAuth()

  // Profile form state
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Load user profile and resolve avatar URL on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await api.getProfile()
        setPhone(profile.phone || '')
      } catch (error) {
        console.error('Failed to load profile:', error)
      }
    }
    const loadAvatar = async () => {
      try {
        const { url } = await api.getAvatarUrl()
        setAvatarUrl(url)
      } catch {}
    }
    loadProfile()
    loadAvatar()
  }, [])

  // Email form state
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    setProfileLoading(true)

    try {
      // Update name via Better Auth
      const result = await authClient.updateUser({
        name,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to update profile')
      }

      // Update phone via our API
      await api.updateProfile({ phone })

      setProfileSuccess('Profile updated successfully')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setEmailLoading(true)

    try {
      const result = await authClient.changeEmail({
        newEmail,
        callbackURL: '/settings',
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to change email')
      }

      setEmailSuccess('Verification email sent to your new email address')
      setNewEmail('')
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Failed to change email')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setPasswordLoading(true)

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to change password')
      }

      setPasswordSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <Heading>Settings</Heading>

      {/* Profile Section */}
      <section>
        <Subheading>Profile</Subheading>
        <Text className="mt-1">Update your personal information.</Text>

        <form onSubmit={handleUpdateProfile} className="mt-6">
          {profileSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircleIcon className="h-5 w-5" />
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <ExclamationCircleIcon className="h-5 w-5" />
              {profileError}
            </div>
          )}

          <div className="mb-6">
            <span className="text-sm/6 font-medium text-zinc-950 dark:text-white">Profile Photo</span>
            <div className="mt-2 flex items-center gap-6">
              <Avatar
                src={avatarUrl}
                initials={user?.name?.charAt(0).toUpperCase()}
                className="size-16"
              />
              <div className="flex-1">
                <FileUpload
                  accept="image/*"
                  compact
                  maxSizeMB={0.5}
                  label={avatarUploading ? 'Uploading...' : 'Upload photo'}
                  description="JPEG, PNG, GIF or WebP. Max 512KB."
                  onFilesSelected={async (files) => {
                    setAvatarUploading(true)
                    setProfileError('')
                    try {
                      const result = await api.uploadAvatar(files[0])
                      await authClient.updateUser({ image: result.image })
                      setAvatarUrl(result.imageUrl)
                      setProfileSuccess('Profile photo updated')
                    } catch (err) {
                      setProfileError(err instanceof Error ? err.message : 'Upload failed')
                    } finally {
                      setAvatarUploading(false)
                    }
                  }}
                />
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileError('')
                      try {
                        await api.removeAvatar()
                        await authClient.updateUser({ image: '' })
                        setAvatarUrl(null)
                        setProfileSuccess('Profile photo removed')
                      } catch (err) {
                        setProfileError(err instanceof Error ? err.message : 'Failed to remove photo')
                      }
                    }}
                    className="mt-1 text-sm text-red-600 hover:text-red-500"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

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
                value={user?.email || ''}
                disabled
                className="bg-zinc-100 dark:bg-zinc-800"
              />
              <Description>To change your email, use the form below.</Description>
            </Field>

            <Field>
              <Label>Phone Number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </Field>
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" color="blue" disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </section>

      <Divider />

      {/* Email Section */}
      <section>
        <Subheading>Change Email</Subheading>
        <Text className="mt-1">
          Update your email address. A verification link will be sent to your new email.
        </Text>

        <form onSubmit={handleChangeEmail} className="mt-6">
          {emailSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircleIcon className="h-5 w-5" />
              {emailSuccess}
            </div>
          )}
          {emailError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <ExclamationCircleIcon className="h-5 w-5" />
              {emailError}
            </div>
          )}

          <FieldGroup>
            <Field>
              <Label>Current Email</Label>
              <Input
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-zinc-100 dark:bg-zinc-800"
              />
            </Field>

            <Field>
              <Label>New Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
                required
              />
            </Field>
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" color="blue" disabled={emailLoading}>
              {emailLoading ? 'Sending...' : 'Change Email'}
            </Button>
          </div>
        </form>
      </section>

      <Divider />

      {/* Password Section */}
      <section>
        <Subheading>Change Password</Subheading>
        <Text className="mt-1">
          Update your password. You will be signed out of all other sessions.
        </Text>

        <form onSubmit={handleChangePassword} className="mt-6">
          {passwordSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircleIcon className="h-5 w-5" />
              {passwordSuccess}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <ExclamationCircleIcon className="h-5 w-5" />
              {passwordError}
            </div>
          )}

          <FieldGroup>
            <Field>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </Field>

            <Field>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
              <Description>Must be at least 8 characters.</Description>
            </Field>

            <Field>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </Field>
          </FieldGroup>

          <div className="mt-6">
            <Button type="submit" color="blue" disabled={passwordLoading}>
              {passwordLoading ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
