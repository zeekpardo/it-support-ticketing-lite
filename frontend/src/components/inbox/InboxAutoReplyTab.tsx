import { useEffect, useRef } from 'react'
import { useInboxForm } from '../../hooks/useInboxForm'
import { api } from '../../api/client'
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor'
import { Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Switch } from '@/components/ui/switch'
import { Field, Label, Description } from '@/components/ui/fieldset'

interface InboxAutoReplyTabProps {
  inboxForm: ReturnType<typeof useInboxForm>
  inboxId: string
}

export function InboxAutoReplyTab({ inboxForm, inboxId }: InboxAutoReplyTabProps) {
  const { form, setField, saving } = inboxForm
  const editorRef = useRef<RichTextEditorRef>(null)

  useEffect(() => {
    if (form.autoReplyHtml) {
      const t = setTimeout(() => {
        editorRef.current?.setContent(form.autoReplyHtml)
      }, 50)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const html = editorRef.current?.getHTML() || ''
    const isEmpty = editorRef.current?.isEmpty()

    setField('autoReplyHtml', isEmpty ? '' : html)
    inboxForm.setSaving(true)

    try {
      await api.updateInbox(inboxId, {
        autoReplyEnabled: form.autoReplyEnabled,
        autoReplyHtml: isEmpty ? null : html,
      })
      setField('autoReplyHtml', isEmpty ? '' : html)
    } catch (error) {
      console.error('Failed to save auto-reply:', error)
    } finally {
      inboxForm.setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-5">
      <div>
        <Subheading>Email Auto-Reply</Subheading>
        <Text className="mt-1 text-zinc-500">
          Automatically send a reply when a ticket is created from an inbound email.
        </Text>
      </div>

      <Field>
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Auto-Reply</Label>
            <Description>When enabled, clients will receive this message after emailing in</Description>
          </div>
          <Switch
            checked={form.autoReplyEnabled}
            onChange={(val) => setField('autoReplyEnabled', val)}
            color="blue"
          />
        </div>
      </Field>

      <div>
        <p className="text-sm font-medium text-zinc-950 dark:text-white mb-2">Message</p>
        <RichTextEditor
          ref={editorRef}
          placeholder="Compose your auto-reply message..."
          disabled={!form.autoReplyEnabled}
          initialContent={form.autoReplyHtml}
        />
      </div>

      <div className="flex justify-end">
        <Button
          color="blue"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Auto-Reply'}
        </Button>
      </div>
    </div>
  )
}
