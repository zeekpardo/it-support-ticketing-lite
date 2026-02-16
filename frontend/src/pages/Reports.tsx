import { useState, useEffect } from 'react'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
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
import { ArrowDownTrayIcon, ChartBarIcon } from '@heroicons/react/24/outline'

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

export default function Reports() {
  const { currentOrg, isAdmin } = useOrganization()
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [inboxId, setInboxId] = useState('')
  const [groupBy, setGroupBy] = useState<'inbox' | 'user' | 'date'>('inbox')

  useEffect(() => {
    if (currentOrg) {
      loadInboxes()
    }
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg) {
      loadReport()
    }
  }, [currentOrg, startDate, endDate, inboxId, groupBy])

  const loadInboxes = async () => {
    try {
      const data = await api.getInboxes()
      setInboxes(data)
    } catch (error) {
      console.error('Failed to load inboxes:', error)
    }
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      const data = await api.getReportSummary({
        startDate,
        endDate,
        inboxId: inboxId || undefined,
        groupBy
      })
      setReport(data)
    } catch (error) {
      console.error('Failed to load report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await api.exportTimeEntries({
        startDate,
        endDate,
        inboxId: inboxId || undefined
      })

      // Download the CSV
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

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to view reports</Text>
      </div>
    )
  }

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
        <Subheading>Filters</Subheading>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          <Field>
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>

          <Field>
            <Label>Inbox</Label>
            <Select
              value={inboxId}
              onChange={(e) => setInboxId(e.target.value)}
            >
              <option value="">All Inboxes</option>
              {inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  [{inbox.inboxCode}] {inbox.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Group By</Label>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'inbox' | 'user' | 'date')}
            >
              <option value="inbox">Inbox</option>
              {isAdmin && <option value="user">User</option>}
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
                ? Math.round(report.summary.totalMinutes / report.summary.totalEntries)
                : 0}m
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
                {groupBy !== 'user' && <TableHeader>User</TableHeader>}
                <TableHeader>Entries</TableHeader>
                <TableHeader>Minutes</TableHeader>
                <TableHeader>Hours</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.data.map((row, index) => (
                <TableRow key={index}>
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
                  {groupBy !== 'user' && (
                    <TableCell className="text-zinc-500">
                      {row.user?.name || '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-zinc-500">{row.entryCount}</TableCell>
                  <TableCell className="font-mono">{row.totalMinutes}m</TableCell>
                  <TableCell className="font-mono">{row.totalHours}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <ChartBarIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No data for this period</Subheading>
          <Text className="mt-2">
            Try adjusting your date range or filters.
          </Text>
        </div>
      )}
    </div>
  )
}
