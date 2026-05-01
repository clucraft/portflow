import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { locationsApi, type LocationStatus } from '../services/api'

interface Props {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export default function NewLocationDialog({ open, onClose, onComplete }: Props) {
  const [form, setForm] = useState({
    site_code: '',
    location_name: '',
    region: '',
    country: '',
    company: '',
    estimated_users: 0,
    status: 'planned' as LocationStatus,
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => locationsApi.create(form),
    onSuccess: () => onComplete(),
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err as Error)?.message
        || 'Failed to create location'
      setError(msg)
    },
  })

  if (!open) return null

  const handleSubmit = () => {
    setError('')
    if (!form.site_code.trim() || !form.location_name.trim()) {
      setError('Site Code and Location Name are required')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-semibold text-zinc-100">Add Location</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Site Code *</label>
              <input className="input font-mono" value={form.site_code}
                onChange={(e) => setForm({ ...form, site_code: e.target.value.toUpperCase() })}
                placeholder="DYT" />
            </div>
            <div>
              <label className="label">Location Name *</label>
              <input className="input" value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                placeholder="Dayton" />
            </div>
            <div>
              <label className="label">Region</label>
              <select className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                <option value="">— Auto-derive from country —</option>
                <option value="AMER">AMER</option>
                <option value="EMEA">EMEA</option>
                <option value="APAC">APAC</option>
              </select>
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="United States" />
            </div>
            <div className="col-span-2">
              <label className="label">Company</label>
              <input className="input" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Optional" />
            </div>
            <div>
              <label className="label">Estimated Users</label>
              <input type="number" className="input" value={form.estimated_users || ''}
                onChange={(e) => setForm({ ...form, estimated_users: Number(e.target.value) || 0 })}
                placeholder="0" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LocationStatus })}>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
                <option value="out_of_scope">Out of Scope</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-surface-600">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding...' : 'Add Location'}
          </button>
        </div>
      </div>
    </div>
  )
}
