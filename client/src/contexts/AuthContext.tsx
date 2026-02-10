import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import api from '../services/api'

interface AuthUser {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'member' | 'viewer'
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  canWrite: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('portflow_token')
    setUser(null)
  }, [])

  // Validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('portflow_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        localStorage.removeItem('portflow_token')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { token, user: userData } = res.data
    localStorage.setItem('portflow_token', token)
    setUser(userData)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        canWrite: user?.role !== 'viewer',
      }}
    >
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
