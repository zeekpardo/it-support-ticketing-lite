import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { useTimer } from '../context/TimerContext'
import { api } from '../api/client'

export interface Ticket {
  id: string
  subject: string
  description: string
  descriptionHtml?: string | null
  firstName: string
  lastName: string
  email: string
  phone?: string
  requestType: string
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  screenRecordingLink?: string
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    projectCode: string
  }
  client: {
    id: string
    user: { id: string; name: string; email: string }
  }
  owner?: {
    id: string
    user: { id: string; name: string; email: string }
  } | null
  comments: any[]
  attachments: {
    id: string
    fileName: string
    fileSize: number
    fileType: string
    fileUrl: string
    isInline?: boolean
    createdAt: string
  }[]
  timeEntries: any[]
  totalTimeMinutes: number
}

export interface StaffMember {
  id: string
  user: { id: string; name: string; email: string }
}

export interface MentionableMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export function useTicketDetail(ticketId: string | undefined, projectId: string | undefined) {
  const navigate = useNavigate()
  const { currentOrg, isAdmin, isStaff } = useOrganization()
  const { runningTimer, startTimer } = useTimer()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [mentionableMembers, setMentionableMembers] = useState<MentionableMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketData, staffData, mentionableData] = await Promise.all([
        api.getTicket(ticketId!),
        api.getStaffMembers(),
        api.getTicketMentionableMembers(ticketId!)
      ])
      setTicket(ticketData)
      setStaffMembers(staffData)
      setMentionableMembers(mentionableData)
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentOrg && ticketId) {
      loadData()
    }
  }, [currentOrg, ticketId])

  // Keep a ref to the latest runningTimer for cleanup functions
  const runningTimerRef = useRef(runningTimer)
  useEffect(() => {
    runningTimerRef.current = runningTimer
  }, [runningTimer])

  // Auto-start/stop timer based on ticket navigation (staff only)
  const hasAutoStarted = useRef(false)
  useEffect(() => {
    if (!isStaff || !ticket) return

    // Don't auto-start if already running on this ticket
    if (runningTimer?.ticketId === ticket.id) {
      hasAutoStarted.current = true
      return
    }

    // Auto-start (backend auto-stops any other running timer)
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true
      startTimer(ticket.id)
        .then(() => loadData())
        .catch(err => console.error('Auto-start timer failed:', err))
    }

    return () => {
      hasAutoStarted.current = false
    }
  }, [ticket?.id, isStaff])

  // Auto-stop when leaving the page or switching tickets
  // Uses api.stopTimer directly to avoid stale closures from useTimer's stopTimer
  useEffect(() => {
    return () => {
      const timer = runningTimerRef.current
      if (isStaff && timer && timer.ticketId === ticketId) {
        api.stopTimer(timer.id).catch(err => console.error('Auto-stop timer failed:', err))
      }
    }
  }, [ticketId, isStaff])

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicketStatus(ticket.id, newStatus)
      setTicket({ ...ticket, status: newStatus as Ticket['status'] })
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (ownerId: string | null) => {
    if (!ticket) return
    setSaving(true)
    try {
      const updated = await api.assignTicket(ticket.id, ownerId)
      setTicket({ ...ticket, owner: updated.owner })
    } catch (error) {
      console.error('Failed to assign ticket:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePriorityChange = async (priority: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicket(ticket.id, { priorityLevel: priority })
      setTicket({ ...ticket, priorityLevel: priority as Ticket['priorityLevel'] })
    } catch (error) {
      console.error('Failed to update priority:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDueDateChange = async (dueDate: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicket(ticket.id, { dueDate: dueDate || null })
      setTicket({ ...ticket, dueDate: dueDate || null })
    } catch (error) {
      console.error('Failed to update due date:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ticket || !confirm('Are you sure you want to delete this ticket?')) return
    try {
      await api.deleteTicket(ticket.id)
      navigate(`/projects/${projectId}/tickets`)
    } catch (error) {
      console.error('Failed to delete ticket:', error)
    }
  }

  // Inline image upload for comments
  const inlineImageMap = useRef<Map<string, string>>(new Map())

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!ticket) return null
    try {
      const { key } = await api.uploadInlineImage(ticket.id, file)
      const blobUrl = URL.createObjectURL(file)
      inlineImageMap.current.set(blobUrl, `s3:${key}`)
      return blobUrl
    } catch (error) {
      console.error('Failed to upload image:', error)
      return null
    }
  }, [ticket?.id])

  const handleAddComment = async (content: string, contentHtml: string, isInternal: boolean, files?: File[]) => {
    if (!ticket) return
    try {
      // Replace blob URLs with s3: references before submitting
      let resolvedHtml = contentHtml
      for (const [blobUrl, s3Key] of inlineImageMap.current.entries()) {
        resolvedHtml = resolvedHtml.split(blobUrl).join(s3Key)
        URL.revokeObjectURL(blobUrl)
      }
      inlineImageMap.current.clear()

      const comment = await api.addTicketComment(ticket.id, { content, contentHtml: resolvedHtml, isInternal, files })
      setTicket({ ...ticket, comments: [...ticket.comments, comment] })
    } catch (error) {
      console.error('Failed to add comment:', error)
      throw error
    }
  }

  // Inline editing for client name
  const [editingName, setEditingName] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const firstNameRef = useRef<HTMLInputElement>(null)

  const startEditingName = () => {
    if (!ticket) return
    setEditFirstName(ticket.firstName)
    setEditLastName(ticket.lastName)
    setEditingName(true)
    setTimeout(() => firstNameRef.current?.focus(), 0)
  }

  const cancelEditingName = () => {
    setEditingName(false)
  }

  const saveClientName = async () => {
    if (!ticket) return
    const firstName = editFirstName.trim()
    const lastName = editLastName.trim()
    if (!firstName) return
    if (firstName === ticket.firstName && lastName === ticket.lastName) {
      setEditingName(false)
      return
    }
    setSaving(true)
    try {
      await api.updateTicket(ticket.id, { firstName, lastName })
      setTicket({ ...ticket, firstName, lastName })
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
      saveClientName()
    } else if (e.key === 'Escape') {
      cancelEditingName()
    }
  }

  return {
    ticket,
    staffMembers,
    mentionableMembers,
    loading,
    saving,
    isAdmin,
    isStaff,
    currentOrg,
    loadData,
    handleStatusChange,
    handleAssign,
    handlePriorityChange,
    handleDueDateChange,
    handleDelete,
    handleImageUpload,
    handleAddComment,
    // Inline name editing
    editingName,
    editFirstName,
    editLastName,
    firstNameRef,
    setEditFirstName,
    setEditLastName,
    startEditingName,
    cancelEditingName,
    saveClientName,
    handleNameKeyDown,
  }
}
