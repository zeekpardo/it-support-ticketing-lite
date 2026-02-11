import { createAuthClient } from 'better-auth/react'
import { organizationClient, adminClient } from 'better-auth/client/plugins'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    adminClient(),
    organizationClient()
  ]
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  admin
} = authClient
