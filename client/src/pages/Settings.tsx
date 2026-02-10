import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Users, Truck, FileText, Mail, Shield, Plus, X, Key } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  teamApi, carriersApi, voiceRoutingPoliciesApi, dialPlansApi, settingsApi, auditApi,
  type TeamMember, type Carrier
} from '../services/api'

type SettingsTab = 'users' | 'carriers' | 'policies' | 'email' | 'audit'

export default function Settings() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('users')

  const tabs: { id: SettingsTab; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'carriers', label: 'Carriers', icon: Truck },
    { id: 'policies', label: 'Policies', icon: FileText },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'audit', label: 'Audit Log', icon: Shield, adminOnly: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary-400" />
          Settings
        </h1>
        <p className="text-zinc-500">Manage users, carriers, policies, and system configuration</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-surface-600 pb-px">
        {tabs.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface-700 text-primary-400 border border-surface-600 border-b-surface-700 -mb-px'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'carriers' && <CarriersTab />}
      {activeTab === 'policies' && <PoliciesTab />}
      {activeTab === 'email' && <EmailTab />}
      {activeTab === 'audit' && isAdmin && <AuditLogTab />}
    </div>
  )
}

// ============ USERS TAB ============
function UsersTab() {
  const { isAdmin, user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [changeMyPassword, setChangeMyPassword] = useState(false)
  const [form, setForm] = useState({ email: '', display_name: '', role: 'member', password: '' })
  const [resetForm, setResetForm] = useState({ new_password: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [passwordError, setPasswordError] = useState('')

  const { data: members, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: teamApi.list,
  })

  const createMutation = useMutation({
    mutationFn: teamApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setShowAdd(false)
      setForm({ email: '', display_name: '', role: 'member', password: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TeamMember> }) => teamApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setEditingId(null)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => teamApi.resetPassword(id, password),
    onSuccess: () => {
      setResetPasswordId(null)
      setResetForm({ new_password: '' })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      import('../services/api').then((mod) =>
        mod.authApi.changePassword(passwordForm.current_password, passwordForm.new_password)
      ),
    onSuccess: () => {
      setChangeMyPassword(false)
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setPasswordError('')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to change password'
      setPasswordError(message)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => teamApi.update(id, { is_active: false } as Partial<TeamMember>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  })

  if (isLoading) return <div className="text-zinc-500">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Team Members</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setChangeMyPassword(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            Change My Password
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Change My Password Modal */}
      {changeMyPassword && (
        <div className="card border-primary-500/30 bg-primary-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Change Your Password</h3>
            <button onClick={() => { setChangeMyPassword(false); setPasswordError('') }} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>
          {passwordError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{passwordError}</div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input" value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  setPasswordError('Passwords do not match')
                  return
                }
                changePasswordMutation.mutate()
              }}
              className="btn btn-primary"
              disabled={!passwordForm.current_password || !passwordForm.new_password || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Saving...' : 'Change Password'}
            </button>
            <button onClick={() => { setChangeMyPassword(false); setPasswordError('') }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Add User Form */}
      {showAdd && isAdmin && (
        <div className="card border-primary-500/30 bg-primary-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Add Team Member</h3>
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name *</label>
              <input type="text" className="input" value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createMutation.mutate(form)}
              className="btn btn-primary"
              disabled={!form.email || !form.display_name || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-600">
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Name</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Email</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Role</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Last Login</th>
              {isAdmin && <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members?.map((member) => (
              <tr key={member.id} className="border-b border-surface-700 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 text-xs font-medium flex-shrink-0">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-zinc-200">{member.display_name}</span>
                    {member.id === currentUser?.id && <span className="text-xs text-zinc-500">(you)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-sm">{member.email}</td>
                <td className="px-4 py-3">
                  {editingId === member.id ? (
                    <select
                      className="input py-1 text-sm w-28"
                      defaultValue={member.role}
                      onChange={(e) => {
                        updateMutation.mutate({ id: member.id, data: { role: e.target.value as TeamMember['role'] } })
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      member.role === 'admin' ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' :
                      member.role === 'viewer' ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' :
                      'bg-green-500/20 text-green-400 border-green-500/30'
                    }`}>
                      {member.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-sm">
                  {member.last_login_at ? new Date(member.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === member.id ? (
                        <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1">
                          Done
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setEditingId(member.id)} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1">
                            Edit
                          </button>
                          <button onClick={() => setResetPasswordId(member.id)} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1">
                            Reset PW
                          </button>
                          {member.id !== currentUser?.id && (
                            <button
                              onClick={() => {
                                if (confirm(`Deactivate ${member.display_name}?`)) {
                                  deactivateMutation.mutate(member.id)
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                            >
                              Deactivate
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Reset Password for {members?.find(m => m.id === resetPasswordId)?.display_name}</h3>
            <button onClick={() => setResetPasswordId(null)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input max-w-sm" value={resetForm.new_password}
              onChange={(e) => setResetForm({ new_password: e.target.value })}
              placeholder="Min 8 characters" />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => resetPasswordMutation.mutate({ id: resetPasswordId, password: resetForm.new_password })}
              className="btn btn-primary"
              disabled={!resetForm.new_password || resetForm.new_password.length < 8 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
            <button onClick={() => setResetPasswordId(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ CARRIERS TAB ============
function CarriersTab() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ slug: '', display_name: '' })

  const { data: carriers, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: carriersApi.list,
  })

  const createMutation = useMutation({
    mutationFn: carriersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] })
      setShowAdd(false)
      setForm({ slug: '', display_name: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Carrier> }) => carriersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] })
      setEditingId(null)
    },
  })

  if (isLoading) return <div className="text-zinc-500">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Carriers</h2>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Carrier
          </button>
        )}
      </div>

      {showAdd && isAdmin && (
        <div className="card border-primary-500/30 bg-primary-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Add Carrier</h3>
            <button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-zinc-300"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Slug (lowercase, no spaces)</label>
              <input type="text" className="input" value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g., verizon" />
            </div>
            <div>
              <label className="label">Display Name</label>
              <input type="text" className="input" value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="e.g., Verizon" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate(form)} className="btn btn-primary"
              disabled={!form.slug || !form.display_name || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Carrier'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-600">
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Slug</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Display Name</th>
              <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Status</th>
              {isAdmin && <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {carriers?.map((carrier) => (
              <tr key={carrier.id} className="border-b border-surface-700 last:border-0">
                <td className="px-4 py-3 text-zinc-200 font-mono text-sm">{carrier.slug}</td>
                <td className="px-4 py-3">
                  {editingId === carrier.id ? (
                    <input type="text" className="input py-1 text-sm" defaultValue={carrier.display_name}
                      onBlur={(e) => updateMutation.mutate({ id: carrier.id, data: { display_name: e.target.value } })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { updateMutation.mutate({ id: carrier.id, data: { display_name: (e.target as HTMLInputElement).value } }); } }}
                      autoFocus />
                  ) : (
                    <span className="text-zinc-200">{carrier.display_name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    carrier.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                  }`}>
                    {carrier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditingId(editingId === carrier.id ? null : carrier.id)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1">
                        {editingId === carrier.id ? 'Done' : 'Edit'}
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ id: carrier.id, data: { is_active: !carrier.is_active } as Partial<Carrier> })}
                        className={`text-xs px-2 py-1 ${carrier.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                        {carrier.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {(!carriers || carriers.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No carriers configured</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ POLICIES TAB ============
function PoliciesTab() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showAddVrp, setShowAddVrp] = useState(false)
  const [showAddDp, setShowAddDp] = useState(false)
  const [vrpForm, setVrpForm] = useState({ name: '', description: '' })
  const [dpForm, setDpForm] = useState({ name: '', description: '' })

  const { data: vrps } = useQuery({ queryKey: ['voice-routing-policies'], queryFn: voiceRoutingPoliciesApi.list })
  const { data: dps } = useQuery({ queryKey: ['dial-plans'], queryFn: dialPlansApi.list })

  const createVrpMutation = useMutation({
    mutationFn: voiceRoutingPoliciesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['voice-routing-policies'] }); setShowAddVrp(false); setVrpForm({ name: '', description: '' }) },
  })
  const createDpMutation = useMutation({
    mutationFn: dialPlansApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dial-plans'] }); setShowAddDp(false); setDpForm({ name: '', description: '' }) },
  })
  const deleteVrpMutation = useMutation({
    mutationFn: voiceRoutingPoliciesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voice-routing-policies'] }),
  })
  const deleteDpMutation = useMutation({
    mutationFn: dialPlansApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dial-plans'] }),
  })

  return (
    <div className="space-y-8">
      {/* Voice Routing Policies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Voice Routing Policies</h2>
          {isAdmin && (
            <button onClick={() => setShowAddVrp(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />Add Policy
            </button>
          )}
        </div>
        {showAddVrp && isAdmin && (
          <div className="card border-primary-500/30 bg-primary-500/5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Name *</label><input type="text" className="input" value={vrpForm.name} onChange={(e) => setVrpForm({ ...vrpForm, name: e.target.value })} /></div>
              <div><label className="label">Description</label><input type="text" className="input" value={vrpForm.description} onChange={(e) => setVrpForm({ ...vrpForm, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => createVrpMutation.mutate(vrpForm)} className="btn btn-primary" disabled={!vrpForm.name}>Create</button>
              <button onClick={() => setShowAddVrp(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead><tr className="border-b border-surface-600"><th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Name</th><th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Description</th>{isAdmin && <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Actions</th>}</tr></thead>
            <tbody>
              {vrps?.map((vrp) => (
                <tr key={vrp.id} className="border-b border-surface-700 last:border-0">
                  <td className="px-4 py-3 text-zinc-200">{vrp.name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">{vrp.description || '-'}</td>
                  {isAdmin && <td className="px-4 py-3 text-right"><button onClick={() => { if (confirm(`Delete "${vrp.name}"?`)) deleteVrpMutation.mutate(vrp.id) }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button></td>}
                </tr>
              ))}
              {(!vrps || vrps.length === 0) && <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-500">No voice routing policies configured</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dial Plans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Dial Plans</h2>
          {isAdmin && (
            <button onClick={() => setShowAddDp(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />Add Dial Plan
            </button>
          )}
        </div>
        {showAddDp && isAdmin && (
          <div className="card border-primary-500/30 bg-primary-500/5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Name *</label><input type="text" className="input" value={dpForm.name} onChange={(e) => setDpForm({ ...dpForm, name: e.target.value })} /></div>
              <div><label className="label">Description</label><input type="text" className="input" value={dpForm.description} onChange={(e) => setDpForm({ ...dpForm, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => createDpMutation.mutate(dpForm)} className="btn btn-primary" disabled={!dpForm.name}>Create</button>
              <button onClick={() => setShowAddDp(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        )}
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead><tr className="border-b border-surface-600"><th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Name</th><th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Description</th>{isAdmin && <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Actions</th>}</tr></thead>
            <tbody>
              {dps?.map((dp) => (
                <tr key={dp.id} className="border-b border-surface-700 last:border-0">
                  <td className="px-4 py-3 text-zinc-200">{dp.name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">{dp.description || '-'}</td>
                  {isAdmin && <td className="px-4 py-3 text-right"><button onClick={() => { if (confirm(`Delete "${dp.name}"?`)) deleteDpMutation.mutate(dp.id) }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button></td>}
                </tr>
              ))}
              {(!dps || dps.length === 0) && <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-500">No dial plans configured</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============ EMAIL TAB ============
function EmailTab() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState({ host: '', port: 25, from_address: '', enabled: false })
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const { data: setting } = useQuery({
    queryKey: ['settings', 'email_relay'],
    queryFn: () => settingsApi.get('email_relay').catch(() => null),
  })

  // Load initial values from setting
  if (setting && !loaded) {
    const val = setting.value as { host?: string; port?: number; from_address?: string; enabled?: boolean }
    setConfig({ host: val.host || '', port: val.port || 25, from_address: val.from_address || '', enabled: val.enabled || false })
    setLoaded(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.update('email_relay', config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'email_relay'] }),
  })

  const testMutation = useMutation({
    mutationFn: () =>
      import('../services/api').then((mod) =>
        mod.default.post('/settings/email-relay/test', { config, test_to: testEmail }).then((r) => r.data)
      ),
    onSuccess: (data: { success: boolean; error?: string }) => setTestResult(data),
    onError: () => setTestResult({ success: false, error: 'Failed to send test email' }),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Email Relay Configuration</h2>
      <p className="text-sm text-zinc-500">Configure SMTP relay for notification emails. Uses anonymous authentication.</p>

      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Host</label>
            <input type="text" className="input" value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="smtp.example.com" disabled={!isAdmin} />
          </div>
          <div>
            <label className="label">SMTP Port</label>
            <input type="number" className="input" value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 25 })}
              disabled={!isAdmin} />
          </div>
        </div>
        <div>
          <label className="label">From Address</label>
          <input type="email" className="input max-w-sm" value={config.from_address}
            onChange={(e) => setConfig({ ...config, from_address: e.target.value })}
            placeholder="portflow@example.com" disabled={!isAdmin} />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500"
            checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} disabled={!isAdmin} />
          <span className="text-zinc-200">Enable email notifications</span>
        </div>

        {isAdmin && (
          <div className="flex gap-2 pt-4 border-t border-surface-600">
            <button onClick={() => saveMutation.mutate()} className="btn btn-primary"
              disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        )}
      </div>

      {/* Test Email */}
      {isAdmin && (
        <div className="card space-y-4">
          <h3 className="font-medium text-zinc-100">Test Email</h3>
          <div className="flex gap-2">
            <input type="email" className="input max-w-sm" value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            <button onClick={() => testMutation.mutate()} className="btn btn-secondary"
              disabled={!testEmail || testMutation.isPending}>
              {testMutation.isPending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
          {testResult && (
            <div className={`p-3 rounded-lg border text-sm ${
              testResult.success
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {testResult.success ? 'Test email sent successfully!' : `Failed: ${testResult.error}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ AUDIT LOG TAB ============
function AuditLogTab() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters, page],
    queryFn: () => auditApi.list({ ...filters, page, limit }),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Audit Log</h2>

      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <label className="label">Action</label>
          <input type="text" className="input w-48" value={filters.action}
            onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1) }}
            placeholder="Filter by action..." />
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input" value={filters.from}
            onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1) }} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input" value={filters.to}
            onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1) }} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-zinc-500">Loading...</div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-600">
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Timestamp</th>
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Actor</th>
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Action</th>
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Migration</th>
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {data?.entries?.map((entry) => (
                  <tr key={entry.id} className="border-b border-surface-700 last:border-0">
                    <td className="px-4 py-3 text-zinc-400 text-sm whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-200 text-sm">{entry.actor_name || entry.actor_email || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">{entry.migration_name || '-'}</td>
                    <td className="px-4 py-3 text-zinc-500 text-sm max-w-xs truncate">{entry.details || '-'}</td>
                  </tr>
                ))}
                {(!data?.entries || data.entries.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No audit entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">{data.total} total entries</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn btn-secondary text-sm disabled:opacity-50">Previous</button>
                <span className="text-sm text-zinc-400 py-2">Page {page} of {Math.ceil(data.total / limit)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= data.total}
                  className="btn btn-secondary text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
