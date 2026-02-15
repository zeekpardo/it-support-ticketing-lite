import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react'
import { useEditor, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin } from '@tiptap/pm/state'
import { createMentionExtension, extractTextWithMentions, type MentionMember } from '../components/ui/editor/MentionExtension'

export interface RichTextEditorRef {
  getHTML: () => string
  getText: () => string
  clear: () => void
  isEmpty: () => boolean
  setContent: (html: string) => void
}

interface UseRichTextEditorOptions {
  members?: MentionMember[]
  placeholder?: string
  disabled?: boolean
  initialContent?: string
  onUpdate?: (isEmpty: boolean) => void
  onImageUpload?: (file: File) => Promise<string | null>
  ref: Ref<RichTextEditorRef>
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

export function useRichTextEditor({
  members = [],
  placeholder,
  disabled,
  initialContent,
  onUpdate,
  onImageUpload,
  ref,
}: UseRichTextEditorOptions) {
  const mentionExtension = useMemo(
    () => createMentionExtension(members),
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
      mentionExtension,
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

  return { editor }
}
