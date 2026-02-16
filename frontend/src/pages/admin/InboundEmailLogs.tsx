import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { emailRulesApi, InboundEmail } from '../../api/emailRules'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function InboundEmailLogs() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [emails, setEmails] = useState<InboundEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  useEffect(() => {
    if (currentOrg) {
      loadEmails()
    }
  }, [currentOrg, statusFilter])

  const loadEmails = async () => {
    setLoading(true)
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined
      const data = await emailRulesApi.getInboundLogs(params)
      setEmails(data)
    } catch (error) {
      console.error('Failed to load email logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return <Badge color="green">Processed</Badge>
      case 'PENDING':
        return <Badge color="amber">Pending</Badge>
      case 'FAILED':
        return <Badge color="red">Failed</Badge>
      case 'IGNORED':
        return <Badge color="zinc">Ignored</Badge>
      default:
        return <Badge color="zinc">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date)
  }

  const viewEmailDetail = (email: InboundEmail) => {
    setSelectedEmail(email)
    setShowDetailDialog(true)
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
        <div>
          <Heading>Inbound Email Logs</Heading>
          <Text className="mt-2">View and monitor all incoming emails</Text>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSED">Processed</option>
            <option value="FAILED">Failed</option>
            <option value="IGNORED">Ignored</option>
          </Select>
          <Button plain onClick={loadEmails}>
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </Button>
          <Button plain onClick={() => navigate('/admin/email-rules')}>
            Manage Rules
          </Button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <EnvelopeIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Text className="mt-4">No emails received yet</Text>
          <Text className="mt-2 text-sm text-zinc-500">
            {statusFilter !== 'all'
              ? `No emails with status "${statusFilter}"`
              : 'Incoming emails will appear here'}
          </Text>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Received</TableHeader>
                <TableHeader>From</TableHeader>
                <TableHeader>To</TableHeader>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Ticket/Comment</TableHeader>
                <TableHeader className="w-[100px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="text-sm text-zinc-500">
                    {formatDate(email.receivedAt)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">
                        {email.fromName || email.from.split('@')[0]}
                      </div>
                      <div className="text-sm text-zinc-500">{email.from}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">{email.to}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => viewEmailDetail(email)}
                      className="text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                      {email.subject || '(No Subject)'}
                    </button>
                  </TableCell>
                  <TableCell>{getStatusBadge(email.status)}</TableCell>
                  <TableCell>
                    {email.ticket ? (
                      <button
                        onClick={() => navigate(`/admin/tickets/${email.ticketId}`)}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Ticket #{email.ticketId?.slice(-6)}
                      </button>
                    ) : email.comment ? (
                      <button
                        onClick={() => navigate(`/admin/tickets/${email.comment.ticketId}`)}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Comment on #{email.comment.ticketId.slice(-6)}
                      </button>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button plain onClick={() => viewEmailDetail(email)}>
                      <span className="text-sm text-zinc-500 hover:text-blue-600">View</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Email Detail Dialog */}
      <Dialog open={showDetailDialog} onClose={() => setShowDetailDialog(false)} size="3xl">
        <DialogTitle>Email Details</DialogTitle>
        <DialogDescription>View full email information and processing details</DialogDescription>
        <DialogBody>
          {selectedEmail && (
            <div className="space-y-6">
              {/* Email Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text className="text-sm font-medium text-zinc-500">From</Text>
                  <Text className="mt-1">
                    {selectedEmail.fromName && (
                      <span className="font-medium">{selectedEmail.fromName} </span>
                    )}
                    <span className="text-zinc-600 dark:text-zinc-400">
                      &lt;{selectedEmail.from}&gt;
                    </span>
                  </Text>
                </div>
                <div>
                  <Text className="text-sm font-medium text-zinc-500">To</Text>
                  <Text className="mt-1">{selectedEmail.to}</Text>
                </div>
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Subject</Text>
                  <Text className="mt-1">{selectedEmail.subject || '(No Subject)'}</Text>
                </div>
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Status</Text>
                  <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
                </div>
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Received</Text>
                  <Text className="mt-1">{new Date(selectedEmail.receivedAt).toLocaleString()}</Text>
                </div>
                {selectedEmail.processedAt && (
                  <div>
                    <Text className="text-sm font-medium text-zinc-500">Processed</Text>
                    <Text className="mt-1">
                      {new Date(selectedEmail.processedAt).toLocaleString()}
                    </Text>
                  </div>
                )}
              </div>

              {/* Routing Info */}
              {selectedEmail.emailRule && (
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Routing Rule</Text>
                  <div className="mt-2 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Text className="text-sm">Type:</Text>
                        <Badge color="blue">{selectedEmail.emailRule.matchType}</Badge>
                      </div>
                      {selectedEmail.emailRule.matchValue && (
                        <div>
                          <Text className="text-sm">
                            Value: {selectedEmail.emailRule.matchValue}
                          </Text>
                        </div>
                      )}
                      <div>
                        <Text className="text-sm">
                          Inbox: {selectedEmail.emailRule.inbox.name}
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {selectedEmail.ticket && (
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Created Ticket</Text>
                  <div className="mt-2 rounded-lg bg-green-50 p-4 dark:bg-green-950/20">
                    <button
                      onClick={() => {
                        setShowDetailDialog(false)
                        navigate(`/admin/tickets/${selectedEmail.ticketId}`)
                      }}
                      className="text-green-700 hover:underline dark:text-green-400"
                    >
                      View Ticket: {selectedEmail.ticket.subject}
                    </button>
                  </div>
                </div>
              )}

              {selectedEmail.comment && (
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Added Comment</Text>
                  <div className="mt-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
                    <button
                      onClick={() => {
                        setShowDetailDialog(false)
                        navigate(`/admin/tickets/${selectedEmail.comment?.ticketId}`)
                      }}
                      className="text-blue-700 hover:underline dark:text-blue-400"
                    >
                      View Ticket with Comment
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {selectedEmail.processingError && (
                <div>
                  <Text className="text-sm font-medium text-zinc-500">Error</Text>
                  <div className="mt-2 rounded-lg bg-red-50 p-4 dark:bg-red-950/20">
                    <Text className="text-sm text-red-700 dark:text-red-400">
                      {selectedEmail.processingError}
                    </Text>
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div>
                <Text className="text-sm font-medium text-zinc-500">Email Body</Text>
                <div className="mt-2 max-h-96 overflow-y-auto rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                  <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {selectedEmail.textBody || selectedEmail.htmlBody || '(No content)'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </Dialog>
    </div>
  )
}
