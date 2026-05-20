import { useState, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, Upload, Search, Link2, ExternalLink, Trash2, X, Mail, ArrowUp, ArrowDown, ChevronsUpDown, MailCheck, StickyNote } from 'lucide-react'
import { locationsApi, type Location, type LocationStatus } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import ImportLocationsDialog from '../components/ImportLocationsDialog'
import NewLocationDialog from '../components/NewLocationDialog'
import SendKickoffEmailDialog from '../components/SendKickoffEmailDialog'
import MarkKickoffSentDialog from '../components/MarkKickoffSentDialog'
import { useDensityPreference, tableCellClasses, tableHeaderCellClasses, type Density } from '../hooks/useDensityPreference'

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

const STATUS_ORDER: Record<LocationStatus, number> = {
  planned: 1, in_progress: 2, completed: 3, on_hold: 4, cancelled: 5, out_of_scope: 6,
}

// Sort key for Priority/Complexity:
//  - Known levels (high/medium/low) sort first in priority order
//  - Unknown non-empty values sort alphabetically among themselves
//  - Empty values sort last
// Returns a string so React's sort comparator gives stable, readable ordering.
function levelKey(v: string | null): string {
  const t = (v || '').toLowerCase().trim()
  if (!t) return 'z9'                       // empty last
  if (t === 'high' || t === 'critical') return '1'
  if (t === 'medium' || t === 'med' || t === 'normal') return '2'
  if (t === 'low' || t === 'minor') return '3'
  return `5_${t}`                           // unknowns: stable alpha, between known and empty
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-zinc-400',
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}

type SortKey =
  | 'site_code' | 'location_name' | 'region' | 'status'
  | 'priority' | 'complexity' | 'planned' | 'users' | 'project'
  | 'kickoff_sent' | 'local_it_contact'
type SortDir = 'asc' | 'desc'

const VALID_SORT_KEYS: SortKey[] = [
  'site_code', 'location_name', 'region', 'status',
  'priority', 'complexity', 'planned', 'users', 'project',
  'kickoff_sent', 'local_it_contact',
]

