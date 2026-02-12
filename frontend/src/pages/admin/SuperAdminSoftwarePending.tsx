import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, GlobalSoftware } from '../../api/client'
import { Heading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export default function SuperAdminSoftwarePending() {
  const navigate = useNavigate()
  const [software, setSoftware] = useState<GlobalSoftware[]>([])
  const [loading, setLoading] = useState(true)

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSoftware, setSelectedSoftware] = useState<GlobalSoftware | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadPending()
  }, [])

  const loadPending = async () => {
    setLoading(true)
    try {
      const result = await api.getSuperAdminPendingSoftware()
      setSoftware(result)
    } catch (error) {
      console.error('Failed to load pending software:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDetailModal = (item: GlobalSoftware) => {
    setSelectedSoftware(item)
    setShowDetailModal(true)
  }

  const handleApprove = async (id: string) => {
    setProcessing(true)
    try {
      await api.approveSoftware(id)
      setShowDetailModal(false)
      loadPending()
    } catch (error) {
      console.error('Failed to approve software:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id: string) => {
    setProcessing(true)
    try {
      await api.rejectSoftware(id)
      setShowDetailModal(false)
      loadPending()
    } catch (error) {
      console.error('Failed to reject software:', error)
    } finally {
      setProcessing(false)
    }
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
      <div className="flex items-center gap-4">
        <Button plain onClick={() => navigate('/super-admin/software')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <Heading>Pending Software Submissions</Heading>
          <Text className="mt-1">Review and approve software submitted by organizations</Text>
        </div>
      </div>

      {software.length === 0 ? (
        <div className="text-center py-12">
          <Text className="text-zinc-500">No pending submissions</Text>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Software</TableHeader>
                <TableHeader>Vendor</TableHeader>
                <TableHeader>Category</TableHeader>
                <TableHeader>Submitted By</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader className="w-[150px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {software.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50" onClick={() => openDetailModal(item)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.iconUrl ? (
                        <img
                          src={item.iconUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-700" />
                      )}
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-zinc-500 truncate max-w-xs">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-500">{item.vendor || '-'}</TableCell>
                  <TableCell>
                    {item.category ? (
                      <Badge color="zinc">{item.category.name}</Badge>
                    ) : (
                      <span className="text-zinc-400">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {item.submitter?.name || item.submitter?.email || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        color="green"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleApprove(item.id)}
                      >
                        <CheckIcon className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        color="red"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleReject(item.id)}
                      >
                        <XMarkIcon className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSoftware && (
        <Dialog open={true} onClose={() => setShowDetailModal(false)} size="lg">
          <DialogTitle>Review Submission</DialogTitle>
          <DialogDescription>
            Review the details before approving or rejecting
          </DialogDescription>

          <DialogBody>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedSoftware.iconUrl ? (
                  <img
                    src={selectedSoftware.iconUrl}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-zinc-100 dark:bg-zinc-700" />
                )}
                <div>
                  <h3 className="text-lg font-semibold">{selectedSoftware.name}</h3>
                  {selectedSoftware.vendor && (
                    <p className="text-zinc-500">{selectedSoftware.vendor}</p>
                  )}
                </div>
              </div>

              {selectedSoftware.description && (
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{selectedSoftware.description}</p>
                </div>
              )}

              {selectedSoftware.websiteUrl && (
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Website</label>
                  <p className="mt-1">
                    <a
                      href={selectedSoftware.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {selectedSoftware.websiteUrl}
                    </a>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {selectedSoftware.category?.name || 'Uncategorized'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Submitted By</label>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {selectedSoftware.submitter?.name || selectedSoftware.submitter?.email || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogActions>
            <Button plain onClick={() => setShowDetailModal(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => handleReject(selectedSoftware.id)}
              disabled={processing}
            >
              Reject
            </Button>
            <Button
              color="green"
              onClick={() => handleApprove(selectedSoftware.id)}
              disabled={processing}
            >
              Approve
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  )
}
