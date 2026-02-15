import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { useModalForm } from '../../hooks/useModalForm'
import { api } from '../../api/client'
import { emailRulesApi, EmailRule, CreateEmailRuleData } from '../../api/emailRules'
import { getMatchTypeBadge, getMatchTypeDescription } from '../../components/project/emailRuleHelpers'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlusIcon, EnvelopeIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Project {
  id: string
  name: string
  projectCode: string
}

export default function ProjectEmailRules() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [emailRules, setEmailRules] = useState<EmailRule[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const createRuleModal = useModalForm({
    initialData: {
      projectId: '',
      matchType: 'EXACT_ADDRESS' as 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL',
      matchValue: '',
      priority: 0,
    },
  })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedRule, setSelectedRule] = useState<EmailRule | null>(null)

  useEffect(() => {
    if (currentOrg) {
      loadData()
    }
  }, [currentOrg])

  const loadData = async () => {
    setLoading(true)
    try {
      const [rulesData, projectsData] = await Promise.all([
        emailRulesApi.getEmailRules(),
        api.getProjects(),
      ])
      setEmailRules(rulesData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createRuleModal.handleSubmit(async () => {
        const data: CreateEmailRuleData = {
          projectId: createRuleModal.formData.projectId,
          matchType: createRuleModal.formData.matchType,
          priority: createRuleModal.formData.priority || 0,
        }

        // Only include matchValue for non-CATCH_ALL types
        if (createRuleModal.formData.matchType !== 'CATCH_ALL') {
          data.matchValue = createRuleModal.formData.matchValue
        }

        await emailRulesApi.createEmailRule(data)
        createRuleModal.close()
        loadData()
      })
    } catch (error: any) {
      alert(error.message || 'Failed to create email rule')
    }
  }

  const handleDelete = async () => {
    if (!selectedRule) return
    try {
      await emailRulesApi.deleteEmailRule(selectedRule.id)
      setShowDeleteDialog(false)
      setSelectedRule(null)
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to delete email rule')
    }
  }

  const handleToggleActive = async (rule: EmailRule) => {
    try {
      await emailRulesApi.updateEmailRule(rule.id, { isActive: !rule.isActive })
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to update email rule')
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Email Routing Rules</Heading>
          <Text className="mt-2">Configure how incoming emails are routed to projects</Text>
        </div>
        <div className="flex gap-3">
          <Button plain onClick={() => navigate('/admin/email-logs')}>
            View Email Logs
          </Button>
          <Button color="blue" onClick={() => createRuleModal.open()}>
            <PlusIcon className="h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      {emailRules.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <EnvelopeIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <Subheading className="mt-4">No email rules configured</Subheading>
          <Text className="mt-2">
            Create email routing rules to automatically convert incoming emails into support tickets.
          </Text>
          <Button color="blue" onClick={() => createRuleModal.open()} className="mt-4">
            <PlusIcon className="h-4 w-4" />
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Match Type</TableHeader>
                <TableHeader>Match Value</TableHeader>
                <TableHeader>Project</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Emails</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="w-[150px]">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {emailRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{getMatchTypeBadge(rule.matchType)}</TableCell>
                  <TableCell className="text-zinc-500">
                    {rule.matchValue || '-'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/admin/projects/${rule.projectId}`)}
                      className="font-medium text-zinc-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left"
                    >
                      {rule.project?.name || 'Unknown'}
                    </button>
                  </TableCell>
                  <TableCell className="text-zinc-500">{rule.priority}</TableCell>
                  <TableCell className="text-zinc-500">
                    {rule._count?.inboundEmails || 0}
                  </TableCell>
                  <TableCell>
                    {rule.isActive ? (
                      <Badge color="green">Active</Badge>
                    ) : (
                      <Badge color="zinc">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        plain
                        onClick={() => handleToggleActive(rule)}
                        title={rule.isActive ? 'Deactivate' : 'Activate'}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={createRuleModal.isOpen} onClose={createRuleModal.close}>
        <DialogTitle>Create Email Routing Rule</DialogTitle>
        <DialogDescription>
          Configure how incoming emails should be routed to projects.
        </DialogDescription>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Project</Label>
              <Select
                value={createRuleModal.formData.projectId}
                onChange={(e) => createRuleModal.setField('projectId', e.target.value)}
              >
                <option value="">Select project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Match Type</Label>
              <Select
                value={createRuleModal.formData.matchType}
                onChange={(e) => createRuleModal.setField('matchType', e.target.value as 'EXACT_ADDRESS' | 'DOMAIN' | 'CATCH_ALL')}
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
                onChange={(e) => createRuleModal.setField('priority', parseInt(e.target.value) || 0)}
              />
              <Text className="mt-1 text-sm text-zinc-500">
                Rules are evaluated from highest to lowest priority
              </Text>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={createRuleModal.close}>
            Cancel
          </Button>
          <Button color="blue" onClick={handleCreate} disabled={createRuleModal.saving}>
            {createRuleModal.saving ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Email Rule</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this email rule? This action cannot be undone.
        </DialogDescription>
        <DialogBody>
          {selectedRule && (
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Text className="font-medium">Type:</Text>
                  {getMatchTypeBadge(selectedRule.matchType)}
                </div>
                {selectedRule.matchValue && (
                  <div>
                    <Text className="font-medium">Value:</Text>
                    <Text className="text-zinc-600 dark:text-zinc-400">
                      {selectedRule.matchValue}
                    </Text>
                  </div>
                )}
                <div>
                  <Text className="font-medium">Project:</Text>
                  <Text className="text-zinc-600 dark:text-zinc-400">
                    {selectedRule.project?.name}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete}>
            Delete Rule
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
