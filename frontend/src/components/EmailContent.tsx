import DOMPurify from 'dompurify'

interface EmailContentProps {
  text: string
  html?: string | null
}

export function EmailContent({ text, html }: EmailContentProps) {
  if (!html) {
    return (
      <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {text}
      </p>
    )
  }

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'width', 'height', 'target', 'rel', 'class', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|data):)/i,
  })

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none
                 prose-img:rounded-lg prose-img:max-h-96 prose-img:w-auto
                 prose-a:text-blue-600 dark:prose-a:text-blue-400"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
