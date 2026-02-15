import { useState, useRef } from 'react'
import { LockClosedIcon, GlobeAltIcon, PaperClipIcon, DocumentIcon } from '@heroicons/react/24/outline'
import DOMPurify from 'dompurify'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { RichTextEditor, RichTextEditorRef } from '../ui/rich-text-editor'
import { renderMentions } from '../ui/mention-textarea'
import { FileUpload } from '../ui/file-upload'

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

interface TicketCommentsProps {
  comments: Comment[]
  onAddComment: (content: string, contentHtml: string, isInternal: boolean, files?: File[]) => Promise<void>
  onImageUpload?: (file: File) => Promise<string | null>
  isStaff?: boolean
  isLoading?: boolean
  mentionableMembers?: MentionMember[]
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's',
    'ul', 'ol', 'li',
    'blockquote', 'a', 'img',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class', 'data-type', 'data-id'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data):)/i,
}

export function TicketComments({ comments, onAddComment, onImageUpload, isStaff = true, isLoading, mentionableMembers = [] }: TicketCommentsProps) {
  const editorRef = useRef<RichTextEditorRef>(null)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [showUpload, setShowUpload] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const editor = editorRef.current
    if (!editor) return

    const text = editor.getText()
    const html = editor.getHTML()

    if (!text.trim() && !html.includes('<img') && files.length === 0) return

    setSubmitting(true)
    try {
      await onAddComment(text, html, isInternal, files.length > 0 ? files : undefined)
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

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
        Comments ({visibleComments.length})
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {visibleComments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">
            No comments yet
          </p>
        ) : (
          visibleComments.map(comment => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg ${
                comment.isInternal
                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                  : 'bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {comment.author.user.name}
                  </span>
                  {isStaff && comment.author.role === 'client' && (
                    <Badge color="blue">Client</Badge>
                  )}
                  {comment.isInternal && isStaff && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <LockClosedIcon className="w-3 h-3" />
                      Internal
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                {comment.contentHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(comment.contentHtml, SANITIZE_CONFIG),
                    }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">
                    {renderMentions(comment.content)}
                  </div>
                )}
              </div>
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                  {comment.attachments.map(att => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {att.fileType.startsWith('image/') ? (
                        <img
                          src={att.fileUrl}
                          alt={att.fileName}
                          className="h-16 w-16 object-cover rounded border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <DocumentIcon className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">{att.fileName}</span>
                      <span className="text-zinc-400 shrink-0 text-xs">{formatFileSize(att.fileSize)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <RichTextEditor
          ref={editorRef}
          members={mentionableMembers}
          placeholder="Add a comment... Use @ to mention someone"
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

          <Button type="submit" disabled={(editorEmpty && files.length === 0) || submitting || isLoading}>
            {submitting ? 'Sending...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </div>
  )
}
