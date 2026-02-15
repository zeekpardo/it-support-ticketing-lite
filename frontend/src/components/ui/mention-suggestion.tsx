import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import clsx from 'clsx'

export interface MentionMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface MentionListProps {
  items: MentionMember[]
  command: (item: { id: string; label: string }) => void
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case 'admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'manager': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    case 'member': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
    case 'client': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
  }
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command({ id: item.id, label: item.user.name })
        }
      },
      [items, command],
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 p-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            No members found
          </p>
        </div>
      )
    }

    return (
      <div className="max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={clsx(
              'w-full px-3 py-2 text-left flex items-center justify-between gap-2',
              index === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50',
            )}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {item.user.name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {item.user.email}
              </span>
            </div>
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full capitalize shrink-0',
                getRoleBadgeColor(item.role),
              )}
            >
              {item.role}
            </span>
          </button>
        ))}
      </div>
    )
  },
)
MentionList.displayName = 'MentionList'

export function createMentionSuggestion(
  members: MentionMember[],
): Omit<SuggestionOptions<MentionMember>, 'editor'> {
  return {
    items: ({ query }) => {
      return members
        .filter(
          (member) =>
            member.user.name.toLowerCase().includes(query.toLowerCase()) ||
            member.user.email.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8)
    },
    render: () => {
      let component: ReactRenderer<MentionListRef>
      let popup: HTMLDivElement | null = null

      return {
        onStart: (props: SuggestionProps<MentionMember>) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          })

          popup = document.createElement('div')
          popup.style.position = 'absolute'
          popup.style.zIndex = '50'
          popup.style.width = '320px'
          popup.appendChild(component.element)

          const rect = props.clientRect?.()
          if (rect && popup) {
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`
            popup.style.left = `${rect.left + window.scrollX}px`
          }

          document.body.appendChild(popup)
        },
        onUpdate: (props: SuggestionProps<MentionMember>) => {
          component.updateProps(props)

          const rect = props.clientRect?.()
          if (rect && popup) {
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`
            popup.style.left = `${rect.left + window.scrollX}px`
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.remove()
            popup = null
            return true
          }
          return component.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          popup?.remove()
          popup = null
          component.destroy()
        },
      }
    },
  }
}
