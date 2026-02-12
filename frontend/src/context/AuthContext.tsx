import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { signIn, signUp, signOut, useSession, admin } from '../lib/auth-client'

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
    const result = await signUp.email({
      email,
      password,
      name
    })

    if (result.error) {
      throw new Error(result.error.message || 'Registration failed')
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

  // Debug: log full session object
  useEffect(() => {
    console.log('Full session object:', session)
    console.log('Session keys:', session ? Object.keys(session) : 'null')
    if (session?.session) {
      console.log('session.session:', session.session)
    }
  }, [session])

  // Check if session has impersonatedBy field
  // Try multiple possible paths where Better Auth might store this
  const sessionData = session?.session as { impersonatedBy?: string } | undefined
  const isImpersonating = !!(
    sessionData?.impersonatedBy ||
    (session as { impersonatedBy?: string } | undefined)?.impersonatedBy
  )

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
