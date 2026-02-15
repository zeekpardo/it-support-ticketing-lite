import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { emailRulesApi, EmailRule, CreateEmailRuleData } from '../../api/emailRules'
import { useProjectForm } from '../../hooks/useProjectForm'
import { useStageManager } from '../../hooks/useStageManager'
import StageManager from '../../components/StageManager'
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, FieldGroup, Label, Description } from '@/components/ui/fieldset'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeftIcon, TrashIcon, PlusIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'email-rules', label: 'Email Rules' },
  { id: 'auto-reply', label: 'Auto-Reply' },
  { id: 'stages', label: 'Stages' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('general')

  // Email rules state
  const [emailRules, setEmailRules] = useState<EmailRule[]>([])
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false)
  const [showDeleteRuleDialog, setShowDeleteRuleDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<EmailRule | null>(null)
  const [ruleFormData, setRuleFormData] = useState<CreateEmailRuleData>({
    projectId: id || '',
    matchType: 'EXACT_ADDRESS',
    matchValue: '',
    priority: 0,
  })

  const projectForm = useProjectForm(id)
  const stageManager = useStageManager(id)
  const autoReplyEditorRef = useRef<RichTextEditorRef>(null)

  useEffect(() => {
    if (currentOrg && id) {
      loadData()
    }
  }, [currentOrg, id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectData, staffData] = await Promise.all([
        api.getProject(id!),
        api.getStaffMembers(),
      ])
      projectForm.populateFromProject(projectData)
      setStaffMembers(staffData)
      await stageManager.loadStages()
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load auto-reply HTML into editor when switching to that tab or when data loads
  useEffect(() => {
    if (activeTab === 'auto-reply' && projectForm.form.autoReplyHtml) {
      // Small delay to ensure editor is mounted
      const t = setTimeout(() => {
        autoReplyEditorRef.current?.setContent(projectForm.form.autoReplyHtml)
      }, 50)
      return () => clearTimeout(t)
    }
  }, [activeTab, loading])

  // Email rules handlers
  const loadEmailRules = useCallback(async () => {
    if (!id) return
    try {
      const rules = await emailRulesApi.getEmailRules({ projectId: id })
      setEmailRules(rules)
    } catch (error) {
      console.error('Failed to load email rules:', error)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'email-rules' && id) {
      loadEmailRules()
    }
  }, [activeTab, id, loadEmailRules])

  const handleCreateRule = async () => {
    try {
      await emailRulesApi.createEmailRule({ ...ruleFormData, projectId: id! })
      setShowCreateRuleDialog(false)
      setRuleFormData({ projectId: id || '', matchType: 'EXACT_ADDRESS', matchValue: '', priority: 0 })
      loadEmailRules()
    } catch (error: any) {
      alert(error.message || 'Failed to create email rule')
    }
  }

  const handleDeleteRule = async () => {
    if (!selectedRule) return
    try {
      await emailRulesApi.deleteEmailRule(selectedRule.id)
      setShowDeleteRuleDialog(false)
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

  const handleAutoReplySave = async () => {
    if (!id) return
    const html = autoReplyEditorRef.current?.getHTML() || ''
    const isEmpty = autoReplyEditorRef.current?.isEmpty()

    projectForm.setField('autoReplyHtml', isEmpty ? '' : html)
    projectForm.setSaving(true)

    try {
      await api.updateProject(id, {
        autoReplyEnabled: projectForm.form.autoReplyEnabled,
        autoReplyHtml: isEmpty ? null : html,
      })
      projectForm.setField('autoReplyHtml', isEmpty ? '' : html)
    } catch (error) {
      console.error('Failed to save auto-reply:', error)
    } finally {
      projectForm.setSaving(false)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization</Text>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  if (!projectForm.project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Project not found</Text>
      </div>
    )
  }

  const { form, setField, saving } = projectForm

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/projects"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>Edit Project</Heading>
          <Text className="text-zinc-500">Update the project details.</Text>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <form onSubmit={projectForm.handleSubmit}>
            {projectForm.error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {projectForm.error}
              </div>
            )}

            <FieldGroup>
              <Field>
                <Label>Project Name</Label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Website Redesign"
                  required
                />
              </Field>

              <Field>
                <Label>Project Code</Label>
                <Input
                  type="text"
                  value={form.projectCode}
                  onChange={(e) => setField('projectCode', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  placeholder="WEB-REDESIGN"
                  required
                  maxLength={10}
                />
                <Description>Short code for quick reference (max 10 chars)</Description>
              </Field>

              <Field>
                <Label>Client Name (optional)</Label>
                <Input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setField('clientName', e.target.value)}
                  placeholder="Acme Corp"
                />
              </Field>

              <Field>
                <Label>Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Brief description of the project..."
                  rows={3}
                />
              </Field>

              <Field>
                <Label>Default Ticket Assignee (optional)</Label>
                <Select
                  value={form.defaultAssigneeId}
                  onChange={(e) => setField('defaultAssigneeId', e.target.value)}
                >
                  <option value="">No default assignee</option>
                  {staffMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.name} ({member.role})
                    </option>
                  ))}
                </Select>
                <Description>Tickets created for this project will be automatically assigned to this person</Description>
              </Field>

              <DueDateFields form={form} setField={setField} />

              <Field>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <Description>Inactive projects are hidden from time entry</Description>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onChange={(val) => setField('isActive', val)}
                    color="blue"
                  />
                </div>
              </Field>
            </FieldGroup>

            <div className="mt-6 flex justify-end gap-3">
              <Button plain onClick={() => history.back()} disabled={saving}>
                Cancel
              </Button>
              <Button color="blue" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Email Rules Tab */}
      {activeTab === 'email-rules' && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Subheading>Email Routing Rules</Subheading>
              <Text className="mt-1 text-zinc-500">
                Rules that route incoming emails to this project.
              </Text>
            </div>
            <div className="flex gap-2">
              <Button plain onClick={() => navigate('/admin/email-rules')}>
                All Rules
              </Button>
              <Button color="blue" onClick={() => setShowCreateRuleDialog(true)}>
                <PlusIcon className="h-4 w-4" />
                Add Rule
              </Button>
            </div>
          </div>

          {emailRules.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-8 text-center">
              <EnvelopeIcon className="mx-auto h-10 w-10 text-zinc-400" />
              <Text className="mt-3 font-medium">No email rules for this project</Text>
              <Text className="mt-1 text-zinc-500">
                Create a rule to route incoming emails to this project as tickets.
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {emailRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    {rule.matchType === 'EXACT_ADDRESS' && <Badge color="blue">Exact Address</Badge>}
                    {rule.matchType === 'DOMAIN' && <Badge color="purple">Domain</Badge>}
                    {rule.matchType === 'CATCH_ALL' && <Badge color="amber">Catch-All</Badge>}
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
                        setShowDeleteRuleDialog(true)
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
      )}

      {/* Create Rule Dialog */}
      <Dialog open={showCreateRuleDialog} onClose={() => setShowCreateRuleDialog(false)}>
        <DialogTitle>Create Email Routing Rule</DialogTitle>
        <DialogDescription>
          Route matching emails to this project as tickets.
        </DialogDescription>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Match Type</Label>
              <Select
                value={ruleFormData.matchType}
                onChange={(e) =>
                  setRuleFormData({
                    ...ruleFormData,
                    matchType: e.target.value as 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL',
                  })
                }
              >
                <option value="EXACT_ADDRESS">Exact Address</option>
                <option value="DOMAIN">Domain</option>
                <option value="CATCH_ALL">Catch-All</option>
              </Select>
              <Text className="mt-1 text-sm text-zinc-500">
                {ruleFormData.matchType === 'EXACT_ADDRESS'
                  ? 'Matches exact recipient email address'
                  : ruleFormData.matchType === 'DOMAIN'
                    ? 'Matches sender domain'
                    : 'Matches any email not caught by other rules'}
              </Text>
            </Field>

            {ruleFormData.matchType !== 'CATCH_ALL' && (
              <Field>
                <Label>
                  {ruleFormData.matchType === 'EXACT_ADDRESS' ? 'Email Address' : 'Domain'}
                </Label>
                <Input
                  type="text"
                  value={ruleFormData.matchValue}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, matchValue: e.target.value })}
                  placeholder={
                    ruleFormData.matchType === 'EXACT_ADDRESS'
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
                value={ruleFormData.priority}
                onChange={(e) =>
                  setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 0 })
                }
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowCreateRuleDialog(false)}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleCreateRule}>
            Create Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Rule Dialog */}
      <Dialog open={showDeleteRuleDialog} onClose={() => setShowDeleteRuleDialog(false)}>
        <DialogTitle>Delete Email Rule</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this email rule? This action cannot be undone.
        </DialogDescription>
        <DialogBody>
          {selectedRule && (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 space-y-1">
              <div className="flex items-center gap-2">
                {selectedRule.matchType === 'EXACT_ADDRESS' && <Badge color="blue">Exact Address</Badge>}
                {selectedRule.matchType === 'DOMAIN' && <Badge color="purple">Domain</Badge>}
                {selectedRule.matchType === 'CATCH_ALL' && <Badge color="amber">Catch-All</Badge>}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedRule.matchValue || 'Any email'}
                </span>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteRuleDialog(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteRule}>
            Delete Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Auto-Reply Tab */}
      {activeTab === 'auto-reply' && (
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
              ref={autoReplyEditorRef}
              placeholder="Compose your auto-reply message..."
              disabled={!form.autoReplyEnabled}
              initialContent={form.autoReplyHtml}
            />
          </div>

          <div className="flex justify-end">
            <Button
              color="blue"
              onClick={handleAutoReplySave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Auto-Reply'}
            </Button>
          </div>
        </div>
      )}

      {/* Stages Tab */}
      {activeTab === 'stages' && (
        <StageManager
          stages={stageManager.stages}
          error={stageManager.error}
          onDragEnd={stageManager.handleDragEnd}
          onUpdate={stageManager.handleUpdate}
          onSetDefault={stageManager.handleSetDefault}
          onToggleResolved={stageManager.handleToggleResolved}
          onRequestDelete={stageManager.setStageToDelete}
          newStageName={stageManager.newStageName}
          onNewStageNameChange={stageManager.setNewStageName}
          newStageColor={stageManager.newStageColor}
          onNewStageColorChange={stageManager.setNewStageColor}
          onAdd={stageManager.handleAdd}
          stageToDelete={stageManager.stageToDelete}
          moveTicketsToStageId={stageManager.moveTicketsToStageId}
          onMoveTicketsToStageIdChange={stageManager.setMoveTicketsToStageId}
          onConfirmDelete={stageManager.handleDelete}
          onCancelDelete={stageManager.dismissDelete}
        />
      )}

      {/* Danger Zone */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-red-200 dark:ring-red-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {projectForm.project._count?.timeEntries && projectForm.project._count.timeEntries > 0
                ? 'This project has time entries and will be archived instead of deleted.'
                : 'Permanently delete this project. This action cannot be undone.'}
            </p>
          </div>
          <Button
            color="red"
            onClick={projectForm.handleDelete}
            disabled={projectForm.deleting || saving}
          >
            <TrashIcon className="h-4 w-4" />
            {projectForm.deleting ? 'Deleting...' : 'Delete Project'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Due date sub-section ----

interface DueDateFieldsProps {
  form: { dueDateLowDays: string; dueDateMediumDays: string; dueDateHighDays: string; dueDateUrgentDays: string }
  setField: (key: 'dueDateLowDays' | 'dueDateMediumDays' | 'dueDateHighDays' | 'dueDateUrgentDays', val: string) => void
}

const DUE_DATE_CONFIG = [
  { key: 'dueDateLowDays' as const, label: 'Low Priority', placeholder: 'e.g. 7' },
  { key: 'dueDateMediumDays' as const, label: 'Medium Priority', placeholder: 'e.g. 5' },
  { key: 'dueDateHighDays' as const, label: 'High Priority', placeholder: 'e.g. 2' },
  { key: 'dueDateUrgentDays' as const, label: 'Urgent Priority', placeholder: 'e.g. 1' },
]

function DueDateFields({ form, setField }: DueDateFieldsProps) {
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
      <p className="text-sm font-medium text-zinc-950 dark:text-white">Due Date by Priority (days)</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Auto-set due dates when tickets are created based on priority level</p>
      <div className="grid grid-cols-2 gap-3">
        {DUE_DATE_CONFIG.map(({ key, label, placeholder }) => (
          <Field key={key}>
            <Label className="text-xs text-zinc-500">{label}</Label>
            <Input
              type="number"
              min="0"
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
            />
          </Field>
        ))}
      </div>
    </div>
  )
}
