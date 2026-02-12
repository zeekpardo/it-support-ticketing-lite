import { useState, useRef, useEffect, useCallback } from 'react'
import clsx from 'clsx'

interface MentionMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  members: MentionMember[]
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
}

export function MentionTextarea({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  disabled,
  className
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const filteredMembers = members.filter(member =>
    member.user.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    member.user.email.toLowerCase().includes(mentionSearch.toLowerCase())
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    onChange(newValue)

    // Check if we should show mention suggestions
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
      if (charBefore === ' ' || charBefore === '\n' || atIndex === 0) {
        const searchText = textBeforeCursor.slice(atIndex + 1)
        // Only show if no spaces in search (still typing the mention)
        if (!searchText.includes(' ')) {
          setMentionStart(atIndex)
          setMentionSearch(searchText)
          setShowSuggestions(true)
          setSuggestionIndex(0)
          return
        }
      }
    }

    setShowSuggestions(false)
    setMentionStart(null)
    setMentionSearch('')
  }

  const insertMention = useCallback((member: MentionMember) => {
    if (mentionStart === null || !textareaRef.current) return

    const cursorPos = textareaRef.current.selectionStart
    const beforeMention = value.slice(0, mentionStart)
    const afterMention = value.slice(cursorPos)
    const mentionText = `@${member.user.name} `

    const newValue = beforeMention + mentionText + afterMention
    onChange(newValue)

    setShowSuggestions(false)
    setMentionStart(null)
    setMentionSearch('')

    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + mentionText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [mentionStart, value, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredMembers.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIndex(prev => (prev + 1) % filteredMembers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(filteredMembers[suggestionIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      case 'admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'manager': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      case 'member': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
      case 'client': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
    }
  }

  return (
    <div className="relative">
      <span
        data-slot="control"
        className={clsx([
          className,
          'relative block w-full',
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
          'dark:before:hidden',
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
          disabled && 'opacity-50 before:bg-zinc-950/5 before:shadow-none',
        ])}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={clsx([
            'relative block h-full w-full appearance-none rounded-lg px-[calc(var(--spacing)*3.5-1px)] py-[calc(var(--spacing)*2.5-1px)] sm:px-[calc(var(--spacing)*3-1px)] sm:py-[calc(var(--spacing)*1.5-1px)]',
            'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
            'border border-zinc-950/10 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20',
            'bg-transparent dark:bg-white/5',
            'focus:outline-none',
            'disabled:border-zinc-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/[.025]',
            'resize-none',
          ])}
        />
      </span>

      {showSuggestions && filteredMembers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10"
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onClick={() => insertMention(member)}
              className={clsx(
                'w-full px-3 py-2 text-left flex items-center justify-between gap-2',
                index === suggestionIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
              )}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {member.user.name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {member.user.email}
                </span>
              </div>
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-full capitalize shrink-0',
                getRoleBadgeColor(member.role)
              )}>
                {member.role}
              </span>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && filteredMembers.length === 0 && mentionSearch && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 p-3"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            No members found matching "{mentionSearch}"
          </p>
        </div>
      )}
    </div>
  )
}

// Helper function to render comment content with highlighted mentions
export function renderMentions(content: string, className?: string) {
  const mentionRegex = /@([A-Za-z\s]+?)(?=\s|$|@)/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    // Add the mention as a highlighted span
    parts.push(
      <span
        key={match.index}
        className="text-blue-600 dark:text-blue-400 font-medium"
      >
        @{match[1]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return <span className={className}>{parts}</span>
}
