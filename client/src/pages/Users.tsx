import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, FileCode, Check, X, Link2, Copy, ExternalLink, ChevronDown, AlertCircle } from 'lucide-react'
import { usersApi, migrationsApi, scriptsApi } from '../services/api'
import { validatePhoneNumber } from '../utils/phoneValidation'

export default function Users() {
  const { id: migrationId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [scriptDropdownOpen, setScriptDropdownOpen] = useState(false)
  const scriptDropdownRef = useRef<HTMLDivElement>(null)
  const [newUser, setNewUser] = useState({
    display_name: '',
    upn: '',
    phone_number: '',
  })
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scriptDropdownRef.current && !scriptDropdownRef.current.contains(event.target as Node)) {
        setScriptDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: migration } = useQuery({
    queryKey: ['migration', migrationId],
    queryFn: () => migrationsApi.get(migrationId!),
    enabled: !!migrationId,
  })

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', { migration_id: migrationId }],
    queryFn: () => usersApi.list({ migration_id: migrationId }),
    enabled: !!migrationId,
  })

  const addUserMutation = useMutation({
    mutationFn: () => usersApi.create({
      migration_id: migrationId,
      ...newUser,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', { migration_id: migrationId }] })
      setNewUser({ display_name: '', upn: '', phone_number: '' })
      setShowAddForm(false)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', { migration_id: migrationId }] })
    },
  })

  const generateTeamsScriptMutation = useMutation({
    mutationFn: () => scriptsApi.generateUserAssignments(migrationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setScriptDropdownOpen(false)
      navigate('/scripts')
    },
  })

  const generateAdScriptMutation = useMutation({
    mutationFn: () => scriptsApi.generateAdPhoneNumbers(migrationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setScriptDropdownOpen(false)
      navigate('/scripts')
    },
  })

  const generateMagicLinkMutation = useMutation({
    mutationFn: () => migrationsApi.generateMagicLink(migrationId!, 30),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', migrationId] })
    },
  })

  const copyMagicLink = async () => {
    if (migration?.magic_link_token) {
      await navigator.clipboard.writeText(`${window.location.origin}/collect/${migration.magic_link_token}`)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>
  }

  const usersWithPhones = users?.filter(u => u.phone_number).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/migrations/${migrationId}`} className="p-2 hover:bg-surface-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
            <p className="text-zinc-500">{migration?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Script Generation Dropdown */}
          <div className="relative" ref={scriptDropdownRef}>
            <button
              onClick={() => setScriptDropdownOpen(!scriptDropdownOpen)}
              disabled={usersWithPhones === 0 || generateTeamsScriptMutation.isPending || generateAdScriptMutation.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FileCode className="h-5 w-5" />
              Generate Script
              <ChevronDown className={`h-4 w-4 transition-transform ${scriptDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {scriptDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-800 border border-surface-600 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button
                    onClick={() => generateTeamsScriptMutation.mutate()}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors"
                    disabled={generateTeamsScriptMutation.isPending}
                  >
                    <div className="font-medium text-zinc-200">Teams User Assignment</div>
                    <div className="text-xs text-zinc-500">Assign phone numbers in Microsoft Teams</div>
                  </button>
                  <button
                    onClick={() => generateAdScriptMutation.mutate()}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors mt-1"
                    disabled={generateAdScriptMutation.isPending}
                  >
                    <div className="font-medium text-zinc-200">Active Directory</div>
                    <div className="text-xs text-zinc-500">Update phone numbers in AD user accounts</div>
                  </button>
                </div>
                <div className="border-t border-surface-600 p-2">
                  <Link
                    to="/scripts"
                    className="block w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors text-sm text-zinc-400"
                    onClick={() => setScriptDropdownOpen(false)}
                  >
                    View All Scripts
                  </Link>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="card flex-1">
          <p className="text-sm text-zinc-500">Total Users</p>
          <p className="text-2xl font-bold text-zinc-100">{users?.length || 0}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-zinc-500">With Phone Numbers</p>
          <p className="text-2xl font-bold text-zinc-100">{usersWithPhones}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-zinc-500">Configured in Teams</p>
          <p className="text-2xl font-bold text-zinc-100">{users?.filter(u => u.is_configured).length || 0}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-zinc-500">Via Customer Link</p>
          <p className="text-2xl font-bold text-zinc-100">{users?.filter(u => u.entered_via_magic_link).length || 0}</p>
        </div>
      </div>

      {/* Customer Data Collection Link */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold text-zinc-100">Customer Data Collection</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Generate a link for the customer to submit user data (names, email addresses, phone numbers).
          The link allows the customer to add or update users for this migration.
        </p>

        {migration?.magic_link_token ? (
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-purple-400 mb-2">Active Customer Link</p>
                <code className="block text-sm text-zinc-400 bg-surface-800 px-3 py-2 rounded truncate">
                  {window.location.origin}/collect/{migration.magic_link_token}
                </code>
                {migration.magic_link_expires_at && (
                  <p className="text-xs text-zinc-500 mt-2">
                    Expires: {new Date(migration.magic_link_expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyMagicLink}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={`/collect/${migration.magic_link_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-purple-500/30">
              <button
                onClick={() => generateMagicLinkMutation.mutate()}
                disabled={generateMagicLinkMutation.isPending}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Generate new link (invalidates current link)
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => generateMagicLinkMutation.mutate()}
            disabled={generateMagicLinkMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            {generateMagicLinkMutation.isPending ? 'Generating...' : 'Generate Customer Link'}
          </button>
        )}
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="card bg-primary-500/10 border-primary-500/30">
          <h3 className="font-medium text-zinc-100 mb-4">Add New User</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Display Name *</label>
              <input
                type="text"
                className="input"
                value={newUser.display_name}
                onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="label">UPN (Email) *</label>
              <input
                type="email"
                className="input"
                value={newUser.upn}
                onChange={(e) => setNewUser({ ...newUser, upn: e.target.value })}
                placeholder="john.smith@company.com"
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                className={`input font-mono ${phoneError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                value={newUser.phone_number}
                onChange={(e) => {
                  const value = e.target.value
                  setNewUser({ ...newUser, phone_number: value })
                  if (migration?.country_code && value) {
                    const validation = validatePhoneNumber(value, migration.country_code)
                    setPhoneError(validation.error || null)
                  } else {
                    setPhoneError(null)
                  }
                }}
                placeholder={migration?.country_code ? `${migration.country_code}1234567890` : '+12125551234'}
              />
              {phoneError && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {phoneError}
                </p>
              )}
              {migration?.country_code && !phoneError && (
                <p className="text-zinc-500 text-xs mt-1">Must start with {migration.country_code}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => addUserMutation.mutate()}
              disabled={!newUser.display_name || !newUser.upn || addUserMutation.isPending || !!phoneError}
              className="btn btn-primary"
            >
              {addUserMutation.isPending ? 'Adding...' : 'Add User'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Routing Type Info */}
      <div className="text-sm text-zinc-400 bg-surface-700/50 px-4 py-2 rounded-lg border border-surface-600">
        Routing Type: <strong className="text-zinc-200 capitalize">{migration?.routing_type?.replace('_', ' ')}</strong>
        {migration?.routing_type === 'direct_routing' && ' - Numbers will be assigned via Direct Routing'}
        {migration?.routing_type === 'operator_connect' && ' - Numbers will be assigned via Operator Connect'}
      </div>

      {/* Users Table */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-600">
              <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">UPN</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Phone Number</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Configured</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Source</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-surface-700 hover:bg-surface-700/50 transition-colors">
                <td className="py-3 px-4 font-medium text-zinc-200">{user.display_name}</td>
                <td className="py-3 px-4 text-zinc-400">{user.upn}</td>
                <td className="py-3 px-4 font-mono text-zinc-300">
                  {user.phone_number || (
                    <span className="text-zinc-600">Not assigned</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {user.is_configured ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-zinc-600" />
                  )}
                </td>
                <td className="py-3 px-4">
                  {user.entered_via_magic_link ? (
                    <span className="badge badge-purple">Customer</span>
                  ) : (
                    <span className="badge badge-gray">Manual</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => {
                      if (confirm('Delete this user?')) {
                        deleteUserMutation.mutate(user.id)
                      }
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users?.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p>No users yet.</p>
            <p className="text-sm mt-1">Add users manually or share the customer link to collect data.</p>
          </div>
        )}
      </div>
    </div>
  )
}
