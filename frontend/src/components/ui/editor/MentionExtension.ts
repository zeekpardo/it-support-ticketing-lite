import Mention from '@tiptap/extension-mention'
import { Editor } from '@tiptap/react'
import { createMentionSuggestion, type MentionMember } from '../mention-suggestion'

export type { MentionMember }

/**
 * Create a configured TipTap Mention extension with suggestion dropdown.
 */
export function createMentionExtension(members: MentionMember[]) {
  const suggestion = createMentionSuggestion(members)

  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    suggestion,
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
  })
}

/**
 * Extract plain text with @[Name](memberId) format for mention nodes.
 * This matches the backend parseMentions() regex.
 */
export function extractTextWithMentions(editor: Editor): string {
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
