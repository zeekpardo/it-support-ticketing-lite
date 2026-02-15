import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin } from '@tiptap/pm/state'
import clsx from 'clsx'
import { LinkIcon, ListBulletIcon, PhotoIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { createMentionSuggestion, MentionMember } from './mention-suggestion'

export interface RichTextEditorRef {
  getHTML: () => string
  getText: () => string
  clear: () => void
  isEmpty: () => boolean
  setContent: (html: string) => void
}

interface RichTextEditorProps {
  members?: MentionMember[]
  placeholder?: string
  disabled?: boolean
  className?: string
  initialContent?: string
  onUpdate?: (isEmpty: boolean) => void
  onImageUpload?: (file: File) => Promise<string | null>
}

/**
 * Extract plain text with @[Name](memberId) format for mention nodes.
 * This matches the backend parseMentions() regex.
 */
function extractTextWithMentions(editor: Editor): string {
  const parts: string[] = []
  let lastWasBlock = false

  editor.state.doc.descendants((node, _pos, parent) => {
    if (node.type.name === 'mention') {
      parts.push(`@[${node.attrs.label}](${node.attrs.id})`)
      lastWasBlock = false
      return false
    }
    if (node.isText) {
      parts.push(node.text || '')
      lastWasBlock = false
      return false
    }
    if (node.isBlock && parent === editor.state.doc && parts.length > 0 && !lastWasBlock) {
      parts.push('\n')
      lastWasBlock = true
    }
    return true
  })

  return parts.join('').trim()
}

function ToolbarButton({
  active,
  onClick,
  disabled,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded text-sm transition-colors',
        active
          ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-white'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
}

function LinkPopover({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const savedSelection = useRef<{ from: number; to: number } | null>(null)

  useEffect(() => {
    // Save current selection and pre-fill if editing existing link
    const { from, to } = editor.state.selection
    savedSelection.current = { from, to }

    if (editor.isActive('link')) {
      setUrl(editor.getAttributes('link').href || '')
    }

    // Focus the input after mount
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [editor])

  const applyLink = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) {
      onClose()
      return
    }

    // Add protocol if missing
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

    const sel = savedSelection.current
    if (sel && sel.from !== sel.to) {
      // Has selection — apply link to selected text
      editor
        .chain()
        .focus()
        .setTextSelection(sel)
        .setLink({ href })
        .run()
    } else {
      // No selection — insert the URL as linked text
      const insertPos = sel ? sel.from : editor.state.selection.from
      editor
        .chain()
        .focus()
        .insertContent(trimmed)
        .setTextSelection({ from: insertPos, to: insertPos + trimmed.length })
        .setLink({ href })
        .run()
    }

    onClose()
  }, [url, editor, onClose])

  const removeLink = useCallback(() => {
    editor.chain().focus().unsetLink().run()
    onClose()
  }, [editor, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyLink()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      editor.chain().focus().run()
      onClose()
    }
  }

  return (
    <div className="absolute left-0 top-full mt-1 z-50 flex items-center gap-1.5 rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 p-1.5">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="https://example.com"
        className={clsx(
          'w-56 rounded-md px-2.5 py-1 text-sm',
          'bg-zinc-50 dark:bg-zinc-900',
          'border border-zinc-200 dark:border-zinc-700',
          'text-zinc-900 dark:text-white placeholder:text-zinc-400',
          'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
        )}
      />
      <button
        type="button"
        onClick={applyLink}
        className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        title="Apply link"
      >
        <CheckIcon className="w-4 h-4" />
      </button>
      {editor.isActive('link') && (
        <button
          type="button"
          onClick={removeLink}
          className="p-1 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          title="Remove link"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => { editor.chain().focus().run(); onClose() }}
        className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-200"
        title="Cancel (Esc)"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function Toolbar({ editor, onImageUpload }: { editor: Editor; onImageUpload?: (file: File) => Promise<string | null> }) {
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLinkToggle = () => {
    if (showLinkPopover) {
      setShowLinkPopover(false)
      editor.chain().focus().run()
      return
    }
    setShowLinkPopover(true)
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onImageUpload) return

    // Reset input so re-selecting same file triggers change
    e.target.value = ''

    const src = await onImageUpload(file)
    if (src) {
      editor.chain().focus().setImage({ src }).run()
    }
  }

  return (
    <div className="relative flex items-center gap-0.5 px-3 py-1.5 border-b border-zinc-950/10 dark:border-white/10">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
      >
        <span className="font-bold text-xs w-4 text-center">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
      >
        <span className="italic text-xs w-4 text-center">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Cmd+U)"
      >
        <span className="underline text-xs w-4 text-center">U</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <span className="line-through text-xs w-4 text-center">S</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <ListBulletIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12" />
          <text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text>
          <text x="3" y="19" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2</text>
        </svg>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('link') || showLinkPopover}
        onClick={handleLinkToggle}
        title="Link"
      >
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>
      {onImageUpload && (
        <>
          <ToolbarButton
            onClick={handleImageClick}
            title="Insert image"
          >
            <PhotoIcon className="w-4 h-4" />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
        </>
      )}

      {showLinkPopover && (
        <LinkPopover
          editor={editor}
          onClose={() => setShowLinkPopover(false)}
        />
      )}
    </div>
  )
}

/**
 * Create a ProseMirror plugin that handles image paste and drop events.
 */
function createImageUploadPlugin(onImageUpload: (file: File) => Promise<string | null>) {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false

            onImageUpload(file).then((src) => {
              if (src) {
                const node = view.state.schema.nodes.image.create({ src })
                const tr = view.state.tr.replaceSelectionWith(node)
                view.dispatch(tr)
              }
            })
            return true
          }
        }
        return false
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false

        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (!imageFile) return false

        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })

        onImageUpload(imageFile).then((src) => {
          if (src) {
            const node = view.state.schema.nodes.image.create({ src })
            const tr = view.state.tr.insert(pos?.pos ?? view.state.doc.content.size, node)
            view.dispatch(tr)
          }
        })
        return true
      },
    },
  })
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ members = [], placeholder, disabled, className, initialContent, onUpdate, onImageUpload }, ref) => {
    const mentionSuggestion = useMemo(
      () => createMentionSuggestion(members),
      [members],
    )

    // Stable ref for the upload callback so the plugin doesn't recreate
    const uploadRef = useRef(onImageUpload)
    uploadRef.current = onImageUpload

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          horizontalRule: false,
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
        }),
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
        Mention.configure({
          HTMLAttributes: { class: 'mention' },
          suggestion: mentionSuggestion,
          renderHTML({ node }) {
            return [
              'span',
              {
                class: 'mention',
                'data-type': 'mention',
                'data-id': node.attrs.id,
              },
              `@${node.attrs.label}`,
            ]
          },
        }),
        Placeholder.configure({
          placeholder: placeholder || 'Add a comment... Use @ to mention someone',
        }),
        Extension.create({
          name: 'imageUpload',
          addProseMirrorPlugins() {
            return [
              createImageUploadPlugin((file) => {
                return uploadRef.current?.(file) ?? Promise.resolve(null)
              }),
            ]
          },
        }),
      ],
      ...(initialContent ? { content: initialContent } : {}),
      editable: !disabled,
      onUpdate: ({ editor: e }) => {
        onUpdate?.(e.isEmpty)
      },
    })

    // Sync editable state — useEditor doesn't react to editable changes
    useEffect(() => {
      if (editor && editor.isEditable !== !disabled) {
        editor.setEditable(!disabled)
      }
    }, [editor, disabled])

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() || '',
      getText: () => (editor ? extractTextWithMentions(editor) : ''),
      clear: () => editor?.commands.clearContent(),
      isEmpty: () => editor?.isEmpty ?? true,
      setContent: (html: string) => editor?.commands.setContent(html),
    }))

    if (!editor) {
      return null
    }

    return (
      <div className={clsx('relative', className)}>
        <span
          data-slot="control"
          className={clsx([
            'relative block w-full',
            'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
            'dark:before:hidden',
            'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
            disabled && 'opacity-50 before:bg-zinc-950/5 before:shadow-none',
          ])}
        >
          <div
            className={clsx([
              'relative block w-full rounded-lg overflow-hidden',
              'border border-zinc-950/10 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20',
              'bg-transparent dark:bg-white/5',
            ])}
          >
            <Toolbar editor={editor} onImageUpload={onImageUpload} />
            <EditorContent
              editor={editor}
              className={clsx([
                'px-[calc(var(--spacing)*3.5-1px)] py-[calc(var(--spacing)*2.5-1px)] sm:px-[calc(var(--spacing)*3-1px)] sm:py-[calc(var(--spacing)*1.5-1px)]',
                'text-base/6 sm:text-sm/6 text-zinc-950 dark:text-white',
                '[&_.tiptap]:outline-none [&_.tiptap]:min-h-[4.5rem]',
                '[&_.tiptap]:prose [&_.tiptap]:prose-sm [&_.tiptap]:dark:prose-invert [&_.tiptap]:max-w-none',
                '[&_.tiptap_p]:my-1 [&_.tiptap_ul]:my-1 [&_.tiptap_ol]:my-1 [&_.tiptap_blockquote]:my-1',
                '[&_.tiptap_img]:max-w-full [&_.tiptap_img]:h-auto [&_.tiptap_img]:rounded-lg [&_.tiptap_img]:my-2',
              ])}
            />
          </div>
        </span>
      </div>
    )
  },
)
RichTextEditor.displayName = 'RichTextEditor'
