import { forwardRef } from 'react'
import { EditorContent } from '@tiptap/react'
import clsx from 'clsx'
import { EditorToolbar } from './editor/EditorToolbar'
import { useRichTextEditor } from '../../hooks/useRichTextEditor'
import type { MentionMember } from './editor/MentionExtension'

export type { RichTextEditorRef } from '../../hooks/useRichTextEditor'

interface RichTextEditorProps {
  members?: MentionMember[]
  placeholder?: string
  disabled?: boolean
  className?: string
  initialContent?: string
  onUpdate?: (isEmpty: boolean) => void
  onImageUpload?: (file: File) => Promise<string | null>
}

export const RichTextEditor = forwardRef<
  import('../../hooks/useRichTextEditor').RichTextEditorRef,
  RichTextEditorProps
>(({ className, disabled, onImageUpload, ...rest }, ref) => {
  const { editor } = useRichTextEditor({ ...rest, disabled, onImageUpload, ref })

  if (!editor) return null

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
          <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
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
})
RichTextEditor.displayName = 'RichTextEditor'
