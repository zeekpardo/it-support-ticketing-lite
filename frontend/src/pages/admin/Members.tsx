import { useState, useEffect } from 'react'
import { useOrganization } from '../../context/OrganizationContext'
import { useAuth } from '../../context/AuthContext'
import { organization } from '../../lib/auth-client'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlusIcon, TrashIcon, UserGroupIcon, EnvelopeIcon, UserPlusIcon, FolderIcon } from '@heroicons/react/24/outline'
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/ui/checkbox'

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

interface Project {
  id: string
  name: string
  projectCode: string
  isActive: boolean
}

export default function AdminMembers() {
  const { currentOrg, isOwner, inviteMember, removeMember, updateMemberRole } = useOrganization()
  const { isSuperAdmin } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Modal mode: 'invite' sends invitation email, 'create' creates user directly (super admin only)
  const [addMode, setAddMode] = useState<'invite' | 'create'>('invite')

  // Form fields
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'manager' | 'member' | 'client'>('member')
  const [formProjectIds, setFormProjectIds] = useState<string[]>([])
  const [formProjects, setFormProjects] = useState<Project[]>([])
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Project assignment modal state
  const [showProjectsModal, setShowProjectsModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(new Set())
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsSaving, setProjectsSaving] = useState(false)

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

      if (invitesResult.data) {
        // Filter to only show pending invitations
        const pendingInvitations = (invitesResult.data as Invitation[]).filter(
          inv => inv.status === 'pending'
        )
        setInvitations(pendingInvitations)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormPassword('')
    setFormRole('member')
    setFormProjectIds([])
    setFormError('')
  }

  const handleOpenAddModal = async () => {
    setShowAddModal(true)
    // Load projects for client assignment
    try {
      const projectsData = await api.getProjects()
      setFormProjects(projectsData.filter((p: Project) => p.isActive))
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      // Validate project selection for clients (only for direct creation)
      if (formRole === 'client' && addMode === 'create' && formProjectIds.length === 0) {
        throw new Error('Please select at least one project for the client')
      }

      // Clients can only be created directly (not invited) because they need project assignments
      if (formRole === 'client' && addMode === 'invite') {
        throw new Error('Clients must be created directly with project assignments. Please use "Create User" mode.')
      }

      if (addMode === 'invite') {
        // Send invitation
        await inviteMember(formEmail, formRole)
      } else {
        // Create user directly and add to organization (super admin only)
        if (!formName.trim()) {
          throw new Error('Name is required')
        }
        if (!formPhone.trim()) {
          throw new Error('Phone number is required')
        }
        if (formPassword.length < 8) {
          throw new Error('Password must be at least 8 characters')
        }

        // Create user and add them to the organization in one step
        await api.createUserAndAddToOrg({
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          role: formRole,
          projectIds: formRole === 'client' ? formProjectIds : undefined,
        })
      }

      handleCloseModal()
      loadMembers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add user')
    } finally {
      setFormLoading(false)
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
      await organization.cancelInvitation({
        invitationId
      })
      loadMembers()
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
    }
  }

  const handleManageProjects = async (member: Member) => {
    setSelectedMember(member)
    setShowProjectsModal(true)
    setProjectsLoading(true)

    try {
      // Load all projects and member's current assignments in parallel
      const [projectsData, assignmentsData] = await Promise.all([
        api.getProjects(),
        api.getMemberProjects(member.id)
      ])

      setAllProjects(projectsData)
      setAssignedProjectIds(new Set(assignmentsData.map(a => a.project.id)))
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleProjectToggle = (projectId: string, checked: boolean) => {
    setAssignedProjectIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(projectId)
      } else {
        next.delete(projectId)
      }
      return next
    })
  }

  const handleSaveProjectAssignments = async () => {
    if (!selectedMember) return

    setProjectsSaving(true)
    try {
      await api.updateMemberProjects(selectedMember.id, Array.from(assignedProjectIds))
      setShowProjectsModal(false)
      setSelectedMember(null)
    } catch (error) {
      console.error('Failed to save project assignments:', error)
    } finally {
      setProjectsSaving(false)
    }
  }

  const handleCloseProjectsModal = () => {
    setShowProjectsModal(false)
    setSelectedMember(null)
    setAssignedProjectIds(new Set())
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'purple'
      case 'manager':
        return 'blue'
      case 'client':
        return 'green'
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
        <Heading>Users</Heading>
        <Button color="blue" onClick={handleOpenAddModal}>
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
                        <option value="client">Client</option>
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
                    <div className="flex items-center gap-1">
                      {member.role === 'client' && isOwner && (
                        <Button
                          plain
                          onClick={() => handleManageProjects(member)}
                          title="Manage project access"
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

      {/* Add User Modal */}
      <Dialog open={showAddModal} onClose={handleCloseModal} size="md">
        <DialogTitle>Add User</DialogTitle>
        <DialogDescription>
          {addMode === 'invite'
            ? 'Send an invitation email to add a new user.'
            : 'Create a new user account directly.'}
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            {/* Mode toggle - only show if super admin */}
            {isSuperAdmin && (
              <div className="mb-6 flex gap-2">
                <Button
                  type="button"
                  color={addMode === 'invite' ? 'blue' : 'white'}
                  onClick={() => setAddMode('invite')}
                  className="flex-1"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Send Invitation
                </Button>
                <Button
                  type="button"
                  color={addMode === 'create' ? 'blue' : 'white'}
                  onClick={() => setAddMode('create')}
                  className="flex-1"
                >
                  <UserPlusIcon className="h-4 w-4" />
                  Create User
                </Button>
              </div>
            )}

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {formError}
              </div>
            )}

            <FieldGroup>
              {addMode === 'create' && (
                <Field>
                  <Label>Name</Label>
                  <Input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </Field>
              )}

              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </Field>

              {addMode === 'create' && (
                <Field>
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                </Field>
              )}

              {addMode === 'create' && (
                <Field>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                  />
                  <Description>The user can change this after logging in.</Description>
                </Field>
              )}

              <Field>
                <Label>Role</Label>
                <Select
                  value={formRole}
                  onChange={(e) => {
                    const newRole = e.target.value as 'manager' | 'member' | 'client'
                    setFormRole(newRole)
                    if (newRole !== 'client') {
                      setFormProjectIds([])
                    } else if (isSuperAdmin) {
                      // Auto-switch to create mode for clients (they need project assignments)
                      setAddMode('create')
                    }
                  }}
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="client">Client</option>
                </Select>
                <Description className="mt-2 text-sm text-zinc-500">
                  {formRole === 'manager' && 'Can manage members, projects, and tickets'}
                  {formRole === 'member' && 'Can track time and work on tickets'}
                  {formRole === 'client' && 'Can submit and view support tickets'}
                </Description>
              </Field>

              {formRole === 'client' && addMode === 'create' && (
                <Field>
                  <Label>Project Access *</Label>
                  <Description className="mb-2">Select at least one project the client can access.</Description>
                  {formProjects.length === 0 ? (
                    <Text className="text-amber-600 dark:text-amber-400">
                      No active projects available. Create a project first.
                    </Text>
                  ) : (
                    <CheckboxGroup>
                      {formProjects.map((project) => (
                        <CheckboxField key={project.id}>
                          <Checkbox
                            checked={formProjectIds.includes(project.id)}
                            onChange={(checked) => {
                              if (checked) {
                                setFormProjectIds([...formProjectIds, project.id])
                              } else {
                                setFormProjectIds(formProjectIds.filter(id => id !== project.id))
                              }
                            }}
                          />
                          <Label>
                            {project.name}
                            <span className="ml-2 text-zinc-500">({project.projectCode})</span>
                          </Label>
                        </CheckboxField>
                      ))}
                    </CheckboxGroup>
                  )}
                </Field>
              )}

              {formRole === 'client' && addMode === 'invite' && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  Clients cannot be invited via email because they require project assignments.
                  {isSuperAdmin
                    ? ' Please use "Create User" mode instead.'
                    : ' Please contact a super admin to create client accounts.'}
                </div>
              )}
            </FieldGroup>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={handleCloseModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button color="blue" type="submit" disabled={formLoading}>
              {formLoading
                ? (addMode === 'invite' ? 'Sending...' : 'Creating...')
                : (addMode === 'invite' ? 'Send Invitation' : 'Create User')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Project Assignment Modal */}
      <Dialog open={showProjectsModal} onClose={handleCloseProjectsModal} size="md">
        <DialogTitle>Manage Project Access</DialogTitle>
        <DialogDescription>
          {selectedMember && (
            <>Select which projects <strong>{selectedMember.user.name}</strong> can access.</>
          )}
        </DialogDescription>

        <DialogBody>
          {projectsLoading ? (
            <div className="py-8 text-center">
              <Text>Loading projects...</Text>
            </div>
          ) : allProjects.length === 0 ? (
            <div className="py-8 text-center">
              <Text>No projects available. Create a project first.</Text>
            </div>
          ) : (
            <CheckboxGroup>
              {allProjects.filter(p => p.isActive).map((project) => (
                <CheckboxField key={project.id}>
                  <Checkbox
                    checked={assignedProjectIds.has(project.id)}
                    onChange={(checked) => handleProjectToggle(project.id, checked)}
                  />
                  <Label>
                    {project.name}
                    <span className="ml-2 text-zinc-500">({project.projectCode})</span>
                  </Label>
                </CheckboxField>
              ))}
            </CheckboxGroup>
          )}
        </DialogBody>

        <DialogActions>
          <Button plain onClick={handleCloseProjectsModal} disabled={projectsSaving}>
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSaveProjectAssignments}
            disabled={projectsSaving || projectsLoading}
          >
            {projectsSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
