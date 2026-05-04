import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, Upload, Search, Link2, ExternalLink, Trash2, X } from 'lucide-react'
import { locationsApi, type Location, type LocationStatus } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import ImportLocationsDialog from '../components/ImportLocationsDialog'
import NewLocationDialog from '../components/NewLocationDialog'

const STATUS_LABELS: Record<LocationStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  out_of_scope: 'Out of Scope',
}

const STATUS_BADGES: Record<LocationStatus, string> = {
  planned: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_hold: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  out_of_scope: 'bg-zinc-600/20 text-zinc-500 border-zinc-600/30',
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}

export default function Locations() {
  const { canWrite } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LocationStatus | ''>('')
  const [regionFilter, setRegionFilter] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => locationsApi.bulkRemove(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setSelected(new Set())
      setShowBulkConfirm(false)
    },
  })

  const filterOptions = useMemo(() => {
    const regions = new Set<string>()
    locations.forEach(l => { if (l.region) regions.add(l.region) })
    return { regions: Array.from(regions).sort() }
  }, [locations])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return locations.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false
      if (regionFilter && l.region !== regionFilter) return false
      if (q) {
        const hay = `${l.site_code} ${l.location_name} ${l.country || ''} ${l.company || ''} ${l.assigned_engineer || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [locations, search, statusFilter, regionFilter])

  const stats = useMemo(() => ({
    total: locations.length,
    completed: locations.filter(l => l.status === 'completed').length,
    in_progress: locations.filter(l => l.status === 'in_progress').length,
    planned: locations.filter(l => l.status === 'planned').length,
    on_hold: locations.filter(l => l.status === 'on_hold').length,
  }), [locations])

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(l => l.id)))
    }
  }

  const selectedLocations = locations.filter(l => selected.has(l.id))

  if (isLoading) {
    return <div className="text-center py-12 text-zinc-500">Loading locations...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary-400" />
            Locations
          </h1>
          <p className="text-zinc-500">Master list of all sites in the global Teams EV rollout</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import from Excel
            </button>
            <button onClick={() => setShowNew(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} color="primary" />
        <StatCard label="Completed" value={stats.completed} color="green" />
        <StatCard label="In Progress" value={stats.in_progress} color="amber" />
        <StatCard label="Planned" value={stats.planned} color="zinc" />
        <StatCard label="On Hold" value={stats.on_hold} color="zinc" />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && canWrite && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-300 font-medium">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="btn btn-secondary text-sm flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-500/50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search site, city, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-72"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LocationStatus | '')}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[140px]">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[120px]">
          <option value="">All regions</option>
          {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-sm text-zinc-500 ml-auto">
          {filtered.length} of {locations.length}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <MapPin className="h-12 w-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-500">No locations match your filters</p>
          {locations.length === 0 && canWrite && (
            <button onClick={() => setShowImport(true)} className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
              Import your master list to get started
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-700/50 border-b border-surface-600">
                {canWrite && (
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length
                      }}
                      onChange={toggleAll}
                      className="rounded border-surface-500 bg-surface-700 text-primary-500 focus:ring-primary-500"
                      title="Select all visible"
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Code</th>
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Location</th>
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Region</th>
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Status</th>
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Planned</th>
                <th className="px-3 py-2 text-right text-zinc-400 font-medium">Users</th>
                <th className="px-3 py-2 text-left text-zinc-400 font-medium">Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <LocationRow
                  key={l.id}
                  location={l}
                  selectable={canWrite}
                  selected={selected.has(l.id)}
                  onToggle={() => toggleOne(l.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden file input is handled inside ImportLocationsDialog */}
      <input ref={importInputRef} type="file" className="hidden" />

      {/* Bulk Delete Confirmation */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-800 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-surface-600 flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-zinc-100">Delete {selected.size} {selected.size === 1 ? 'Location' : 'Locations'}?</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-zinc-400">
                The following {selected.size === 1 ? 'location' : 'locations'} will be permanently deleted.
                Linked migration projects are <strong>not</strong> affected.
              </p>
              <div className="max-h-48 overflow-auto p-2 bg-surface-900/50 border border-surface-600 rounded text-xs font-mono space-y-0.5">
                {selectedLocations.map(l => (
                  <div key={l.id} className="text-zinc-300">
                    <span className="text-primary-400">{l.site_code}</span>
                    <span className="text-zinc-500 ml-2">{l.location_name}</span>
                  </div>
                ))}
              </div>
              {bulkDeleteMutation.isError && (
                <p className="text-sm text-red-400">Delete failed. Please try again.</p>
              )}
            </div>
            <div className="px-6 py-3 border-t border-surface-600 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkDeleteMutation.isPending}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
                disabled={bulkDeleteMutation.isPending}
                className="btn btn-primary bg-red-600 hover:bg-red-500 border-red-500 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportLocationsDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          onComplete={() => { refetch(); setShowImport(false) }}
        />
      )}

      {showNew && (
        <NewLocationDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          onComplete={() => { refetch(); setShowNew(false) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'primary' | 'green' | 'amber' | 'zinc' }) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-500/10 border-primary-500/30 text-primary-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    zinc: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
  }
  return (
    <div className={`p-3 border rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function LocationRow({ location: l, selectable, selected, onToggle }: {
  location: Location
  selectable: boolean
  selected: boolean
  onToggle: () => void
}) {
  const planned = [l.planned_start_date, l.planned_end_date].filter(Boolean) as string[]
  const plannedDisplay = planned.length === 2
    ? `${formatDate(planned[0])} → ${formatDate(planned[1])}`
    : planned.length === 1
    ? formatDate(planned[0])
    : '—'

  return (
    <tr className={`border-b border-surface-700 hover:bg-surface-700/30 transition-colors ${selected ? 'bg-primary-500/5' : ''}`}>
      {selectable && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="rounded border-surface-500 bg-surface-700 text-primary-500 focus:ring-primary-500"
          />
        </td>
      )}
      <td className="px-3 py-2">
        <Link to={`/locations/${l.id}`} className="font-mono font-semibold text-primary-400 hover:text-primary-300">
          {l.site_code}
        </Link>
      </td>
      <td className="px-3 py-2 text-zinc-200">
        {l.location_name}
        {l.country && <span className="text-zinc-500 ml-1.5">{l.country}</span>}
      </td>
      <td className="px-3 py-2 text-zinc-300">{l.region || '—'}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${STATUS_BADGES[l.status]}`}>
          {STATUS_LABELS[l.status]}
        </span>
      </td>
      <td className="px-3 py-2 text-zinc-400 text-xs">{plannedDisplay}</td>
      <td className="px-3 py-2 text-zinc-300 text-right font-mono">{l.estimated_users || '—'}</td>
      <td className="px-3 py-2">
        {l.migration_id ? (
          <Link to={`/migrations/${l.migration_id}`} className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
            <Link2 className="h-3 w-3" />
            {l.migration_name || 'Open project'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </td>
    </tr>
  )
}
