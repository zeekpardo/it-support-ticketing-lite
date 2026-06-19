import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
import { formatDuration } from '../utils/time'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowDownTrayIcon, ChartBarIcon, ChevronUpIcon, FlagIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogActions, DialogBody, DialogTitle } from '@/components/ui/dialog'

interface ReportSummary {
  summary: {
    totalMinutes: number
    totalHours: number
    totalEntries: number
    dateRange: {
      start: string | null
      end: string | null
    }
  }
  groupedBy: string
  data: Array<{
    inbox?: { id: string; name: string; inboxCode: string }
    user?: { id: string; name: string; email: string }
    date?: string
    hourlyRate?: number | null
    totalMinutes: number
    totalHours: number
    entryCount: number
  }>
}

interface Inbox {
  id: string
  name: string
  inboxCode: string
}

interface StaffMember {
  id: string
  role: string
  hourlyRate: number | null
  user: { id: string; name: string; email: string }
}

interface TimeEntry {
  id: string
  taskName: string
  startTime: string
  endTime: string | null
  durationMins: number | null
  isRunning: boolean
  notes: string | null
  inbox: { id: string; name: string; inboxCode: string }
  ticket: { id: string; subject: string; inboxId: string } | null
}

interface TicketGroup {
  ticketId: string | null
  inboxId: string | null
  subject: string
  totalMinutes: number
  entries: TimeEntry[]
}

function getThisWeekRange(): [string, string] {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  return [start.toISOString().split('T')[0], now.toISOString().split('T')[0]]
}

function getThisMonthRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [start.toISOString().split('T')[0], now.toISOString().split('T')[0]]
}

function getLastMonthRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
}

function groupEntriesByTicket(entries: TimeEntry[]): TicketGroup[] {
  const groups: Record<string, TicketGroup> = {}

  for (const entry of entries) {
    const key = entry.ticket?.id || '__no_ticket__'
    if (!groups[key]) {
      groups[key] = {
        ticketId: entry.ticket?.id || null,
        inboxId: entry.ticket?.inboxId || null,
        subject: entry.ticket?.subject || 'No ticket linked',
        totalMinutes: 0,
        entries: [],
      }
    }
    groups[key].totalMinutes += entry.durationMins || 0
    groups[key].entries.push(entry)
  }

  // Sort: tickets with IDs first (alphabetical by subject), then no-ticket group last
  return Object.values(groups).sort((a, b) => {
    if (!a.ticketId) return 1
    if (!b.ticketId) return -1
    return a.subject.localeCompare(b.subject)
  })
}

