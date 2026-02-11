import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Calendar, Users, Phone, CheckCircle, Clock, Zap, Search, Bell } from 'lucide-react'
import { migrationsApi, carriersApi, notificationsApi, WORKFLOW_STAGES, type WorkflowStage } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

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

export default function Dashboard() {
  const { canWrite } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

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

  // Filter by search query (site name or project name)
  const filterBySearch = (m: { name: string; site_name: string }) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(query) || m.site_name.toLowerCase().includes(query)
  }

  const activeMigrations = migrations?.filter((m) =>
    !['completed', 'cancelled', 'on_hold'].includes(m.workflow_stage) && filterBySearch(m)
  ) || []

  const completedCount = migrations?.filter((m) => m.workflow_stage === 'completed').length || 0
  const totalUsers = migrations?.reduce((sum, m) => sum + m.telephone_users, 0) || 0

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
          <h1 className="text-2xl font-bold text-zinc-100">EV Migrations Dashboard</h1>
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
            <Link to="/new" className="btn btn-primary flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Migration
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="space-y-4">
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
                  className="block p-4 bg-surface-700/50 border border-surface-600 rounded-lg hover:border-primary-500/50 hover:bg-surface-700 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
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
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${stageBadgeStyles[migration.workflow_stage]}`}>
                        {stageLabel}
                      </span>
                      <p className="text-xs text-zinc-500 mt-1">
                        {migration.telephone_users} users • {migration.target_carrier}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative">
                    <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageColors[migration.workflow_stage]} transition-all duration-500`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {/* Stage dots */}
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

                  {/* Key dates */}
                  <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                    {migration.scheduled_port_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Port: {new Date(migration.scheduled_port_date).toLocaleDateString()}
                      </span>
                    )}
                    {migration.foc_date && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        FOC: {new Date(migration.foc_date).toLocaleDateString()}
                      </span>
                    )}
                    {!migration.scheduled_port_date && !migration.foc_date && migration.verizon_request_submitted_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatCarrierName(migration.target_carrier)} submitted: {new Date(migration.verizon_request_submitted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Recently Completed */}
      {completedCount > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recently Completed</h2>
          <div className="space-y-2">
            {migrations
              ?.filter(m => m.workflow_stage === 'completed' && filterBySearch(m))
              .slice(0, 5)
              .map(m => (
                <Link
                  key={m.id}
                  to={`/migrations/${m.id}`}
                  className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
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
    </div>
  )
}
