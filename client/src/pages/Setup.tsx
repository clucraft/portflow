import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Zap, UserPlus } from 'lucide-react'
import api from '../services/api'
import ParticleBackground from '../components/ParticleBackground'

export default function Setup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if setup has already been completed
  useEffect(() => {
    api.get('/auth/check-setup')
      .then((res) => {
        if (res.data.setup_complete) {
          navigate('/login', { replace: true })
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/setup', {
        email,
        display_name: displayName,
        password,
      })
      localStorage.setItem('portflow_token', res.data.token)
      window.location.href = '/'
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Setup failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
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
          <p className="text-xs text-zinc-500 tracking-widest uppercase">First-Time Setup</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2 text-center">Create Admin Account</h2>
          <p className="text-sm text-zinc-500 text-center mb-6">Set up the first administrator account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Display Name</label>
              <input
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Name"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                'Creating...'
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Admin Account
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
