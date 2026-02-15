import { useState, useRef } from 'react'
import { LockClosedIcon, GlobeAltIcon, PaperClipIcon, DocumentIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { Button } from '../ui/button'
import { SplitButton } from '../ui/split-button'
import { Badge } from '../ui/badge'
import { Avatar } from '../ui/avatar'
import { RichTextEditor, RichTextEditorRef } from '../ui/rich-text-editor'
import { renderMentions } from '../ui/mention-textarea'
import { FileUpload } from '../ui/file-upload'
import { EmailContent } from '../EmailContent'
import { formatTimeAgo } from '../../utils/time'

interface CommentAttachment {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
}

interface Comment {
  id: string
  content: string
  contentHtml?: string | null
  isInternal: boolean
  createdAt: string
  attachments?: CommentAttachment[]
  author: {
    id: string
    role: string
    user: {
      id: string
      name: string
    }
  }
}

interface MentionMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface TicketInfo {
  description: string
  descriptionHtml?: string | null
  firstName: string
  lastName: string
  email: string
  createdAt: string
  attachments?: {
    id: string
    fileName: string
    fileSize: number
    fileType: string
    fileUrl: string
    isInline?: boolean
  }[]
}

interface TicketCommentsProps {
  comments: Comment[]
  onAddComment: (content: string, contentHtml: string, isInternal: boolean, files?: File[], status?: string) => Promise<void>
  onImageUpload?: (file: File) => Promise<string | null>
  isStaff?: boolean
  isLoading?: boolean
  mentionableMembers?: MentionMember[]
  ticket?: TicketInfo
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// --- Thread Message ---

function ThreadMessage({
  senderName,
  senderEmail,
  senderRole,
  isInternal,
  isStaff,
  createdAt,
  contentHtml,
  contentText,
  attachments,
}: {
  senderName: string
  senderEmail?: string
  senderRole?: string
  isInternal: boolean
  isStaff: boolean
  createdAt: string
  contentHtml?: string | null
  contentText: string
  attachments?: CommentAttachment[]
}) {
  const initials = getInitials(senderName)
  const isClient = senderRole === 'client'
  const fullDate = new Date(createdAt).toLocaleString()

  return (
    <div
      className={`group relative ${
        isInternal
          ? 'border-l-2 border-amber-400 dark:border-amber-500 pl-4'
          : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          initials={initials}
          className={`size-9 ${
            isClient
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : isInternal
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
          }`}
        />
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {senderName}
            </span>
            {senderEmail && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate hidden sm:inline">
                &lt;{senderEmail}&gt;
              </span>
            )}
            {isStaff && isClient && (
              <Badge color="blue">Client</Badge>
            )}
            {isInternal && isStaff && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <LockClosedIcon className="w-3 h-3" />
                Internal
              </span>
            )}
            {/* Spacer + timestamp + actions */}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <span
                className="text-xs text-zinc-400 dark:text-zinc-500"
                title={fullDate}
              >
                {formatTimeAgo(createdAt)}
              </span>
              {/* Hover action buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  title="More"
                >
                  <EllipsisVerticalIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Message body */}
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {contentHtml ? (
              <EmailContent text={contentText} html={contentHtml} />
            ) : (
              <div className="whitespace-pre-wrap">
                {renderMentions(contentText)}
              </div>
            )}
          </div>

          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map(att => (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-sm"
                >
                  {att.fileType.startsWith('image/') ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="h-8 w-8 object-cover rounded"
                    />
                  ) : (
                    <DocumentIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[150px] text-zinc-700 dark:text-zinc-300">{att.fileName}</span>
                  <span className="text-zinc-400 text-xs shrink-0">{formatFileSize(att.fileSize)}</span>
                </a>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function TicketComments({ comments, onAddComment, onImageUpload, isStaff = true, isLoading, mentionableMembers = [], ticket }: TicketCommentsProps) {
  const editorRef = useRef<RichTextEditorRef>(null)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [showUpload, setShowUpload] = useState(false)

  const handleSubmitWithStatus = async (status?: string) => {
    const editor = editorRef.current
    if (!editor) return

    const text = editor.getText()
    const html = editor.getHTML()

    if (!text.trim() && !html.includes('<img') && files.length === 0) return

    setSubmitting(true)
    try {
      await onAddComment(text, html, isInternal, files.length > 0 ? files : undefined, status)
      editor.clear()
      setEditorEmpty(true)
      setIsInternal(false)
      setFiles([])
      setShowUpload(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter comments for non-staff (clients only see public comments)
  const visibleComments = isStaff ? comments : comments.filter(c => !c.isInternal)

  // Build the initial message from ticket description
  const fileAttachments = ticket?.attachments?.filter(a => !a.isInline) || []
  const hasInitialMessage = !!ticket

  return (
    <div className="flex flex-col">
      {/* Thread */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
        {/* Initial ticket message */}
        {hasInitialMessage && (
          <div className="pb-5">
            <ThreadMessage
              senderName={`${ticket.firstName} ${ticket.lastName}`.trim()}
              senderEmail={ticket.email}
              senderRole="client"
              isInternal={false}
              isStaff={isStaff}
              createdAt={ticket.createdAt}
              contentHtml={ticket.descriptionHtml}
              contentText={ticket.description}
              attachments={fileAttachments}
            />
          </div>
        )}

        {/* Comments */}
        {visibleComments.map((comment, index) => (
          <div key={comment.id} className="py-5">
            <ThreadMessage
              senderName={comment.author.user.name}
              senderRole={comment.author.role}
              isInternal={comment.isInternal}
              isStaff={isStaff}
              createdAt={comment.createdAt}
              contentHtml={comment.contentHtml}
              contentText={comment.content}
              attachments={comment.attachments}
            />
          </div>
        ))}

        {/* Empty state */}
        {!hasInitialMessage && visibleComments.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
            No messages yet
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-700">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitWithStatus(isStaff && !isInternal ? 'RESOLVED' : undefined) }} className="space-y-3">
          <RichTextEditor
            ref={editorRef}
            members={mentionableMembers}
            placeholder={isInternal ? 'Add an internal note... Use @ to mention someone' : 'Write a reply... Use @ to mention someone'}
            disabled={submitting || isLoading}
            onUpdate={setEditorEmpty}
            onImageUpload={onImageUpload}
          />

          {showUpload && (
            <FileUpload
              onFilesSelected={(newFiles) => setFiles(prev => [...prev, ...newFiles])}
              files={files}
              onRemoveFile={(index) => setFiles(prev => prev.filter((_, i) => i !== index))}
              multiple
              maxFiles={5}
              maxSizeMB={10}
              compact
              label="Attach files"
              description="Up to 5 files, 10MB each"
            />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isStaff && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {isInternal ? (
                      <>
                        <LockClosedIcon className="w-4 h-4" />
                        Internal note (staff only)
                      </>
                    ) : (
                      <>
                        <GlobeAltIcon className="w-4 h-4" />
                        Public message (client can see)
                      </>
                    )}
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <PaperClipIcon className="w-4 h-4" />
                {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Attach'}
              </button>
            </div>

            {isStaff && !isInternal ? (
              <SplitButton
                options={[
                  { label: 'Send & Resolve', value: 'RESOLVED' },
                  { label: 'Send as Waiting', value: 'WAITING_FOR_INFO' },
                  { label: 'Send as Review', value: 'REVIEW' },
                ]}
                defaultValue="RESOLVED"
                onAction={handleSubmitWithStatus}
                disabled={(editorEmpty && files.length === 0) || isLoading}
                loading={submitting}
                loadingLabel="Sending..."
              />
            ) : (
              <Button
                type="button"
                onClick={() => handleSubmitWithStatus(undefined)}
                disabled={(editorEmpty && files.length === 0) || submitting || isLoading}
              >
                {submitting ? 'Sending...' : (isStaff ? 'Add Internal Note' : 'Send')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
