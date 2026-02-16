import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { emailRulesApi, EmailRule, CreateEmailRuleData } from '../../api/emailRules'
import { useModalForm } from '../../hooks/useModalForm'
import { getMatchTypeBadge, getMatchTypeDescription } from '../inbox/emailRuleHelpers'
import { Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { TrashIcon, PlusIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

interface InboxEmailRulesTabProps {
  inboxId: string
}

export function InboxEmailRulesTab({ inboxId }: InboxEmailRulesTabProps) {
  const navigate = useNavigate()
  const [emailRules, setEmailRules] = useState<EmailRule[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<EmailRule | null>(null)

  const createRuleModal = useModalForm({
    initialData: {
      matchType: 'EXACT_ADDRESS' as 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL',
      matchValue: '',
      priority: 0,
    },
  })

  const loadEmailRules = useCallback(async () => {
    try {
      const rules = await emailRulesApi.getEmailRules({ inboxId })
      setEmailRules(rules)
    } catch (error) {
      console.error('Failed to load email rules:', error)
    }
  }, [inboxId])

  useEffect(() => {
    loadEmailRules()
  }, [loadEmailRules])

  const handleCreateRule = async () => {
    try {
      await createRuleModal.handleSubmit(async () => {
        const data: CreateEmailRuleData = {
          inboxId,
          matchType: createRuleModal.formData.matchType,
          priority: createRuleModal.formData.priority || 0,
        }
        if (createRuleModal.formData.matchType !== 'CATCH_ALL') {
          data.matchValue = createRuleModal.formData.matchValue
        }
        await emailRulesApi.createEmailRule(data)
        createRuleModal.close()
        loadEmailRules()
      })
    } catch (error: any) {
      alert(error.message || 'Failed to create email rule')
    }
  }

  const handleDeleteRule = async () => {
    if (!selectedRule) return
    try {
      await emailRulesApi.deleteEmailRule(selectedRule.id)
      setShowDeleteDialog(false)
      setSelectedRule(null)
      loadEmailRules()
    } catch (error: any) {
      alert(error.message || 'Failed to delete email rule')
    }
  }

  const handleToggleRuleActive = async (rule: EmailRule) => {
    try {
      await emailRulesApi.updateEmailRule(rule.id, { isActive: !rule.isActive })
      loadEmailRules()
    } catch (error: any) {
      alert(error.message || 'Failed to update email rule')
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Subheading>Email Routing Rules</Subheading>
            <Text className="mt-1 text-zinc-500">
              Rules that route incoming emails to this inbox.
            </Text>
          </div>
          <div className="flex gap-2">
            <Button plain onClick={() => navigate('/admin/email-rules')}>
              All Rules
            </Button>
            <Button color="blue" onClick={() => createRuleModal.open()}>
              <PlusIcon className="h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </div>

        {emailRules.length === 0 ? (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-8 text-center">
            <EnvelopeIcon className="mx-auto h-10 w-10 text-zinc-400" />
            <Text className="mt-3 font-medium">No email rules for this inbox</Text>
            <Text className="mt-1 text-zinc-500">
              Create a rule to route incoming emails to this inbox as tickets.
            </Text>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {emailRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {getMatchTypeBadge(rule.matchType)}
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {rule.matchValue || 'Any email'}
                  </span>
                  {!rule.isActive && <Badge color="zinc">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    Priority {rule.priority}
                  </span>
                  <Button
                    plain
                    onClick={() => handleToggleRuleActive(rule)}
                  >
                    <span className="text-sm text-zinc-500 hover:text-blue-600">
                      {rule.isActive ? 'Deactivate' : 'Activate'}
                    </span>
                  </Button>
                  <Button
                    plain
                    onClick={() => {
                      setSelectedRule(rule)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <TrashIcon className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={createRuleModal.isOpen} onClose={createRuleModal.close}>
        <DialogTitle>Create Email Routing Rule</DialogTitle>
        <DialogDescription>
          Route matching emails to this inbox as tickets.
        </DialogDescription>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Match Type</Label>
              <Select
                value={createRuleModal.formData.matchType}
                onChange={(e) =>
                  createRuleModal.setField('matchType', e.target.value as 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL')
                }
              >
                <option value="EXACT_ADDRESS">Exact Address</option>
                <option value="DOMAIN">Domain</option>
                <option value="CATCH_ALL">Catch-All</option>
              </Select>
              <Text className="mt-1 text-sm text-zinc-500">
                {getMatchTypeDescription(createRuleModal.formData.matchType)}
              </Text>
            </Field>

            {createRuleModal.formData.matchType !== 'CATCH_ALL' && (
              <Field>
                <Label>
                  {createRuleModal.formData.matchType === 'EXACT_ADDRESS' ? 'Email Address' : 'Domain'}
                </Label>
                <Input
                  type="text"
                  value={createRuleModal.formData.matchValue}
                  onChange={(e) => createRuleModal.setField('matchValue', e.target.value)}
                  placeholder={
                    createRuleModal.formData.matchType === 'EXACT_ADDRESS'
                      ? 'support@groovi.support'
                      : '@clientdomain.com'
                  }
                />
              </Field>
            )}

            <Field>
              <Label>Priority (higher = evaluated first)</Label>
              <Input
                type="number"
                value={createRuleModal.formData.priority}
                onChange={(e) =>
                  createRuleModal.setField('priority', parseInt(e.target.value) || 0)
                }
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={createRuleModal.close}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleCreateRule} disabled={createRuleModal.saving}>
            {createRuleModal.saving ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Rule Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Email Rule</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this email rule? This action cannot be undone.
        </DialogDescription>
        <DialogBody>
          {selectedRule && (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 space-y-1">
              <div className="flex items-center gap-2">
                {getMatchTypeBadge(selectedRule.matchType)}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedRule.matchValue || 'Any email'}
                </span>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteRule}>
            Delete Rule
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
