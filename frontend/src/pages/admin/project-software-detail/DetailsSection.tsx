import { Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Switch, SwitchField } from '@/components/ui/switch'
import {
  ComputerDesktopIcon,
  PencilIcon,
  TrashIcon,
  LinkIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  KeyIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Heading } from '@/components/ui/heading'
import type { ProjectSoftwareDetailType, EditFormState } from './types'

interface DetailsSectionProps {
  software: ProjectSoftwareDetailType
  isEditingDetails: boolean
  savingDetails: boolean
  editForm: EditFormState
  onNavigateBack: () => void
  onOpenWebsite: () => void
  onShowDeleteModal: () => void
  onOpenEditNotesModal: () => void
  onStartEditingDetails: () => void
  onCancelEditingDetails: () => void
  onSaveDetails: () => void
  onEditFormChange: (form: EditFormState) => void
}

function getDaysUntilRenewal(renewalDate: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const renewal = new Date(renewalDate)
  renewal.setHours(0, 0, 0, 0)
  return Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getRenewalBadge(renewalDate: string) {
  const days = getDaysUntilRenewal(renewalDate)
  if (days < 0) return <Badge color="zinc">Expired</Badge>
  if (days <= 3) return <Badge color="red">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</Badge>
  if (days <= 14) return <Badge color="amber">{days} days</Badge>
  if (days <= 30) return <Badge color="yellow">{days} days</Badge>
  return <Badge color="green">{days} days</Badge>
}

export default function DetailsSection({
  software,
  isEditingDetails,
  savingDetails,
  editForm,
  onNavigateBack,
  onOpenWebsite,
  onShowDeleteModal,
  onOpenEditNotesModal,
  onStartEditingDetails,
  onCancelEditingDetails,
  onSaveDetails,
  onEditFormChange,
}: DetailsSectionProps) {
  const getSeatsUsed = () => {
    return software?._count?.accessRequests || 0
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button plain onClick={onNavigateBack}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            {software.software.iconUrl ? (
              <img
                src={software.software.iconUrl}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                <ComputerDesktopIcon className="h-8 w-8 text-zinc-400" />
              </div>
            )}
            <div>
              <Heading>{software.software.name}</Heading>
              <div className="flex items-center gap-2 mt-1">
                {software.software.vendor && (
                  <Text className="text-zinc-500">{software.software.vendor}</Text>
                )}
                {software.software.category && (
                  <Badge color="zinc">{software.software.category.name}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {software.software.websiteUrl && (
            <Button outline onClick={onOpenWebsite}>
              <LinkIcon className="h-4 w-4" />
              Website
            </Button>
          )}
          <Button color="red" outline onClick={onShowDeleteModal}>
            <TrashIcon className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Description */}
      {software.software.description && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
          <Text>{software.software.description}</Text>
        </div>
      )}

      {/* Project Notes */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <Subheading>Project Notes</Subheading>
          <Button plain onClick={onOpenEditNotesModal}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        </div>
        {software.notes ? (
          <Text className="whitespace-pre-wrap">{software.notes}</Text>
        ) : (
          <Text className="text-zinc-400 italic">No notes added</Text>
        )}
      </div>

      {/* Renewal, Billing & License Management */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <Subheading>Renewal & Billing</Subheading>
          {!isEditingDetails ? (
            <Button plain onClick={onStartEditingDetails}>
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button plain onClick={onCancelEditingDetails} disabled={savingDetails}>
                Cancel
              </Button>
              <Button color="blue" onClick={onSaveDetails} disabled={savingDetails}>
                {savingDetails ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>

        {isEditingDetails ? (
          <div className="space-y-6">
            {/* Renewal & Billing Edit */}
            <FieldGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <Label>Renewal Date</Label>
                  <Input
                    type="date"
                    value={editForm.renewalDate}
                    onChange={(e) => onEditFormChange({ ...editForm, renewalDate: e.target.value })}
                  />
                </Field>
                <Field>
                  <Label>Billing Cycle</Label>
                  <Select
                    value={editForm.billingCycle}
                    onChange={(e) => onEditFormChange({ ...editForm, billingCycle: e.target.value as '' | 'MONTHLY' | 'YEARLY' })}
                  >
                    <option value="">Select...</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </Select>
                </Field>
                <Field>
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={editForm.cost}
                    onChange={(e) => onEditFormChange({ ...editForm, cost: e.target.value })}
                  />
                </Field>
                <Field>
                  <Label>Cost Type</Label>
                  <Select
                    value={editForm.costType}
                    onChange={(e) => onEditFormChange({ ...editForm, costType: e.target.value as '' | 'PER_USER' | 'PER_ORGANIZATION' })}
                  >
                    <option value="">Select...</option>
                    <option value="PER_USER">Per User</option>
                    <option value="PER_ORGANIZATION">Per Organization</option>
                  </Select>
                </Field>
              </div>
              <SwitchField>
                <Label>Auto-renewal</Label>
                <Switch
                  checked={editForm.autoRenewal}
                  onChange={(checked: boolean) => onEditFormChange({ ...editForm, autoRenewal: checked })}
                />
              </SwitchField>
            </FieldGroup>

            {/* License Management Edit */}
            <div>
              <Text className="font-medium mb-3">License Management</Text>
              <FieldGroup>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <Label>License Type</Label>
                    <Select
                      value={editForm.licenseType}
                      onChange={(e) => onEditFormChange({ ...editForm, licenseType: e.target.value as '' | 'PER_SEAT' | 'ENTERPRISE' | 'FREE' | 'OTHER' })}
                    >
                      <option value="">Select...</option>
                      <option value="PER_SEAT">Per Seat</option>
                      <option value="ENTERPRISE">Enterprise</option>
                      <option value="FREE">Free</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </Field>
                  <Field>
                    <Label>Total Seats</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unlimited"
                      value={editForm.totalSeats}
                      onChange={(e) => onEditFormChange({ ...editForm, totalSeats: e.target.value })}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>

            {/* Vendor & Contract Edit */}
            <div>
              <Text className="font-medium mb-3">Vendor & Contract</Text>
              <FieldGroup>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <Label>Vendor Contact Email</Label>
                    <Input
                      type="email"
                      placeholder="vendor@example.com"
                      value={editForm.vendorContactEmail}
                      onChange={(e) => onEditFormChange({ ...editForm, vendorContactEmail: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <Label>Vendor Contact Phone</Label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={editForm.vendorContactPhone}
                      onChange={(e) => onEditFormChange({ ...editForm, vendorContactPhone: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <Label>Contract / Agreement URL</Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={editForm.contractUrl}
                      onChange={(e) => onEditFormChange({ ...editForm, contractUrl: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <Label>Login / Account URL</Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={editForm.loginUrl}
                      onChange={(e) => onEditFormChange({ ...editForm, loginUrl: e.target.value })}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Renewal & Billing Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <CalendarDaysIcon className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <Text className="text-sm text-zinc-500">Renewal Date</Text>
                  {software.renewalDate ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Text className="font-medium">
                        {new Date(software.renewalDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </Text>
                      {getRenewalBadge(software.renewalDate)}
                    </div>
                  ) : (
                    <Text className="text-zinc-400 italic">Not set</Text>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CurrencyDollarIcon className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <Text className="text-sm text-zinc-500">Cost</Text>
                  {software.cost ? (
                    <Text className="font-medium mt-0.5">
                      ${parseFloat(software.cost).toFixed(2)}
                      {software.billingCycle === 'MONTHLY' ? '/mo' : '/yr'}
                      {software.costType === 'PER_USER' ? ' per user' : software.costType === 'PER_ORGANIZATION' ? ' per org' : ''}
                    </Text>
                  ) : (
                    <Text className="text-zinc-400 italic">Not set</Text>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <KeyIcon className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <Text className="text-sm text-zinc-500">Auto-renewal</Text>
                  <Text className="font-medium mt-0.5">
                    {software.autoRenewal ? (
                      <Badge color="green">Enabled</Badge>
                    ) : (
                      <Badge color="zinc">Disabled</Badge>
                    )}
                  </Text>
                </div>
              </div>
            </div>

            {/* License Display */}
            {(software.licenseType || software.totalSeats != null) && (
              <div>
                <Text className="text-sm font-medium text-zinc-500 mb-2">License</Text>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {software.licenseType && (
                    <div>
                      <Text className="text-sm text-zinc-500">Type</Text>
                      <Badge color="blue" className="mt-0.5">
                        {software.licenseType === 'PER_SEAT' ? 'Per Seat' :
                         software.licenseType === 'ENTERPRISE' ? 'Enterprise' :
                         software.licenseType === 'FREE' ? 'Free' : 'Other'}
                      </Badge>
                    </div>
                  )}
                  {software.totalSeats != null && (
                    <div>
                      <Text className="text-sm text-zinc-500">Seats</Text>
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <Text className="font-medium">{getSeatsUsed()} / {software.totalSeats}</Text>
                          {getSeatsUsed() >= software.totalSeats && (
                            <Badge color="red">Full</Badge>
                          )}
                        </div>
                        <div className="w-full max-w-48 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${
                              getSeatsUsed() >= software.totalSeats
                                ? 'bg-red-500'
                                : getSeatsUsed() >= software.totalSeats * 0.8
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min((getSeatsUsed() / software.totalSeats) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vendor & Contract Display */}
            {(software.vendorContactEmail || software.vendorContactPhone || software.contractUrl || software.loginUrl) && (
              <div>
                <Text className="text-sm font-medium text-zinc-500 mb-2">Vendor & Contract</Text>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {software.vendorContactEmail && (
                    <a href={`mailto:${software.vendorContactEmail}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                      <EnvelopeIcon className="h-4 w-4" />
                      <Text className="text-blue-600">{software.vendorContactEmail}</Text>
                    </a>
                  )}
                  {software.vendorContactPhone && (
                    <a href={`tel:${software.vendorContactPhone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                      <PhoneIcon className="h-4 w-4" />
                      <Text className="text-blue-600">{software.vendorContactPhone}</Text>
                    </a>
                  )}
                  {software.contractUrl && (
                    <a href={software.contractUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      <Text className="text-blue-600">View Contract</Text>
                    </a>
                  )}
                  {software.loginUrl && (
                    <a href={software.loginUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      <Text className="text-blue-600">Login / Account Portal</Text>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Empty state for all three sections */}
            {!software.renewalDate && !software.cost && !software.licenseType && software.totalSeats == null &&
             !software.vendorContactEmail && !software.vendorContactPhone && !software.contractUrl && !software.loginUrl && (
              <Text className="text-zinc-400 italic">No renewal, license, or vendor details added yet. Click Edit to add.</Text>
            )}
          </div>
        )}
      </div>
    </>
  )
}