export default function Locations() {
  const { canWrite } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [density] = useDensityPreference()
  const cellCls = tableCellClasses(density)
  const headerCls = tableHeaderCellClasses(density)

  // Filter/sort state backed by URL params so navigating to a location and
  // hitting back restores the exact view (search, filters, sort, page state).
  const search = searchParams.get('q') || ''
  const statusFilter = (searchParams.get('status') || '') as LocationStatus | ''
  const regionFilter = searchParams.get('region') || ''
  const itContactFilter = searchParams.get('it_contact') || ''
  const sortKey: SortKey = (VALID_SORT_KEYS as string[]).includes(searchParams.get('sort') || '')
    ? (searchParams.get('sort') as SortKey)
    : 'site_code'
  const sortDir: SortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc'

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const setSearch = (v: string) => setParam('q', v)
  const setStatusFilter = (v: LocationStatus | '') => setParam('status', v)
  const setRegionFilter = (v: string) => setParam('region', v)
  const setItContactFilter = (v: string) => setParam('it_contact', v)

  const [showImport, setShowImport] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showKickoff, setShowKickoff] = useState(false)
  const [showMarkKickoff, setShowMarkKickoff] = useState(false)
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
    const itContacts = new Set<string>()
    locations.forEach(l => {
      if (l.region) regions.add(l.region)
      if (l.local_it_contact) itContacts.add(l.local_it_contact)
    })
    return {
      regions: Array.from(regions).sort(),
      itContacts: Array.from(itContacts).sort((a, b) => a.localeCompare(b)),
    }
  }, [locations])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const matches = locations.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false
      if (regionFilter && l.region !== regionFilter) return false
      if (itContactFilter) {
        if (itContactFilter === '__missing__') {
          if (l.local_it_contact && l.local_it_contact.trim()) return false
        } else if (l.local_it_contact !== itContactFilter) {
          return false
        }
      }
      if (q) {
        const hay = `${l.site_code} ${l.location_name} ${l.country || ''} ${l.company || ''} ${l.assigned_engineer || ''} ${l.local_it_contact || ''} ${l.notes || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const compare = (a: Location, b: Location): number => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
        case 'site_code': av = a.site_code.toLowerCase(); bv = b.site_code.toLowerCase(); break
        case 'location_name': av = a.location_name.toLowerCase(); bv = b.location_name.toLowerCase(); break
        case 'region': av = (a.region || '').toLowerCase(); bv = (b.region || '').toLowerCase(); break
        case 'status': av = STATUS_ORDER[a.status] || 99; bv = STATUS_ORDER[b.status] || 99; break
        case 'priority': av = levelKey(a.priority); bv = levelKey(b.priority); break
        case 'complexity': av = levelKey(a.complexity); bv = levelKey(b.complexity); break
        case 'planned':
          av = a.planned_start_date ? new Date(a.planned_start_date).getTime() : 0
          bv = b.planned_start_date ? new Date(b.planned_start_date).getTime() : 0
          break
        case 'users': av = a.estimated_users || 0; bv = b.estimated_users || 0; break
        case 'project': av = a.migration_id ? 0 : 1; bv = b.migration_id ? 0 : 1; break
        case 'kickoff_sent':
          av = a.kickoff_email_sent_at ? new Date(a.kickoff_email_sent_at).getTime() : 0
          bv = b.kickoff_email_sent_at ? new Date(b.kickoff_email_sent_at).getTime() : 0
          break
        case 'local_it_contact':
          // Empty contacts sort last for both directions (~ sorts high in ASCII)
          av = (a.local_it_contact || '~').toLowerCase()
          bv = (b.local_it_contact || '~').toLowerCase()
          break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return a.site_code.localeCompare(b.site_code)
    }
    return [...matches].sort(compare)
  }, [locations, search, statusFilter, regionFilter, itContactFilter, sortKey, sortDir])

  const stats = useMemo(() => ({
    total: locations.length,
    completed: locations.filter(l => l.status === 'completed').length,
    in_progress: locations.filter(l => l.status === 'in_progress').length,
    planned: locations.filter(l => l.status === 'planned').length,
    on_hold: locations.filter(l => l.status === 'on_hold').length,
  }), [locations])

  const toggleSort = (key: SortKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (sortKey === key) {
        next.set('dir', sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        next.set('sort', key)
        next.set('dir', 'asc')
      }
      return next
    }, { replace: true })
  }

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKickoff(true)}
              className="btn btn-secondary text-sm flex items-center gap-2 text-primary-400 hover:text-primary-300 hover:border-primary-500/50"
              title="Send kick-off email to local IT contacts"
            >
              <Mail className="h-4 w-4" />
              Send Kick-off Email
            </button>
            <button
              onClick={() => setShowMarkKickoff(true)}
              className="btn btn-secondary text-sm flex items-center gap-2 text-green-400 hover:text-green-300 hover:border-green-500/50"
              title="Mark as kick-off sent without actually emailing (for backfilling manual outreach)"
            >
              <MailCheck className="h-4 w-4" />
              Mark Kick-off Sent
            </button>
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="btn btn-secondary text-sm flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-500/50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search site, city, company, contact, notes..."
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
        <select value={itContactFilter} onChange={(e) => setItContactFilter(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[180px] max-w-[260px]"
          title="Filter by Local IT Contact">
          <option value="">All IT contacts</option>
          <option value="__missing__">— Missing contact —</option>
          {filterOptions.itContacts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || statusFilter || regionFilter || itContactFilter) && (
          <button
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            title="Clear all filters and sorting"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
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
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-700/50 border-b border-surface-600">
                {canWrite && (
                  <th className={`${headerCls} w-10`}>
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
                <SortHeader label="Code" sortKey="site_code" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Location" sortKey="location_name" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Region" sortKey="region" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Priority" sortKey="priority" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Complexity" sortKey="complexity" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Planned" sortKey="planned" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Users" sortKey="users" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" headerCls={headerCls} />
                <SortHeader label="IT Contact" sortKey="local_it_contact" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <th className={`${headerCls} text-left text-zinc-400 font-medium`}>Notes</th>
                <SortHeader label="Kick-off" sortKey="kickoff_sent" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
                <SortHeader label="Project" sortKey="project" current={sortKey} dir={sortDir} onSort={toggleSort} headerCls={headerCls} />
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
                  density={density}
                  cellCls={cellCls}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {showKickoff && (
        <SendKickoffEmailDialog
          open={showKickoff}
          ids={Array.from(selected)}
          onClose={() => setShowKickoff(false)}
          onSent={() => { refetch() }}
        />
      )}

      {showMarkKickoff && (
        <MarkKickoffSentDialog
          open={showMarkKickoff}
          selectedLocations={selectedLocations}
          onClose={() => setShowMarkKickoff(false)}
          onComplete={() => { refetch() }}
        />
      )}
    </div>
  )
}

function SortHeader({ label, sortKey, current, dir, onSort, align, headerCls }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
  headerCls: string
}) {
  const isActive = current === sortKey
  return (
    <th className={`${headerCls} text-${align || 'left'} text-zinc-400 font-medium`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-zinc-200 transition-colors ${isActive ? 'text-zinc-200' : ''}`}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
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

