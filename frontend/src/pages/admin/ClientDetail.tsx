import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { Heading, Subheading } from '@/components/ui/heading'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import {
  ArrowLeftIcon,
  UserIcon,
  TicketIcon,
  ComputerDesktopIcon,
  EnvelopeIcon,
  PhoneIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface Client {
  id: string
  role: string
  user: { id: string; name: string; email: string; phone?: string }
  projectAssignments: Array<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>
  tickets: Array<{
    id: string
    subject: string
    status: string
    priorityLevel: string
    requestType: string
    createdAt: string
    project: { id: string; name: string; projectCode: string }
    owner?: { id: string; user: { id: string; name: string } }
  }>
  softwareAccess: Array<{
    id: string
    status: string
    reason?: string
    reviewNotes?: string
    createdAt: string
    projectSoftware: {
      id: string
      software: { id: string; name: string; iconUrl?: string; vendor?: string }
      project: { id: string; name: string; projectCode: string }
    }
    reviewer?: { id: string; user: { id: string; name: string } }
  }>
}

type TabType = 'tickets' | 'software'

const statusColors: Record<string, 'yellow' | 'blue' | 'orange' | 'purple' | 'green' | 'zinc'> = {
  NEW_REQUEST: 'yellow',
  IN_PROGRESS: 'blue',
  WAITING_FOR_INFO: 'orange',
  REVIEW: 'purple',
  RESOLVED: 'green',
}

const priorityColors: Record<string, 'zinc' | 'blue' | 'orange' | 'red'> = {
  LOW: 'zinc',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
}

const accessStatusColors: Record<string, 'yellow' | 'green' | 'red'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  DECLINED: 'red',
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ClientDetail() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('tickets')
  const [saving, setSaving] = useState(false)

  // Inline name editing
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Inline phone editing
  const [editingPhone, setEditingPhone] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const phoneRef = useRef<HTMLInputElement>(null)

  // Inline project editing
  const [editingProjects, setEditingProjects] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [allProjects, setAllProjects] = useState<Array<{ id: string; name: string; projectCode: string; isActive: boolean }>>([])

  useEffect(() => {
    if (currentOrg && memberId) {
      loadClient()
    }
  }, [currentOrg, memberId])

  const loadClient = async () => {
    if (!memberId) return

    setLoading(true)
    try {
      const data = await api.getClientDetail(memberId)
      setClient(data)
    } catch (error) {
      console.error('Failed to load client:', error)
    } finally {
      setLoading(false)
    }
  }

  // Name editing handlers
  const startEditingName = () => {
    if (!client) return
    setEditName(client.user.name)
    setEditingName(true)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  const cancelEditingName = () => setEditingName(false)

  const saveName = async () => {
    if (!client || !memberId) return
    const name = editName.trim()
    if (!name) return
    if (name === client.user.name) {
      setEditingName(false)
      return
    }
    setSaving(true)
    try {
      await api.updateClient(memberId, { name })
      setClient({ ...client, user: { ...client.user, name } })
      setEditingName(false)
    } catch (error) {
      console.error('Failed to update client name:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveName()
    } else if (e.key === 'Escape') {
      cancelEditingName()
    }
  }

  // Phone editing handlers
  const startEditingPhone = () => {
    if (!client) return
    setEditPhone(client.user.phone || '')
    setEditingPhone(true)
    setTimeout(() => phoneRef.current?.focus(), 0)
  }

  const cancelEditingPhone = () => setEditingPhone(false)

  const savePhone = async () => {
    if (!client || !memberId) return
    const phone = editPhone.trim()
    if (phone === (client.user.phone || '')) {
      setEditingPhone(false)
      return
    }
    setSaving(true)
    try {
      await api.updateClient(memberId, { phone })
      setClient({ ...client, user: { ...client.user, phone: phone || undefined } })
      setEditingPhone(false)
    } catch (error) {
      console.error('Failed to update phone:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      savePhone()
    } else if (e.key === 'Escape') {
      cancelEditingPhone()
    }
  }

  // Project editing handlers
  const startEditingProjects = async () => {
    if (!client) return
    setSelectedProjectIds(client.projectAssignments.map((pa) => pa.project.id))
    setEditingProjects(true)
    if (allProjects.length === 0) {
      try {
        const projects = await api.getProjects()
        setAllProjects(projects)
      } catch (error) {
        console.error('Failed to load projects:', error)
      }
    }
  }

  const cancelEditingProjects = () => setEditingProjects(false)

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }

  const saveProjects = async () => {
    if (!client || !memberId) return
    const currentIds = client.projectAssignments.map((pa) => pa.project.id).sort()
    const newIds = [...selectedProjectIds].sort()
    if (JSON.stringify(currentIds) === JSON.stringify(newIds)) {
      setEditingProjects(false)
      return
    }
    setSaving(true)
    try {
      const assignments = await api.updateMemberProjects(memberId, selectedProjectIds)
      setClient({ ...client, projectAssignments: assignments })
      setEditingProjects(false)
    } catch (error) {
      console.error('Failed to update projects:', error)
    } finally {
      setSaving(false)
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

  if (!client) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Client not found</Text>
      </div>
    )
  }

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'tickets', label: 'Tickets', count: client.tickets.length },
    { id: 'software', label: 'Software Access', count: client.softwareAccess.length },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button plain onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>

          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="Name"
                  disabled={saving}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={saveName} disabled={saving} className="text-green-600 hover:text-green-700 dark:text-green-400">
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button onClick={cancelEditingName} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="group flex items-center gap-1.5">
                <Heading>{client.user.name}</Heading>
                <button
                  onClick={startEditingName}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-zinc-500">
                <EnvelopeIcon className="w-4 h-4" />
                <Text className="text-sm">{client.user.email}</Text>
              </div>
              {editingPhone ? (
                <div className="flex items-center gap-1.5">
                  <PhoneIcon className="w-4 h-4 text-zinc-500" />
                  <input
                    ref={phoneRef}
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    onKeyDown={handlePhoneKeyDown}
                    placeholder="Phone number"
                    disabled={saving}
                    className="w-40 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-0.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={savePhone} disabled={saving} className="text-green-600 hover:text-green-700 dark:text-green-400">
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEditingPhone} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="group/phone flex items-center gap-1 text-zinc-500">
                  <PhoneIcon className="w-4 h-4" />
                  <Text className="text-sm">{client.user.phone || 'No phone'}</Text>
                  <button
                    onClick={startEditingPhone}
                    className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <PencilSquareIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {editingProjects ? (
              <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-sm">
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allProjects.filter((p) => p.isActive).map((project) => (
                    <label key={project.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-700">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                        disabled={saving}
                        className="rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-900 dark:text-white">{project.name}</span>
                      <span className="text-xs text-zinc-400">{project.projectCode}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">
                  <button onClick={saveProjects} disabled={saving} className="text-green-600 hover:text-green-700 dark:text-green-400">
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEditingProjects} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="group/projects flex items-center gap-2 mt-2">
                {client.projectAssignments.length > 0 ? (
                  client.projectAssignments.map((pa) => (
                    <Badge key={pa.id} color={pa.project.isActive ? 'blue' : 'zinc'}>
                      {pa.project.name}
                    </Badge>
                  ))
                ) : (
                  <Text className="text-sm text-zinc-400">No projects assigned</Text>
                )}
                <button
                  onClick={startEditingProjects}
                  className="opacity-0 group-hover/projects:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:hover:text-zinc-300'
                }
              `}
            >
              {tab.id === 'tickets' ? (
                <TicketIcon className="w-5 h-5" />
              ) : (
                <ComputerDesktopIcon className="w-5 h-5" />
              )}
              {tab.label}
              <span className={`
                ml-1 rounded-full px-2 py-0.5 text-xs font-medium
                ${activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tickets' && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Subheading>Tickets</Subheading>
          {client.tickets.length > 0 ? (
            <div className="mt-4">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Subject</TableHeader>
                    <TableHeader>Project</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Priority</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Created</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {client.tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <Link
                          to={`/projects/${ticket.project.id}/tickets/${ticket.id}`}
                          className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {ticket.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc">{ticket.project.projectCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={statusColors[ticket.status] || 'zinc'}>
                          {formatStatus(ticket.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={priorityColors[ticket.priorityLevel] || 'zinc'}>
                          {ticket.priorityLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {ticket.owner?.user.name || 'Unassigned'}
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {formatDate(ticket.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Text className="mt-2 text-zinc-500">No tickets found for this client</Text>
          )}
        </div>
      )}

      {activeTab === 'software' && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Subheading>Software Access Requests</Subheading>
          {client.softwareAccess.length > 0 ? (
            <div className="mt-4">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Software</TableHeader>
                    <TableHeader>Project</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Reason</TableHeader>
                    <TableHeader>Reviewed By</TableHeader>
                    <TableHeader>Requested</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {client.softwareAccess.map((access) => (
                    <TableRow key={access.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {access.projectSoftware.software.iconUrl ? (
                            <img
                              src={access.projectSoftware.software.iconUrl}
                              alt=""
                              className="w-8 h-8 rounded"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                              <ComputerDesktopIcon className="w-4 h-4 text-zinc-500" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{access.projectSoftware.software.name}</span>
                            {access.projectSoftware.software.vendor && (
                              <Text className="text-xs text-zinc-500">{access.projectSoftware.software.vendor}</Text>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc">{access.projectSoftware.project.projectCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={accessStatusColors[access.status] || 'zinc'}>
                          {access.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-500 max-w-xs truncate">
                        {access.reason || '-'}
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {access.reviewer?.user.name || '-'}
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {formatDate(access.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Text className="mt-2 text-zinc-500">No software access requests found for this client</Text>
          )}
        </div>
      )}
    </div>
  )
}
