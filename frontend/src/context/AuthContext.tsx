import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { signIn, signUp, signOut, useSession, admin, getSession } from '../lib/auth-client'

interface User {
  id: string
  name: string
  email: string
  image?: string
  role?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isSuperAdmin: boolean
  isImpersonating: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  stopImpersonating: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(isPending)
  }, [isPending])

  const login = async (email: string, password: string) => {
    const result = await signIn.email({
      email,
      password
    })

    if (result.error) {
      throw new Error(result.error.message || 'Login failed')
    }
  }

  const register = async (email: string, password: string, name: string) => {
    console.log('[Auth] Starting registration...')
    const result = await signUp.email({
      email,
      password,
      name
    })

    console.log('[Auth] Signup result:', result)

    if (result.error) {
      console.error('[Auth] Signup failed:', result.error)
      throw new Error(result.error.message || 'Registration failed')
    }

    // Ensure the user has an authenticated session before onboarding actions
    // like organization.create, which require authorization.
    console.log('[Auth] Checking session after signup...')
    const sessionResult = await getSession()
    console.log('[Auth] Session result:', sessionResult)

    if (!sessionResult?.data?.session) {
      console.log('[Auth] No session found, signing in...')
      const signInResult = await signIn.email({ email, password })
      console.log('[Auth] Sign-in result:', signInResult)

      if (signInResult.error) {
        console.error('[Auth] Sign-in failed:', signInResult.error)
        throw new Error(signInResult.error.message || 'Account created. Please sign in to continue.')
      }

      // Verify session was created
      const finalSession = await getSession()
      console.log('[Auth] Final session check:', finalSession)
    }
  }

  const logout = async () => {
    await signOut()
  }

  const stopImpersonating = async () => {
    await admin.stopImpersonating()
    window.location.href = '/super-admin'
  }

  const user = session?.user as User | null
  const isSuperAdmin = user?.role === 'admin'

  // Check if session has impersonatedBy field
  const sessionData = session?.session as { impersonatedBy?: string } | undefined
  const isImpersonating = !!sessionData?.impersonatedBy

  const value: AuthContextType = {
    user,
    isAuthenticated: !!session?.user,
    isLoading,
    isSuperAdmin,
    isImpersonating,
    login,
    register,
    logout,
    stopImpersonating
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
