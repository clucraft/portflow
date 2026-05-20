import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Calendar, Users, Phone, CheckCircle, Clock, Zap, Search, Bell, ArrowUpDown, X, Upload, PauseCircle, Workflow } from 'lucide-react'
import { migrationsApi, carriersApi, notificationsApi, WORKFLOW_STAGES, effectiveUserCount, type WorkflowStage, type Migration } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import ImportSurveyDialog from '../components/ImportSurveyDialog'
import { useDensityPreference } from '../hooks/useDensityPreference'

const stageColors: Record<string, string> = {
  estimate: 'bg-zinc-500',
  estimate_accepted: 'bg-primary-500',
  verizon_submitted: 'bg-red-500',
  verizon_in_progress: 'bg-red-500',
  verizon_complete: 'bg-red-500',
  porting_submitted: 'bg-amber-500',
  porting_scheduled: 'bg-amber-500',
  porting_complete: 'bg-amber-500',
  user_config: 'bg-purple-500',
  completed: 'bg-green-500',
  on_hold: 'bg-zinc-600',
}

const stageBadgeStyles: Record<string, string> = {
  estimate: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  estimate_accepted: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  verizon_submitted: 'bg-red-500/20 text-red-400 border-red-500/30',
  verizon_in_progress: 'bg-red-500/20 text-red-400 border-red-500/30',
  verizon_complete: 'bg-red-500/20 text-red-400 border-red-500/30',
  porting_submitted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  porting_scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  porting_complete: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  user_config: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_hold: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

function getStageInfo(stage: WorkflowStage) {
  return WORKFLOW_STAGES.find(s => s.stage === stage) || { label: stage, description: '' }
}

function getStageNumber(stage: WorkflowStage): number {
  const index = WORKFLOW_STAGES.findIndex(s => s.stage === stage)
  return index >= 0 ? index + 1 : 0
}

// Fallback carrier name formatting
function formatCarrierNameFallback(carrier: string): string {
  const names: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  }
  return names[carrier?.toLowerCase()] || carrier || 'Carrier'
}

// Relative time helper
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

