import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor } from '@tiptap/react'
import clsx from 'clsx'
import { LinkIcon, ListBulletIcon, PhotoIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

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

export function EditorToolbar({ editor, onImageUpload }: { editor: Editor; onImageUpload?: (file: File) => Promise<string | null> }) {
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
