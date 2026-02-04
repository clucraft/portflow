import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, Plus, Trash2, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'
import { publicApi } from '../services/api'

interface UserRow {
  display_name: string
  upn: string
  phone_number: string
  department: string
}

export default function CustomerCollect() {
  const { token } = useParams<{ token: string }>()
  const [users, setUsers] = useState<UserRow[]>([
    { display_name: '', upn: '', phone_number: '', department: '' },
  ])
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number; errors: { row: number; error: string }[] } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['collect', token],
    queryFn: () => publicApi.getCollectPage(token!),
    enabled: !!token,
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: () => publicApi.submitUsers(token!, users.filter(u => u.display_name && u.upn)),
    onSuccess: (data) => {
      setResults(data)
      setSubmitted(true)
    },
  })

  const addRow = () => {
    setUsers([...users, { display_name: '', upn: '', phone_number: '', department: '' }])
  }

  const removeRow = (index: number) => {
    if (users.length > 1) {
      setUsers(users.filter((_, i) => i !== index))
    }
  }

  const updateRow = (index: number, field: keyof UserRow, value: string) => {
    const newUsers = [...users]
    newUsers[index][field] = value
    setUsers(newUsers)
  }

  const validRows = users.filter(u => u.display_name && u.upn).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-600">
            This link is no longer valid. Please contact your administrator for a new link.
          </p>
        </div>
      </div>
    )
  }

  if (submitted && results) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Data Submitted Successfully</h1>
          <p className="text-gray-600 mb-4">
            {results.success} user(s) submitted successfully.
            {results.failed > 0 && ` ${results.failed} failed.`}
          </p>
          {results.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4 text-left text-sm">
              <p className="font-medium text-red-800 mb-2">Errors:</p>
              {results.errors.map((e, i) => (
                <p key={i} className="text-red-600">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500 mt-4">
            You can close this window. Your administrator will be notified.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Phone className="h-8 w-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">PortFlow</h1>
          </div>
          <h2 className="text-xl text-gray-700 mb-1">User Data Collection</h2>
          <p className="text-gray-600">
            <strong>{data.migration.site_name}</strong> - {data.migration.name}
          </p>
        </div>

        {/* Instructions */}
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Instructions</p>
              <ul className="text-blue-800 space-y-1">
                <li>• Enter each user who needs a phone number assigned</li>
                <li>• <strong>Display Name</strong>: User's full name as it appears in your organization</li>
                <li>• <strong>UPN (Email)</strong>: User's Microsoft 365 email address</li>
                <li>• <strong>Phone Number</strong>: Must be in E.164 format (e.g., +12125551234)</li>
                <li>• Department is optional but helps with organization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Existing Users */}
        {data.users && data.users.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-medium mb-3">Previously Submitted Users ({data.users.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">UPN</th>
                    <th className="text-left py-2">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100">
                      <td className="py-2">{user.display_name}</td>
                      <td className="py-2 text-gray-600">{user.upn}</td>
                      <td className="py-2 font-mono text-gray-600">{user.phone_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Entry Form */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Add Users</h3>
            <button onClick={addRow} className="btn btn-secondary text-sm flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Display Name *</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">UPN (Email) *</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Phone Number</th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Department</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="John Smith"
                        value={user.display_name}
                        onChange={(e) => updateRow(index, 'display_name', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="email"
                        className="input text-sm"
                        placeholder="john.smith@company.com"
                        value={user.upn}
                        onChange={(e) => updateRow(index, 'upn', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="tel"
                        className="input text-sm font-mono"
                        placeholder="+12125551234"
                        value={user.phone_number}
                        onChange={(e) => updateRow(index, 'phone_number', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Sales"
                        value={user.department}
                        onChange={(e) => updateRow(index, 'department', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => removeRow(index)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        disabled={users.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-600">
              {validRows} valid row(s) ready to submit
            </p>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={validRows === 0 || submitMutation.isPending}
              className="btn btn-primary"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Users'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>This is a secure data collection form for {data.migration.site_name}.</p>
          <p>Questions? Contact your IT administrator.</p>
        </div>
      </div>
    </div>
  )
}
