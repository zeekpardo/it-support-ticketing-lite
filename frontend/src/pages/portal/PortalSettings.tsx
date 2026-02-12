import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authClient } from '../../lib/auth-client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Divider } from '@/components/ui/divider'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function PortalSettings() {
  const { user } = useAuth()

  // Profile form state
  const [name, setName] = useState(user?.name || '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

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
      const result = await authClient.updateUser({
        name,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Failed to update profile')
      }

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
        callbackURL: '/portal/settings',
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
      <Heading>Account Settings</Heading>

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