function LocationRow({ location: l, selectable, selected, onToggle, density, cellCls }: {
  location: Location
  selectable: boolean
  selected: boolean
  onToggle: () => void
  density: Density
  cellCls: string
}) {
  const planned = [l.planned_start_date, l.planned_end_date].filter(Boolean) as string[]
  const plannedDisplay = planned.length === 2
    ? `${formatDate(planned[0])} → ${formatDate(planned[1])}`
    : planned.length === 1
    ? formatDate(planned[0])
    : '—'

  const priorityClass = PRIORITY_COLORS[(l.priority || '').toLowerCase()] || 'text-zinc-500'
  const complexityClass = PRIORITY_COLORS[(l.complexity || '').toLowerCase()] || 'text-zinc-500'
  // In compact mode, cellCls is already text-xs; in comfortable, override to xs for low-priority columns.
  const xsCell = density === 'compact' ? cellCls : `${cellCls.replace('text-sm', '')} text-xs`

  return (
    <tr className={`border-b border-surface-700 hover:bg-surface-700/30 transition-colors ${selected ? 'bg-primary-500/5' : ''}`}>
      {selectable && (
        <td className={cellCls} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="rounded border-surface-500 bg-surface-700 text-primary-500 focus:ring-primary-500"
          />
        </td>
      )}
      <td className={cellCls}>
        <Link to={`/locations/${l.id}`} className="font-mono font-semibold text-primary-400 hover:text-primary-300">
          {l.site_code}
        </Link>
      </td>
      <td className={`${cellCls} text-zinc-200`}>
        {l.location_name}
        {l.country && <span className="text-zinc-500 ml-1.5">{l.country}</span>}
      </td>
      <td className={`${cellCls} text-zinc-300`}>{l.region || '—'}</td>
      <td className={cellCls}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${STATUS_BADGES[l.status]}`}>
          {STATUS_LABELS[l.status]}
        </span>
      </td>
      <td className={`${cellCls} ${priorityClass}`}>{l.priority || '—'}</td>
      <td className={`${cellCls} ${complexityClass}`}>{l.complexity || '—'}</td>
      <td className={`${xsCell} text-zinc-400`}>{plannedDisplay}</td>
      <td className={`${cellCls} text-zinc-300 text-right font-mono`}>{l.estimated_users || '—'}</td>
      <td className={`${xsCell} text-zinc-300`}>
        {l.local_it_contact ? (
          <a
            href={`mailto:${l.local_it_contact}`}
            className="text-zinc-300 hover:text-primary-300 truncate inline-block max-w-[220px] align-middle"
            title={l.local_it_contact}
            onClick={(e) => e.stopPropagation()}
          >
            {l.local_it_contact}
          </a>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className={`${xsCell} text-zinc-400`}>
        {l.notes ? (
          <span
            className="inline-flex items-center gap-1.5 max-w-[260px] truncate align-middle"
            title={l.notes}
          >
            <StickyNote className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{l.notes}</span>
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className={cellCls}>
        {l.kickoff_email_sent_at ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs text-green-400"
            title={l.kickoff_email_sent_to ? `Sent to ${l.kickoff_email_sent_to}` : 'Kick-off marked as sent'}
          >
            <MailCheck className="h-3.5 w-3.5" />
            {formatDate(l.kickoff_email_sent_at)}
          </span>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </td>
      <td className={cellCls}>
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
