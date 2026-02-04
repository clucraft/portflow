import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, FileCode, Check, X } from 'lucide-react'
import { usersApi, migrationsApi, scriptsApi } from '../services/api'

export default function Users() {
  const { id: migrationId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState({
    display_name: '',
    upn: '',
    phone_number: '',
    department: '',
  })

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
      setNewUser({ display_name: '', upn: '', phone_number: '', department: '' })
      setShowAddForm(false)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', { migration_id: migrationId }] })
    },
  })

  const generateScriptMutation = useMutation({
    mutationFn: () => scriptsApi.generateUserAssignments(migrationId!),
    onSuccess: () => {
      alert('Script generated! View it in the Scripts section.')
    },
  })

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const usersWithPhones = users?.filter(u => u.phone_number).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/migrations/${migrationId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600">{migration?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateScriptMutation.mutate()}
            disabled={usersWithPhones === 0 || generateScriptMutation.isPending}
            className="btn btn-secondary flex items-center gap-2"
          >
            <FileCode className="h-5 w-5" />
            Generate Script
          </button>
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
          <p className="text-sm text-gray-600">Total Users</p>
          <p className="text-2xl font-bold">{users?.length || 0}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-gray-600">With Phone Numbers</p>
          <p className="text-2xl font-bold">{usersWithPhones}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-gray-600">Configured in Teams</p>
          <p className="text-2xl font-bold">{users?.filter(u => u.is_configured).length || 0}</p>
        </div>
        <div className="card flex-1">
          <p className="text-sm text-gray-600">Via Customer Link</p>
          <p className="text-2xl font-bold">{users?.filter(u => u.entered_via_magic_link).length || 0}</p>
        </div>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="font-medium mb-4">Add New User</h3>
          <div className="grid grid-cols-4 gap-4">
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
                className="input font-mono"
                value={newUser.phone_number}
                onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
                placeholder="+12125551234"
              />
            </div>
            <div>
              <label className="label">Department</label>
              <input
                type="text"
                className="input"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                placeholder="Sales"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => addUserMutation.mutate()}
              disabled={!newUser.display_name || !newUser.upn || addUserMutation.isPending}
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
      <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
        Routing Type: <strong className="capitalize">{migration?.routing_type?.replace('_', ' ')}</strong>
        {migration?.routing_type === 'direct_routing' && ' - Numbers will be assigned via Direct Routing'}
        {migration?.routing_type === 'operator_connect' && ' - Numbers will be assigned via Operator Connect'}
      </div>

      {/* Users Table */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">UPN</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Phone Number</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Department</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Configured</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Source</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{user.display_name}</td>
                <td className="py-3 px-4 text-gray-600">{user.upn}</td>
                <td className="py-3 px-4 font-mono">
                  {user.phone_number || (
                    <span className="text-gray-400">Not assigned</span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-600">{user.department || '-'}</td>
                <td className="py-3 px-4">
                  {user.is_configured ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-gray-300" />
                  )}
                </td>
                <td className="py-3 px-4">
                  {user.entered_via_magic_link ? (
                    <span className="badge badge-blue">Customer</span>
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
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No users yet.</p>
            <p className="text-sm mt-1">Add users manually or share the customer link to collect data.</p>
          </div>
        )}
      </div>
    </div>
  )
}
