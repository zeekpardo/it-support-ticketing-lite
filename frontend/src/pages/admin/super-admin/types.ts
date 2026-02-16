export interface Membership {
  id: string
  role: string
  organization: {
    id: string
    name: string
    slug: string
  }
  inboxAssignments: Array<{
    inbox: {
      id: string
      name: string
      inboxCode: string
    }
  }>
}

export interface User {
  id: string
  name: string
  email: string
  role?: string
  banned?: boolean
  banReason?: string
  banExpires?: string
  createdAt: string
  members?: Membership[]
}

export type TabType = 'users' | 'software' | 'categories' | 'accounts'
