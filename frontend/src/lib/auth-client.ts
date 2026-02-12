import { createAuthClient } from 'better-auth/react'
import { organizationClient, adminClient, magicLinkClient } from 'better-auth/client/plugins'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    adminClient(),
    organizationClient(),
    magicLinkClient()
  ]
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  admin,
  magicLink
} = authClient
