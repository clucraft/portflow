import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Zap, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import ParticleBackground from '../components/ParticleBackground'

export default function Login() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // Check if setup has been completed
  useEffect(() => {
    api.get('/auth/check-setup')
      .then((res) => {
        if (!res.data.setup_complete) {
          navigate('/setup', { replace: true })
        }
      })
      .catch(() => {
        // If check fails, stay on login
      })
      .finally(() => setCheckingSetup(false))
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Login failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="inline-block animate-pulse">
          <Zap className="h-8 w-8 text-primary-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 relative">
      <ParticleBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="relative">
              <Phone className="h-10 w-10 text-primary-400" />
              <Zap className="h-4 w-4 text-primary-300 absolute -top-1 -right-1" />
            </div>
            <h1 className="text-3xl font-bold text-primary-400 text-glow">PortFlow</h1>
          </div>
          <p className="text-xs text-zinc-500 tracking-widest uppercase">EV Migration Manager</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-6 text-center">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