export default function Reports() {
  const { currentOrg, isAdmin } = useOrganization()
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [startDate, setStartDate] = useState(() => getThisMonthRange()[0])
  const [endDate, setEndDate] = useState(() => getThisMonthRange()[1])
  const [inboxId, setInboxId] = useState('')
  const [userId, setUserId] = useState('')
  const [groupBy, setGroupBy] = useState<'inbox' | 'user' | 'date'>('user')

  // Expandable user rows
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [userEntries, setUserEntries] = useState<TimeEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  // Expandable ticket groups within a user
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

  // Billing - per-user rates from staff members
  const [userRates, setUserRates] = useState<Record<string, number | null>>({})

  // Edit/delete modal state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState({ taskName: '', startTime: '', endTime: '', notes: '' })
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadInboxes()
      if (isAdmin) loadStaffMembers()
    }
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg) {
      loadReport()
      // Collapse expanded rows when filters change
      setExpandedUserId(null)
      setUserEntries([])
      setExpandedTicketId(null)
    }
  }, [currentOrg, startDate, endDate, inboxId, userId, groupBy])

  const loadInboxes = async () => {
    try {
      const data = await api.getInboxes()
      setInboxes(data)
    } catch (error) {
      console.error('Failed to load inboxes:', error)
    }
  }

  const loadStaffMembers = async () => {
    try {
      const data = await api.getStaffMembers()
      setStaffMembers(data)
      const rates: Record<string, number | null> = {}
      data.forEach((m) => { rates[m.user.id] = m.hourlyRate })
      setUserRates(rates)
    } catch (error) {
      console.error('Failed to load staff members:', error)
    }
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      const data = await api.getReportSummary({
        startDate,
        endDate,
        inboxId: inboxId || undefined,
        userId: userId || undefined,
        groupBy,
      })
      setReport(data)
    } catch (error) {
      console.error('Failed to load report:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserExpand = async (uid: string) => {
    if (expandedUserId === uid) {
      setExpandedUserId(null)
      setUserEntries([])
      setExpandedTicketId(null)
      return
    }

    setExpandedUserId(uid)
    setExpandedTicketId(null)
    setEntriesLoading(true)
    try {
      const entries = await api.getTimeEntries({
        userId: uid,
        startDate,
        endDate,
        inboxId: inboxId || undefined,
      })
      // Filter out running entries (summary excludes them)
      setUserEntries(entries.filter((e: TimeEntry) => !e.isRunning))
    } catch (error) {
      console.error('Failed to load user entries:', error)
    } finally {
      setEntriesLoading(false)
    }
  }

  const toggleTicketExpand = (ticketKey: string) => {
    setExpandedTicketId(expandedTicketId === ticketKey ? null : ticketKey)
  }

  const setPeriod = (period: 'week' | 'month' | 'lastMonth') => {
    const [start, end] =
      period === 'week'
        ? getThisWeekRange()
        : period === 'month'
          ? getThisMonthRange()
          : getLastMonthRange()
    setStartDate(start)
    setEndDate(end)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.exportTimeEntries({
        startDate,
        endDate,
        inboxId: inboxId || undefined,
        userId: userId || undefined,
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `time-entries-${startDate}-to-${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export:', error)
    } finally {
      setExporting(false)
    }
  }

  const openEdit = (entry: TimeEntry) => {
    setEditForm({
      taskName: entry.taskName,
      startTime: entry.startTime.slice(0, 16), // datetime-local format
      endTime: entry.endTime ? entry.endTime.slice(0, 16) : '',
      notes: entry.notes || '',
    })
    setEditingEntry(entry)
  }

  const handleSaveEdit = async () => {
    if (!editingEntry) return
    setSaving(true)
    try {
      await api.updateTimeEntry(editingEntry.id, {
        taskName: editForm.taskName,
        startTime: new Date(editForm.startTime).toISOString(),
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : undefined,
        notes: editForm.notes || undefined,
      })
      setEditingEntry(null)
      // Refresh the expanded entries
      if (expandedUserId) toggleUserExpand(expandedUserId).then(() => toggleUserExpand(expandedUserId))
      loadReport()
    } catch (error) {
      console.error('Failed to update entry:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEntry) return
    setSaving(true)
    try {
      await api.deleteTimeEntry(deletingEntry.id)
      setDeletingEntry(null)
      // Remove from local state
      setUserEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id))
      loadReport()
    } catch (error) {
      console.error('Failed to delete entry:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleRateChange = async (uid: string, rate: number | null) => {
    setUserRates((prev) => ({ ...prev, [uid]: rate }))
    const member = staffMembers.find((m) => m.user.id === uid)
    if (!member) return
    try {
      await api.updateStaffHourlyRate(member.id, rate)
    } catch (error) {
      console.error('Failed to update hourly rate:', error)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to view reports</Text>
      </div>
    )
  }

  const ticketGroups = expandedUserId ? groupEntriesByTicket(userEntries) : []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Heading>Reports</Heading>
        <Button onClick={handleExport} disabled={exporting}>
          <ArrowDownTrayIcon className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <div className="flex items-center justify-between">
          <Subheading>Filters</Subheading>
          <div className="flex gap-2">
            <Button plain onClick={() => setPeriod('week')}>
              This Week
            </Button>
            <Button plain onClick={() => setPeriod('month')}>
              This Month
            </Button>
            <Button plain onClick={() => setPeriod('lastMonth')}>
              Last Month
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>

          <Field>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>

          <Field>
            <Label>Inbox</Label>
            <Select value={inboxId} onChange={(e) => setInboxId(e.target.value)}>
              <option value="">All Inboxes</option>
              {inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  [{inbox.inboxCode}] {inbox.name}
                </option>
              ))}
            </Select>
          </Field>

          {isAdmin && (
            <Field>
              <Label>User</Label>
              <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">All Users</option>
                {staffMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field>
            <Label>Group By</Label>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'inbox' | 'user' | 'date')}
            >
              {isAdmin && <option value="user">User</option>}
              <option value="inbox">Inbox</option>
              <option value="date">Date</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Text className="text-sm text-zinc-500">Total Time</Text>
            <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {report.summary.totalHours}h
            </div>
            <Text className="text-sm text-zinc-400">{report.summary.totalMinutes} minutes</Text>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Text className="text-sm text-zinc-500">Total Entries</Text>
            <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {report.summary.totalEntries}
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Text className="text-sm text-zinc-500">Avg per Entry</Text>
            <div className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {report.summary.totalEntries > 0
                ? formatDuration(Math.round(report.summary.totalMinutes / report.summary.totalEntries))
                : '0m'}
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
            <Text className="text-sm text-zinc-500">Date Range</Text>
            <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {startDate} to {endDate}
            </div>
          </div>
        </div>
      )}

      {/* Report Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Text>Loading...</Text>
        </div>
      ) : report && report.data.length > 0 ? (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>
                  {groupBy === 'inbox' && 'Inbox'}
                  {groupBy === 'user' && 'User'}
                  {groupBy === 'date' && 'Date'}
                </TableHeader>
                <TableHeader>Entries</TableHeader>
                <TableHeader>Time</TableHeader>
                {groupBy === 'user' && <TableHeader></TableHeader>}
              </TableRow>
            </TableHead>
            <TableBody>
              {report.data.map((row, index) => {
                const rowUserId = row.user?.id
                const isExpanded = groupBy === 'user' && expandedUserId === rowUserId

                return (
                  <>
                    <TableRow
                      key={index}
                      className={groupBy === 'user' ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50' : ''}
                      onClick={groupBy === 'user' && rowUserId ? () => toggleUserExpand(rowUserId) : undefined}
                    >
                      <TableCell className="font-medium">
                        {groupBy === 'inbox' && row.inbox && (
                          <>
                            <Badge color="blue" className="mr-2">
                              {row.inbox.inboxCode}
                            </Badge>
                            {row.inbox.name}
                          </>
                        )}
                        {groupBy === 'user' && row.user && row.user.name}
                        {groupBy === 'date' && row.date}
                      </TableCell>
                      <TableCell className="text-zinc-500">{row.entryCount}</TableCell>
                      <TableCell className="font-mono">{formatDuration(row.totalMinutes)}</TableCell>
                      {groupBy === 'user' && (
                        <TableCell className="w-10">
                          <ChevronUpIcon
                            className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
                          />
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Expanded user detail */}
                    {isExpanded && (
                      <TableRow key={`${index}-expanded`}>
                        <TableCell colSpan={4} className="p-0">
                          <div className="bg-zinc-50 p-4 dark:bg-zinc-900/50">
                            {entriesLoading ? (
                              <Text className="py-4 text-center text-zinc-500">Loading entries...</Text>
                            ) : ticketGroups.length === 0 ? (
                              <Text className="py-4 text-center text-zinc-500">No entries found</Text>
                            ) : (
                              <div className="space-y-1">
                                {ticketGroups.map((group) => {
                                  const ticketKey = group.ticketId || '__no_ticket__'
                                  const isTicketExpanded = expandedTicketId === ticketKey

                                  return (
                                    <div key={ticketKey}>
                                      {/* Ticket group header */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleTicketExpand(ticketKey)
                                        }}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                      >
                                        <ChevronUpIcon
                                          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${isTicketExpanded ? '' : 'rotate-180'}`}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                          {group.ticketId && group.inboxId ? (
                                            <Link
                                              to={`/inboxes/${group.inboxId}/tickets/${group.ticketId}`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                                            >
                                              {group.subject}
                                            </Link>
                                          ) : (
                                            group.subject
                                          )}
                                        </span>
                                        <Badge color={group.ticketId ? 'blue' : 'zinc'} className="shrink-0">
                                          {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                                        </Badge>
                                        <span className="shrink-0 font-mono text-sm text-zinc-600 dark:text-zinc-300">
                                          {formatDuration(group.totalMinutes)}
                                        </span>
                                        {group.totalMinutes > 20 && (
                                          <FlagIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" title="Over 20 minutes" />
                                        )}
                                      </button>

                                      {/* Individual log entries */}
                                      {isTicketExpanded && (
                                        <div className="ml-7 border-l border-zinc-200 pl-3 dark:border-zinc-700">
                                          <table className="w-full text-sm">
                                            <tbody>
                                              {group.entries.map((entry) => (
                                                <tr key={entry.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                                                  <td className="py-1.5 pr-3 text-zinc-500">
                                                    {new Date(entry.startTime).toLocaleDateString()}
                                                  </td>
                                                  <td className="py-1.5 pr-3 text-zinc-900 dark:text-zinc-100">
                                                    {entry.taskName}
                                                  </td>
                                                  <td className="py-1.5 pr-3">
                                                    <Badge color="sky">{entry.inbox.inboxCode}</Badge>
                                                  </td>
                                                  <td className="py-1.5 pr-3 font-mono text-zinc-600 dark:text-zinc-300">
                                                    <span className="inline-flex items-center gap-1">
                                                      {formatDuration(entry.durationMins || 0)}
                                                      {(entry.durationMins || 0) > 15 && (
                                                        <FlagIcon className="h-3 w-3 text-amber-500" title="Over 15 minutes" />
                                                      )}
                                                    </span>
                                                  </td>
                                                  <td className="py-1.5 text-zinc-400">
                                                    {entry.notes || ''}
                                                  </td>
                                                  {isAdmin && (
                                                    <td className="py-1.5 pl-2 text-right whitespace-nowrap">
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                                                        className="inline-flex p-1 text-zinc-400 hover:text-blue-500"
                                                        title="Edit"
                                                      >
                                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setDeletingEntry(entry) }}
                                                        className="inline-flex p-1 text-zinc-400 hover:text-red-500"
                                                        title="Delete"
                                                      >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                      </button>
                                                    </td>
                                                  )}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <ChartBarIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No data for this period</Subheading>
          <Text className="mt-2">Try adjusting your date range or filters.</Text>
        </div>
      )}

      {/* Billing Section (admin only) */}
      {isAdmin && report && report.data.length > 0 && groupBy === 'user' && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Subheading>Billing Summary</Subheading>

          <div className="mt-4">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>User</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Rate ($/hr)</TableHeader>
                  <TableHeader>Amount</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.data.map((row, index) => {
                  const uid = row.user?.id
                  const rate = uid ? (userRates[uid] ?? row.hourlyRate ?? null) : null
                  const amount = rate && row.totalHours ? Math.round(row.totalHours * rate * 100) / 100 : null

                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.user?.name}</TableCell>
                      <TableCell className="font-mono">{row.totalHours}h</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rate ?? ''}
                          onChange={(e) => {
                            if (!uid) return
                            const val = e.target.value ? parseFloat(e.target.value) : null
                            handleRateChange(uid, val)
                          }}
                          className="w-24"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="font-mono">
                        {amount !== null ? `$${amount.toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {/* Total row */}
                {(() => {
                  const grandTotal = report.data.reduce((sum, row) => {
                    const uid = row.user?.id
                    const rate = uid ? (userRates[uid] ?? row.hourlyRate ?? 0) : 0
                    return sum + row.totalHours * (rate || 0)
                  }, 0)

                  return (
                    <TableRow className="border-t-2 border-zinc-300 font-bold dark:border-zinc-600">
                      <TableCell>Total</TableCell>
                      <TableCell className="font-mono">{report.summary.totalHours}h</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-mono">
                        {grandTotal > 0 ? `$${(Math.round(grandTotal * 100) / 100).toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      <Dialog open={!!editingEntry} onClose={() => setEditingEntry(null)}>
        <DialogTitle>Edit Time Entry</DialogTitle>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Task Name</Label>
              <Input
                value={editForm.taskName}
                onChange={(e) => setEditForm({ ...editForm, taskName: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
              />
            </Field>
            <Field>
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setEditingEntry(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingEntry} onClose={() => setDeletingEntry(null)}>
        <DialogTitle>Delete Time Entry</DialogTitle>
        <DialogBody>
          <Text>
            Are you sure you want to delete the entry "{deletingEntry?.taskName}"?
            This action cannot be undone.
          </Text>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setDeletingEntry(null)}>Cancel</Button>
          <Button color="red" onClick={handleDelete} disabled={saving}>
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