type SortBy = 'updated' | 'created' | 'name'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { canWrite } = useAuth()
  const [showImport, setShowImport] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [density] = useDensityPreference()
  const isCompact = density === 'compact'
  const cardCls = isCompact ? 'block p-2.5 bg-surface-700/50 border border-surface-600 rounded-lg hover:border-primary-500/50 hover:bg-surface-700 transition-all duration-200' : 'block p-4 bg-surface-700/50 border border-surface-600 rounded-lg hover:border-primary-500/50 hover:bg-surface-700 transition-all duration-200'
  const innerSectionMb = isCompact ? 'mb-2' : 'mb-3'
  const listGap = isCompact ? 'space-y-2' : 'space-y-4'

  // Filter/sort state backed by URL params (persists across navigation)
  const searchQuery = searchParams.get('q') || ''
  const sortBy = (searchParams.get('sort') || 'updated') as SortBy
  const filterCreator = searchParams.get('creator') || ''
  const filterAssignee = searchParams.get('assignee') || ''
  const filterCarrier = searchParams.get('carrier') || ''
  const filterCountry = searchParams.get('country') || ''

  const setParam = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }
  const setSearchQuery = (v: string) => setParam('q', v)
  const setSortBy = (v: SortBy) => setParam('sort', v === 'updated' ? '' : v)
  const setFilterCreator = (v: string) => setParam('creator', v)
  const setFilterAssignee = (v: string) => setParam('assignee', v)
  const setFilterCarrier = (v: string) => setParam('carrier', v)
  const setFilterCountry = (v: string) => setParam('country', v)

  const { data: migrations, isLoading } = useQuery({
    queryKey: ['migrations', 'dashboard'],
    queryFn: migrationsApi.dashboard,
  })

  const { data: carriers } = useQuery({ queryKey: ['carriers'], queryFn: carriersApi.list })

  const { data: mySubscriptions } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: notificationsApi.getMySubscriptions,
  })

  const formatCarrierName = (carrier: string): string => {
    const found = carriers?.find(c => c.slug === carrier)
    return found?.display_name || formatCarrierNameFallback(carrier)
  }

  // Derive unique filter options from loaded data
  const filterOptions = useMemo(() => {
    if (!migrations) return { creators: [] as string[], assignees: [] as string[], countries: [] as string[] }
    const creators = [...new Set(migrations.map(m => m.created_by_name).filter(Boolean) as string[])].sort()
    const assignees = [...new Set(migrations.map(m => m.assigned_to_name).filter(Boolean) as string[])].sort()
    const countries = [...new Set(migrations.map(m => m.site_country).filter(Boolean))].sort()
    return { creators, assignees, countries }
  }, [migrations])

  const hasActiveFilters = filterCreator || filterAssignee || filterCarrier || filterCountry

  // Combined filter: search + dropdowns
  const filterMigration = (m: Migration) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      if (!m.name.toLowerCase().includes(query) && !m.site_name.toLowerCase().includes(query)) return false
    }
    if (filterCreator && m.created_by_name !== filterCreator) return false
    if (filterAssignee && m.assigned_to_name !== filterAssignee) return false
    if (filterCarrier && m.target_carrier !== filterCarrier) return false
    if (filterCountry && m.site_country !== filterCountry) return false
    return true
  }

  // Sort comparator
  const sortMigrations = (a: Migration, b: Migration) => {
    switch (sortBy) {
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  }

  const activeMigrations = useMemo(() =>
    (migrations?.filter((m) =>
      !['completed', 'cancelled', 'on_hold'].includes(m.workflow_stage) && filterMigration(m)
    ) || []).sort(sortMigrations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [migrations, searchQuery, sortBy, filterCreator, filterAssignee, filterCarrier, filterCountry]
  )

  const completedCount = migrations?.filter((m) => m.workflow_stage === 'completed').length || 0
  const onHoldCount = migrations?.filter((m) => m.workflow_stage === 'on_hold').length || 0

  const onHoldMigrations = useMemo(() =>
    (migrations?.filter((m) => m.workflow_stage === 'on_hold' && filterMigration(m)) || []).sort(sortMigrations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [migrations, searchQuery, sortBy, filterCreator, filterAssignee, filterCarrier, filterCountry]
  )
  const totalUsers = migrations?.reduce((sum, m) => sum + effectiveUserCount(m), 0) || 0

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-pulse">
          <Zap className="h-8 w-8 text-primary-500" />
        </div>
        <p className="mt-2 text-zinc-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <Workflow className="h-6 w-6 text-primary-400" />
            Migrations
          </h1>
          <p className="text-zinc-500">Track enterprise voice migration projects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search sites or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-64"
            />
          </div>
          {canWrite && (
            <>
              <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Survey
              </button>
              <Link to="/new" className="btn btn-primary flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Migration
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30">
              <Clock className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Active Migrations</p>
              <p className="text-2xl font-bold text-zinc-100">{activeMigrations.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Completed</p>
              <p className="text-2xl font-bold text-zinc-100">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <PauseCircle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">On Hold</p>
              <p className="text-2xl font-bold text-zinc-100">{onHoldCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Users</p>
              <p className="text-2xl font-bold text-zinc-100">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <Calendar className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Upcoming Ports</p>
              <p className="text-2xl font-bold text-zinc-100">
                {migrations?.filter(m => m.scheduled_port_date && !m.actual_port_date).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterCreator}
          onChange={(e) => setFilterCreator(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[140px]"
        >
          <option value="">All Creators</option>
          {filterOptions.creators.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[140px]"
        >
          <option value="">All Assignees</option>
          {filterOptions.assignees.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filterCarrier}
          onChange={(e) => setFilterCarrier(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[140px]"
        >
          <option value="">All Carriers</option>
          {carriers?.filter(c => c.is_active).map(c => (
            <option key={c.slug} value={c.slug}>{c.display_name}</option>
          ))}
        </select>

        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="input py-1.5 px-2.5 text-sm w-auto min-w-[140px]"
        >
          <option value="">All Countries</option>
          {filterOptions.countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => setSearchParams(prev => {
              const next = new URLSearchParams(prev)
              next.delete('creator')
              next.delete('assignee')
              next.delete('carrier')
              next.delete('country')
              return next
            }, { replace: true })}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="input py-1.5 px-2.5 text-sm w-auto"
          >
            <option value="updated">Last Updated</option>
            <option value="created">Created Date</option>
            <option value="name">Project Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Active Migrations with Progress */}
      <div className="card">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Active Migrations</h2>

        {activeMigrations.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="h-12 w-12 mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-500">No active migrations</p>
            <Link to="/new" className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
              Start a new migration
            </Link>
          </div>
        ) : (
          <div className={listGap}>
            {activeMigrations.map((migration) => {
              const stageInfo = getStageInfo(migration.workflow_stage)
              const carrierName = formatCarrierName(migration.target_carrier)
              const stageLabel = stageInfo.label.replace('Carrier', carrierName)
              const stageNum = getStageNumber(migration.workflow_stage)
              const progressPct = (stageNum / WORKFLOW_STAGES.length) * 100

              return (
                <Link
                  key={migration.id}
                  to={`/migrations/${migration.id}`}
                  className={cardCls}
                >
                  <div className={`flex items-start justify-between ${innerSectionMb}`}>
                    <div>
                      <h3 className="font-medium text-zinc-100 flex items-center gap-1.5">
                        {migration.name}
                        {mySubscriptions?.includes(migration.id) && (
                          <span title="Subscribed to notifications"><Bell className="h-3.5 w-3.5 text-primary-400" /></span>
                        )}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {migration.site_name}
                        {migration.site_city && `, ${migration.site_city}`}
                        {migration.site_state && `, ${migration.site_state}`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${stageBadgeStyles[migration.workflow_stage]}`}>
                      {stageLabel}
                    </span>
                  </div>

                  {/* Info pills */}
                  <div className={`flex flex-wrap gap-1.5 ${innerSectionMb}`}>
                    {migration.assigned_to_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-primary-500/10 border-primary-500/30 text-primary-400">
                        {migration.assigned_to_name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-red-500/10 border-red-500/30 text-red-400">
                      {carrierName}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-purple-500/10 border-purple-500/30 text-purple-400">
                      {effectiveUserCount(migration)} users
                    </span>
                    {migration.scheduled_port_date && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                        migration.actual_port_date
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        Port: {new Date(migration.scheduled_port_date).toLocaleDateString()}
                      </span>
                    )}
                    {migration.foc_date && !migration.scheduled_port_date && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-amber-500/10 border-amber-500/30 text-amber-400">
                        FOC: {new Date(migration.foc_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="relative">
                    <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageColors[migration.workflow_stage]} transition-all duration-500`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      {WORKFLOW_STAGES.map((stage, i) => (
                        <div
                          key={stage.stage}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i < stageNum ? stageColors[migration.workflow_stage] : 'bg-surface-600'
                          }`}
                          title={stage.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Created/updated meta */}
                  <div className="mt-2 text-xs text-zinc-600">
                    Created {new Date(migration.created_at).toLocaleDateString()} &bull; Updated {timeAgo(migration.updated_at)}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* On Hold */}
      {onHoldMigrations.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-400" />
            On Hold
          </h2>
          <div className="space-y-2">
            {onHoldMigrations.map(m => (
              <Link
                key={m.id}
                to={`/migrations/${m.id}`}
                className={`flex items-center justify-between ${isCompact ? 'p-1.5' : 'p-3'} bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-zinc-200">{m.name}</span>
                    <span className="text-zinc-500 text-sm ml-2">{m.site_name}</span>
                  </div>
                  {m.on_hold_reason && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{m.on_hold_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {m.on_hold_at && (
                    <span className="text-zinc-500 text-xs">
                      {new Date(m.on_hold_at).toLocaleDateString()}
                    </span>
                  )}
                  <PauseCircle className="h-4 w-4 text-amber-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed */}
      {completedCount > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recently Completed</h2>
          <div className="space-y-2">
            {migrations
              ?.filter(m => m.workflow_stage === 'completed' && filterMigration(m))
              .sort(sortMigrations)
              .slice(0, 5)
              .map(m => (
                <Link
                  key={m.id}
                  to={`/migrations/${m.id}`}
                  className={`flex items-center justify-between ${isCompact ? 'p-1.5' : 'p-3'} bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-zinc-200">{m.name}</span>
                    {mySubscriptions?.includes(m.id) && (
                      <span title="Subscribed to notifications"><Bell className="h-3.5 w-3.5 text-primary-400" /></span>
                    )}
                    <span className="text-zinc-500 text-sm ml-2">{m.site_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.completed_at && (
                      <span className="text-zinc-500 text-sm">
                        {new Date(m.completed_at).toLocaleDateString()}
                      </span>
                    )}
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      <ImportSurveyDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['migrations'] })}
      />
    </div>
  )
}
