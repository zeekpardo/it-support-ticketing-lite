import { createAuthClient } from 'better-auth/react'
import { organizationClient, adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001',
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
