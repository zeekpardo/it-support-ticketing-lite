import { useState, useEffect } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { organization } from '../../lib/auth-client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlusIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline'

interface Member {
  id: string
  role: 'owner' | 'manager' | 'member'
  user: {
    id: string
    name: string
    email: string
  }
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
}

export default function AdminMembers() {
  const { currentOrg, isOwner, inviteMember, removeMember, updateMemberRole } = useOrganization()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadMembers()
    }
  }, [currentOrg])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const result = await organization.listMembers({
        query: { organizationId: currentOrg!.id }
      })

      if (result.data?.members) {
        setMembers(result.data.members as Member[])
      }

      // Load invitations
      const invitesResult = await organization.listInvitations({
        query: { organizationId: currentOrg!.id }
      })

      if (invitesResult.data?.invitations) {
        setInvitations(invitesResult.data.invitations as Invitation[])
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    setInviting(true)

    try {
      await inviteMember(inviteEmail, inviteRole)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
      loadMembers()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      await removeMember(memberId)
      loadMembers()
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateMemberRole(memberId, newRole)
      loadMembers()
    } catch (error) {
      console.error('Failed to update role:', error)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await organization.cancelInvitation({
        invitationId
      })
      loadMembers()
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'purple'
      case 'manager':
        return 'blue'
      default:
        return 'zinc'
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
      <div className="flex items-center justify-between">
        <Heading>Team Members</Heading>
        <Button color="blue" onClick={() => setShowInviteModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <UserGroupIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No team members yet</Subheading>
          <Text className="mt-2">
            Invite team members to start collaborating.
          </Text>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Joined</TableHeader>
                <TableHeader className="w-[100px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.user.name}</TableCell>
                  <TableCell className="text-zinc-500">{member.user.email}</TableCell>
                  <TableCell>
                    {isOwner && member.role !== 'owner' ? (
                      <Select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="w-28"
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                      </Select>
                    ) : (
                      <Badge color={getRoleBadgeColor(member.role)}>
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && isOwner && (
                      <Button
                        plain
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <>
          <Subheading>Pending Invitations</Subheading>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Role</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Expires</TableHeader>
                  <TableHeader className="w-[100px]">Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge color={getRoleBadgeColor(invitation.role)}>
                        {invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color="yellow">{invitation.status}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        plain
                        onClick={() => handleCancelInvitation(invitation.id)}
                      >
                        <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Dialog open={true} onClose={() => setShowInviteModal(false)} size="md">
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization.
          </DialogDescription>

          <form onSubmit={handleInvite}>
            <DialogBody>
              {inviteError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {inviteError}
                </div>
              )}

              <FieldGroup>
                <Field>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    required
                  />
                </Field>

                <Field>
                  <Label>Role</Label>
                  <Select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'manager' | 'member')}
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </Select>
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogActions>
              <Button plain onClick={() => setShowInviteModal(false)} disabled={inviting}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  )
}
