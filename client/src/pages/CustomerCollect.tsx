import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Plus, Trash2, CheckCircle, AlertCircle, HelpCircle, Upload, Download, Zap, Save } from 'lucide-react'
import { publicApi } from '../services/api'
import ParticleBackground from '../components/ParticleBackground'
import { validatePhoneNumber } from '../utils/phoneValidation'

interface UserRow {
  display_name: string
  upn: string
  phone_number: string
}

const CSV_TEMPLATE = `display_name,upn,phone_number
John Smith,john.smith@company.com,+12125551234
Jane Doe,jane.doe@company.com,+12125555678
Bob Wilson,bob.wilson@company.com,`

export default function CustomerCollect() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<UserRow[]>([
    { display_name: '', upn: '', phone_number: '' },
  ])
  const [phoneErrors, setPhoneErrors] = useState<(string | null)[]>([null])
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number; errors: { row: number; error: string }[] } | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['collect', token],
    queryFn: () => publicApi.getCollectPage(token!),
    enabled: !!token,
    retry: false,
  })

  const isCollectionComplete = data?.migration?.user_data_collection_complete === true

  // Populate form rows with existing magic-link users on initial load (draft mode only)
  useEffect(() => {
    if (!data || initialLoadDone || isCollectionComplete) return
    const magicLinkUsers = data.users?.filter(u => u.entered_via_magic_link) || []
    if (magicLinkUsers.length > 0) {
      const rows: UserRow[] = magicLinkUsers.map(u => ({
        display_name: u.display_name || '',
        upn: u.upn || '',
        phone_number: u.phone_number || '',
      }))
      setUsers(rows)
      // Validate phone numbers
      if (data.migration?.country_code) {
        const errors = rows.map(u => {
          if (u.phone_number) {
            const validation = validatePhoneNumber(u.phone_number, data.migration.country_code!)
            return validation.error || null
          }
          return null
        })
        setPhoneErrors(errors)
      } else {
        setPhoneErrors(rows.map(() => null))
      }
    }
    setInitialLoadDone(true)
  }, [data, initialLoadDone, isCollectionComplete])

  const saveDraftMutation = useMutation({
    mutationFn: () => publicApi.submitUsers(token!, users.filter(u => u.display_name && u.upn), false),
    onSuccess: () => {
      setDraftSaved(true)
      queryClient.invalidateQueries({ queryKey: ['collect', token] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => publicApi.submitUsers(token!, users.filter(u => u.display_name && u.upn), true),
    onSuccess: (data) => {
      setResults(data)
      setSubmitted(true)
    },
  })

  // Auto-dismiss draft saved banner after 5s
  useEffect(() => {
    if (!draftSaved) return
    const timer = setTimeout(() => setDraftSaved(false), 5000)
    return () => clearTimeout(timer)
  }, [draftSaved])

  const addRow = () => {
    setUsers([...users, { display_name: '', upn: '', phone_number: '' }])
    setPhoneErrors([...phoneErrors, null])
  }

  const removeRow = (index: number) => {
    if (users.length > 1) {
      setUsers(users.filter((_, i) => i !== index))
      setPhoneErrors(phoneErrors.filter((_, i) => i !== index))
    }
  }

  const updateRow = (index: number, field: keyof UserRow, value: string) => {
    const newUsers = [...users]
    newUsers[index][field] = value
    setUsers(newUsers)

    // Validate phone number if that field changed
    if (field === 'phone_number' && data?.migration?.country_code) {
      const validation = validatePhoneNumber(value, data.migration.country_code)
      const newPhoneErrors = [...phoneErrors]
      newPhoneErrors[index] = validation.error || null
      setPhoneErrors(newPhoneErrors)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
          setCsvError('CSV file must have a header row and at least one data row')
          return
        }

        const header = lines[0].toLowerCase().split(',').map(h => h.trim())
        const nameIdx = header.findIndex(h => h === 'display_name' || h === 'name' || h === 'displayname')
        const upnIdx = header.findIndex(h => h === 'upn' || h === 'email' || h === 'userprincipalname')
        const phoneIdx = header.findIndex(h => h === 'phone_number' || h === 'phone' || h === 'phonenumber')

        if (nameIdx === -1 || upnIdx === -1) {
          setCsvError('CSV must have "display_name" (or "name") and "upn" (or "email") columns')
          return
        }

        const newUsers: UserRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
          if (values[nameIdx] && values[upnIdx]) {
            newUsers.push({
              display_name: values[nameIdx] || '',
              upn: values[upnIdx] || '',
              phone_number: phoneIdx !== -1 ? values[phoneIdx] || '' : '',
            })
          }
        }

        if (newUsers.length === 0) {
          setCsvError('No valid user rows found in CSV')
          return
        }

        setUsers(newUsers)
        // Validate all phone numbers from CSV
        if (data?.migration?.country_code) {
          const errors = newUsers.map(u => {
            if (u.phone_number) {
              const validation = validatePhoneNumber(u.phone_number, data.migration.country_code!)
              return validation.error || null
            }
            return null
          })
          setPhoneErrors(errors)
        } else {
          setPhoneErrors(newUsers.map(() => null))
        }
      } catch {
        setCsvError('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const hasPhoneErrors = phoneErrors.some(e => e !== null)
  const validRows = users.filter(u => u.display_name && u.upn).length

  // Separate admin-added users from magic-link users
  const adminUsers = data?.users?.filter(u => !u.entered_via_magic_link) || []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center relative">
        <ParticleBackground />
        <div className="text-center relative z-10">
          <Zap className="h-8 w-8 text-primary-500 mx-auto animate-pulse" />
          <p className="mt-4 text-zinc-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative">
        <ParticleBackground />
        <div className="card max-w-md text-center relative z-10">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Invalid or Expired Link</h1>
          <p className="text-zinc-400">
            This link is no longer valid. Please contact your administrator for a new link.
          </p>
        </div>
      </div>
    )
  }

  // Success screen after final submit
  if (submitted && results) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative">
        <ParticleBackground />
        <div className="card max-w-md text-center relative z-10">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Data Submitted Successfully</h1>
          <p className="text-zinc-400 mb-4">
            {results.success} user(s) submitted successfully.
            {results.failed > 0 && ` ${results.failed} failed.`}
          </p>
          {results.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-left text-sm mb-4">
              <p className="font-medium text-red-400 mb-2">Errors:</p>
              {results.errors.map((e, i) => (
                <p key={i} className="text-red-300">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}
          <p className="text-sm text-zinc-500">
            You can close this window. Your administrator will be notified.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-900 py-8 px-4 relative">
      <ParticleBackground />
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="relative">
              <Phone className="h-8 w-8 text-primary-400" />
              <Zap className="h-3 w-3 text-primary-300 absolute -top-1 -right-1" />
            </div>
            <h1 className="text-2xl font-bold text-primary-400 text-glow">PortFlow</h1>
          </div>
          <h2 className="text-xl text-zinc-200 mb-1">User Data Collection</h2>
          <p className="text-zinc-400">
            <strong className="text-zinc-200">{data.migration.site_name}</strong> - {data.migration.name}
          </p>
        </div>

        {/* Draft saved banner */}
        {draftSaved && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <p className="text-green-300">Draft saved! You can close this tab and come back later.</p>
          </div>
        )}

        {/* Instructions */}
        <div className="card mb-6 bg-primary-500/10 border-primary-500/30">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-primary-400 mb-2">Instructions</p>
              <ul className="text-zinc-300 space-y-1">
                <li>Enter each user who needs a phone number assigned in Microsoft Teams</li>
                <li><strong className="text-zinc-100">Display Name</strong>: User's full name as it appears in your organization</li>
                <li><strong className="text-zinc-100">UPN (Email)</strong>: User's Microsoft 365 email address (required)</li>
                <li><strong className="text-zinc-100">Phone Number</strong>: Must be in E.164 format starting with <strong className="text-primary-400 font-mono">{data?.migration?.country_code || '+1'}</strong> (e.g., {data?.migration?.country_code || '+1'}2125551234)</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-primary-500/30">
                <p className="text-zinc-400 mb-2">You can also upload a CSV file with the columns: display_name, upn, phone_number</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin-added users (always read-only) */}
        {adminUsers.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-medium text-zinc-100 mb-3">Admin-Added Users ({adminUsers.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-600">
                    <th className="text-left py-2 text-zinc-500">Name</th>
                    <th className="text-left py-2 text-zinc-500">UPN</th>
                    <th className="text-left py-2 text-zinc-500">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="border-b border-surface-700">
                      <td className="py-2 text-zinc-200">{user.display_name}</td>
                      <td className="py-2 text-zinc-400">{user.upn}</td>
                      <td className="py-2 font-mono text-zinc-400">{user.phone_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submitted mode: show all users read-only, then form for adding more */}
        {isCollectionComplete && (
          <div className="card mb-6">
            <h3 className="font-medium text-zinc-100 mb-3">Submitted Users ({(data.users?.filter(u => u.entered_via_magic_link) || []).length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-600">
                    <th className="text-left py-2 text-zinc-500">Name</th>
                    <th className="text-left py-2 text-zinc-500">UPN</th>
                    <th className="text-left py-2 text-zinc-500">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.users?.filter(u => u.entered_via_magic_link) || []).map((user) => (
                    <tr key={user.id} className="border-b border-surface-700">
                      <td className="py-2 text-zinc-200">{user.display_name}</td>
                      <td className="py-2 text-zinc-400">{user.upn}</td>
                      <td className="py-2 font-mono text-zinc-400">{user.phone_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CSV Upload Section */}
        <div className="card mb-6">
          <h3 className="font-medium text-zinc-100 mb-3">Import from CSV</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
            <label className="btn btn-secondary flex items-center gap-2 text-sm cursor-pointer">
              <Upload className="h-4 w-4" />
              Upload CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          {csvError && (
            <p className="text-red-400 text-sm mt-2">{csvError}</p>
          )}
        </div>

        {/* Data Entry Form */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">
              {isCollectionComplete ? 'Add More Users' : 'Add Users'}
            </h3>
            <button onClick={addRow} className="btn btn-secondary text-sm flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-600">
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500 uppercase">Display Name *</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500 uppercase">UPN (Email) *</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500 uppercase">Phone Number</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={index} className="border-b border-surface-700">
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
                        className={`input text-sm font-mono ${phoneErrors[index] ? 'border-red-500 focus:border-red-500' : ''}`}
                        placeholder={data?.migration?.country_code ? `${data.migration.country_code}1234567890` : '+12125551234'}
                        value={user.phone_number}
                        onChange={(e) => updateRow(index, 'phone_number', e.target.value)}
                      />
                      {phoneErrors[index] && (
                        <p className="text-red-400 text-xs mt-1">{phoneErrors[index]}</p>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => removeRow(index)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
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

          <div className="mt-6 flex items-center justify-between pt-4 border-t border-surface-600">
            <div>
              <p className="text-sm text-zinc-400">
                {validRows} valid row(s) ready to submit
              </p>
              {hasPhoneErrors && (
                <p className="text-sm text-red-400">Please fix phone number errors before submitting</p>
              )}
            </div>
            <div className="flex gap-2">
              {/* Save Draft button - only in draft mode (not yet submitted) */}
              {!isCollectionComplete && (
                <button
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending || hasPhoneErrors}
                  className="btn btn-secondary flex items-center gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  <Save className="h-4 w-4" />
                  {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                </button>
              )}
              <button
                onClick={() => submitMutation.mutate()}
                disabled={validRows === 0 || submitMutation.isPending || hasPhoneErrors}
                className="btn btn-primary"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Users'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-zinc-600">
          <p>This is a secure data collection form for {data.migration.site_name}.</p>
          <p className="mt-1">Powered by PortFlow - Enterprise Voice Migration Manager</p>
        </div>
      </div>
    </div>
  )
}
