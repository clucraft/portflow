import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Save, Trash2, Link2, Unlink, Plus, ExternalLink } from 'lucide-react'
import { locationsApi, migrationsApi, type Location, type LocationStatus } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const STATUS_OPTIONS: { value: LocationStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'out_of_scope', label: 'Out of Scope' },
]

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canWrite } = useAuth()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<Partial<Location>>({})
  const [linkSearch, setLinkSearch] = useState('')

  const { data: location, isLoading } = useQuery({
    queryKey: ['location', id],
    queryFn: () => locationsApi.get(id!),
    enabled: !!id,
  })

  const { data: migrations = [] } = useQuery({
    queryKey: ['migrations'],
    queryFn: () => migrationsApi.list(),
  })

  useEffect(() => {
    if (location) {
      // Date columns come back as ISO timestamps ("2027-05-17T00:00:00.000Z")
      // but <input type="date"> needs bare YYYY-MM-DD. Truncate them here.
      const dateFields: (keyof Location)[] = [
        'planned_start_date', 'planned_end_date',
        'verizon_request_submitted_date', 'setup_complete_date',
        'kickoff_with_it_date', 'kickoff_complete_date',
        'port_scheduling_submitted_date', 'port_complete_date',
        'hypercare_start_date', 'hypercare_end_date',
      ]
      const normalized = { ...location } as Partial<Location>
      for (const f of dateFields) {
        const v = normalized[f]
        if (typeof v === 'string' && v.length >= 10) {
          (normalized[f] as string) = v.slice(0, 10)
        }
      }
      setForm(normalized)
    }
  }, [location])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Location>) => locationsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', id] })
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })

  const linkMutation = useMutation({
    mutationFn: (migration_id: string) => locationsApi.link(id!, migration_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', id] })
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setLinkSearch('')
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: () => locationsApi.unlink(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', id] })
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => locationsApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      navigate('/locations')
    },
  })

  if (isLoading) return <div className="text-center py-12 text-zinc-500">Loading...</div>
  if (!location) return <div className="text-center py-12 text-zinc-500">Location not found</div>

  const updateField = <K extends keyof Location>(field: K, value: Location[K]) => {
    setForm({ ...form, [field]: value })
  }

  const handleSave = () => {
    updateMutation.mutate(form)
  }

  const handleDelete = () => {
    if (confirm(`Delete location ${location.site_code}? This cannot be undone (the linked migration project, if any, is not affected).`)) {
      deleteMutation.mutate()
    }
  }

  const handleCreateProject = () => {
    // Navigate to NewMigration with prefilled data via state
    navigate('/new', { state: { fromLocation: location } })
  }

  const filteredMigrations = migrations.filter(m => {
    if (!linkSearch) return true
    const q = linkSearch.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.site_name || '').toLowerCase().includes(q)
  }).slice(0, 10)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/locations" className="p-2 hover:bg-surface-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200 mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary-400" />
            <h1 className="text-2xl font-bold text-zinc-100">
              <span className="font-mono">{location.site_code}</span>
              <span className="text-zinc-500 mx-2">—</span>
              <span>{location.location_name}</span>
            </h1>
          </div>
          {location.region && (
            <p className="text-sm text-zinc-500 mt-0.5">{location.region}{location.country && ` · ${location.country}`}</p>
          )}
        </div>
        {canWrite && (
          <button
            onClick={handleDelete}
            className="btn btn-secondary text-red-400 hover:text-red-300 hover:border-red-500/50"
            title="Delete location"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Linked migration card */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Linked Migration Project</h2>
        {location.migration_id ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link to={`/migrations/${location.migration_id}`}
                className="text-primary-400 hover:text-primary-300 font-medium inline-flex items-center gap-1.5">
                {location.migration_name || 'Open project'}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              {location.migration_workflow_stage && (
                <p className="text-xs text-zinc-500 mt-1 capitalize">
                  Current stage: {location.migration_workflow_stage.replace(/_/g, ' ')}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-0.5">
                Status auto-syncs from this project's workflow stage.
              </p>
            </div>
            {canWrite && (
              <button onClick={() => unlinkMutation.mutate()} className="btn btn-secondary text-sm flex items-center gap-2">
                <Unlink className="h-4 w-4" />
                Unlink
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">No project linked. Either create a new project from this location, or link an existing one.</p>
            {canWrite && (
              <div className="flex gap-2">
                <button onClick={handleCreateProject} className="btn btn-primary text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder="Or search and link existing project..."
                    className="input text-sm"
                  />
                  {linkSearch && filteredMigrations.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto bg-surface-800 border border-surface-600 rounded-lg shadow-xl z-10">
                      {filteredMigrations.map(m => (
                        <button
                          key={m.id}
                          onClick={() => linkMutation.mutate(m.id)}
                          className="w-full text-left px-3 py-2 hover:bg-surface-700 transition-colors flex items-center gap-2"
                        >
                          <Link2 className="h-3.5 w-3.5 text-primary-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-zinc-200 truncate">{m.name}</div>
                            <div className="text-xs text-zinc-500 truncate">{m.site_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Identity</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Site Code" value={form.site_code || ''} onChange={(v) => updateField('site_code', v)} mono disabled={!canWrite} />
          <Field label="Location Name" value={form.location_name || ''} onChange={(v) => updateField('location_name', v)} disabled={!canWrite} />
          <Field label="Region" value={form.region || ''} onChange={(v) => updateField('region', v)} placeholder="AMER / EMEA / APAC" disabled={!canWrite} />
          <Field label="Country" value={form.country || ''} onChange={(v) => updateField('country', v)} disabled={!canWrite} />
          <Field label="Company" value={form.company || ''} onChange={(v) => updateField('company', v)} disabled={!canWrite} />
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status || 'planned'}
              onChange={(e) => updateField('status', e.target.value as LocationStatus)}
              disabled={!canWrite || !!location.migration_id}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {location.migration_id && (
              <p className="text-xs text-zinc-500 mt-1">Auto-synced from linked project</p>
            )}
          </div>
        </div>
      </div>

      {/* Sizing & Triage */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Sizing &amp; Triage</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Estimated Users" type="number" value={String(form.estimated_users ?? '')} onChange={(v) => updateField('estimated_users', Number(v) || 0)} disabled={!canWrite} />
          <Field label="Priority" value={form.priority || ''} onChange={(v) => updateField('priority', v)} placeholder="High / Medium / Low" disabled={!canWrite} />
          <Field label="Complexity" value={form.complexity || ''} onChange={(v) => updateField('complexity', v)} placeholder="High / Medium / Low" disabled={!canWrite} />
        </div>
        <Field label="Complexity Reasons" value={form.complexity_reasons || ''} onChange={(v) => updateField('complexity_reasons', v)} textarea disabled={!canWrite} />
      </div>

      {/* Contacts */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Contacts</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Assigned Engineer" value={form.assigned_engineer || ''} onChange={(v) => updateField('assigned_engineer', v)} disabled={!canWrite} />
          <Field label="Local IT Contact" value={form.local_it_contact || ''} onChange={(v) => updateField('local_it_contact', v)} disabled={!canWrite} />
        </div>
      </div>

      {/* Dates */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Dates</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Planned Start" type="date" value={form.planned_start_date || ''} onChange={(v) => updateField('planned_start_date', v)} disabled={!canWrite} />
          <Field label="Planned End" type="date" value={form.planned_end_date || ''} onChange={(v) => updateField('planned_end_date', v)} disabled={!canWrite} />
          <Field label="Verizon Request Submitted" type="date" value={form.verizon_request_submitted_date || ''} onChange={(v) => updateField('verizon_request_submitted_date', v)} disabled={!canWrite} />
          <Field label="Setup Complete" type="date" value={form.setup_complete_date || ''} onChange={(v) => updateField('setup_complete_date', v)} disabled={!canWrite} />
          <Field label="Kick-off w/ Local IT" type="date" value={form.kickoff_with_it_date || ''} onChange={(v) => updateField('kickoff_with_it_date', v)} disabled={!canWrite} />
          <Field label="Kick-off Complete" type="date" value={form.kickoff_complete_date || ''} onChange={(v) => updateField('kickoff_complete_date', v)} disabled={!canWrite} />
          <Field label="Port Scheduling Submitted" type="date" value={form.port_scheduling_submitted_date || ''} onChange={(v) => updateField('port_scheduling_submitted_date', v)} disabled={!canWrite} />
          <Field label="Port Complete" type="date" value={form.port_complete_date || ''} onChange={(v) => updateField('port_complete_date', v)} disabled={!canWrite} />
          <Field label="Hypercare Start" type="date" value={form.hypercare_start_date || ''} onChange={(v) => updateField('hypercare_start_date', v)} disabled={!canWrite} />
          <Field label="Hypercare End (Ops)" type="date" value={form.hypercare_end_date || ''} onChange={(v) => updateField('hypercare_end_date', v)} disabled={!canWrite} />
        </div>
      </div>

      {/* Notes */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Notes</h2>
        <Field label="" value={form.notes || ''} onChange={(v) => updateField('notes', v)} textarea disabled={!canWrite} />
      </div>

      {/* Save bar */}
      {canWrite && (
        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-surface-900/95 backdrop-blur border-t border-surface-600 flex items-center justify-end gap-2">
          {updateMutation.isError && <span className="text-red-400 text-sm">Failed to save</span>}
          {updateMutation.isSuccess && <span className="text-green-400 text-sm">Saved</span>}
          <button onClick={handleSave} className="btn btn-primary flex items-center gap-2" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  textarea?: boolean
  mono?: boolean
  disabled?: boolean
}

function Field({ label, value, onChange, type = 'text', placeholder, textarea, mono, disabled }: FieldProps) {
  return (
    <div className={textarea ? 'col-span-full' : ''}>
      {label && <label className="label">{label}</label>}
      {textarea ? (
        <textarea className="input min-h-[80px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input
          type={type}
          className={`input ${mono ? 'font-mono' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </div>
  )
}
