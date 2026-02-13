import { ProjectSoftwareDetail as ProjectSoftwareDetailType, SoftwareAccessRequest } from '../../../api/client'

export type { ProjectSoftwareDetailType, SoftwareAccessRequest }

export interface StaffMember {
  id: string
  user: { id: string; name: string; email: string }
}

export interface EditFormState {
  renewalDate: string
  billingCycle: '' | 'MONTHLY' | 'YEARLY'
  cost: string
  costType: '' | 'PER_USER' | 'PER_ORGANIZATION'
  autoRenewal: boolean
  licenseType: '' | 'PER_SEAT' | 'ENTERPRISE' | 'FREE' | 'OTHER'
  totalSeats: string
  vendorContactEmail: string
  vendorContactPhone: string
  contractUrl: string
  loginUrl: string
}
