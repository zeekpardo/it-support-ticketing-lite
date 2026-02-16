import { useState, useEffect } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { useAuth } from '../../context/AuthContext'
import { organization } from '../../lib/auth-client'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlusIcon, TrashIcon, UserGroupIcon, FolderIcon } from '@heroicons/react/24/outline'
import AddUserModal from './members/AddUserModal'
import InboxAssignmentModal from './members/InboxAssignmentModal'

interface Member {
  id: string
  role: 'owner' | 'manager' | 'member' | 'client'
  user: {
    id: string
    name: string
    email: string
  }
  createdAt: Date | string
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date | string
}

type BadgeColor = 'purple' | 'blue' | 'green' | 'zinc'

const ROLE_BADGE_COLORS: Record<string, BadgeColor> = {
  owner: 'purple',
  manager: 'blue',
  client: 'green',
}

export default function AdminMembers() {
  const { currentOrg, isOwner, inviteMember, removeMember, updateMemberRole } = useOrganization()
  const { isSuperAdmin } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [inboxesMember, setInboxesMember] = useState<Member | null>(null)
  const [invitationInboxes, setInvitationProjects] = useState<Record<string, Array<{ id: string; name: string; inboxCode: string }>>>({})

  useEffect(() => {
    if (currentOrg) loadMembers()
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

      const invitesResult = await organization.listInvitations({
        query: { organizationId: currentOrg!.id }
      })
      if (invitesResult.data) {
        const pending = (invitesResult.data as Invitation[]).filter(inv => inv.status === 'pending')
        setInvitations(pending)

        if (pending.length > 0) {
          api.getInvitationProjects()
            .then(setInvitationProjects)
            .catch(err => console.error('Failed to load invitation inboxes:', err))
        } else {
          setInvitationProjects({})
        }
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return
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
      await organization.cancelInvitation({ invitationId })
      loadMembers()
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
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
        <Heading>Users</Heading>
        <Button color="blue" onClick={() => setShowAddModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      {members.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <UserGroupIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No users yet</Subheading>
          <Text className="mt-2">
            Add users to start collaborating.
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
                <TableRow
                  key={member.id}
                  href={member.role === 'client' ? `/admin/clients/${member.id}` : undefined}
                >
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
                        <option value="client">Client</option>
                      </Select>
                    ) : (
                      <Badge color={ROLE_BADGE_COLORS[member.role] || 'zinc'}>
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(member.role === 'client' || member.role === 'member') && isOwner && (
                        <Button
                          plain
                          onClick={() => setInboxesMember(member)}
                          title="Manage inbox access"
                        >
                          <FolderIcon className="h-4 w-4 text-zinc-400 hover:text-blue-500" />
                        </Button>
                      )}
                      {member.role !== 'owner' && isOwner && (
                        <Button
                          plain
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                        </Button>
                      )}
                    </div>
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
                  <TableHeader>Inboxes</TableHeader>
                  <TableHeader>Expires</TableHeader>
                  <TableHeader className="w-[100px]">Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {invitations.map((invitation) => {
                  const inboxes = invitationInboxes[invitation.id] || []
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge color={ROLE_BADGE_COLORS[invitation.role] || 'zinc'}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {inboxes.length > 0
                          ? inboxes.map(p => p.name).join(', ')
                          : <span className="text-zinc-400">None</span>}
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
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AddUserModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadMembers}
        isSuperAdmin={isSuperAdmin}
        inviteMember={inviteMember}
      />

      <InboxAssignmentModal
        member={inboxesMember}
        onClose={() => setInboxesMember(null)}
      />
    </div>
  )
}
