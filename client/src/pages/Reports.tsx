import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, Calendar, Users, CheckCircle, TrendingUp } from 'lucide-react'
import { migrationsApi } from '../services/api'

// Format carrier name for display
function formatCarrierName(carrier: string): string {
  const names: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  }
  return names[carrier?.toLowerCase()] || carrier || 'Carrier'
}

// Get phase name from workflow stage
function getPhaseFromStage(stage: string): string {
  if (stage === 'estimate') return 'Cost Estimate'
  if (['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(stage)) return 'Carrier Setup'
  if (['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(stage)) return 'Number Porting'
  if (['porting_complete', 'user_config'].includes(stage)) return 'Teams Config'
  if (stage === 'completed') return 'Completed'
  return stage
}

export default function Reports() {
  const { data: migrations, isLoading } = useQuery({
    queryKey: ['migrations', 'dashboard'],
    queryFn: migrationsApi.dashboard,
  })

  if (isLoading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>
  }

  // Calculate summary data
  const activeMigrations = migrations?.filter(m => !['completed', 'cancelled'].includes(m.workflow_stage)) || []
  const completedMigrations = migrations?.filter(m => m.workflow_stage === 'completed') || []

  // Count by phase
  const byPhase = {
    estimate: activeMigrations.filter(m => m.workflow_stage === 'estimate').length,
    carrierSetup: activeMigrations.filter(m => ['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(m.workflow_stage)).length,
    porting: activeMigrations.filter(m => ['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(m.workflow_stage)).length,
    teamsConfig: activeMigrations.filter(m => ['porting_complete', 'user_config'].includes(m.workflow_stage)).length,
  }

  // Upcoming ports (next 30 days)
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcomingPorts = activeMigrations
    .filter(m => m.scheduled_port_date && new Date(m.scheduled_port_date) >= now && new Date(m.scheduled_port_date) <= thirtyDaysFromNow)
    .sort((a, b) => new Date(a.scheduled_port_date!).getTime() - new Date(b.scheduled_port_date!).getTime())

  // Recently completed (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentlyCompleted = completedMigrations
    .filter(m => m.completed_at && new Date(m.completed_at) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())

  // Total users across active migrations
  const totalActiveUsers = activeMigrations.reduce((sum, m) => sum + m.telephone_users, 0)
  const totalCompletedUsers = completedMigrations.reduce((sum, m) => sum + m.telephone_users, 0)

  // Export functions
  const exportActiveMigrations = () => {
    const headers = ['Project Name', 'Site Name', 'Carrier', 'Routing Type', 'Phase', 'Status', 'Users', 'Submitted Date', 'FOC Date', 'Port Date']
    const rows = activeMigrations.map(m => [
      m.name,
      m.site_name,
      formatCarrierName(m.target_carrier),
      m.routing_type.replace('_', ' '),
      getPhaseFromStage(m.workflow_stage),
      m.workflow_stage.replace('_', ' '),
      m.telephone_users,
      m.verizon_request_submitted_at ? new Date(m.verizon_request_submitted_at).toLocaleDateString() : '',
      m.foc_date ? new Date(m.foc_date).toLocaleDateString() : '',
      m.scheduled_port_date ? new Date(m.scheduled_port_date).toLocaleDateString() : '',
    ])

    downloadCSV(headers, rows, 'active-migrations.csv')
  }

  const exportCompletedMigrations = () => {
    const headers = ['Project Name', 'Site Name', 'Carrier', 'Routing Type', 'Users', 'Created Date', 'Completed Date']
    const rows = completedMigrations.map(m => [
      m.name,
      m.site_name,
      formatCarrierName(m.target_carrier),
      m.routing_type.replace('_', ' '),
      m.telephone_users,
      new Date(m.created_at).toLocaleDateString(),
      m.completed_at ? new Date(m.completed_at).toLocaleDateString() : '',
    ])

    downloadCSV(headers, rows, 'completed-migrations.csv')
  }

  const downloadCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Reports</h1>
          <p className="text-zinc-500">Migration status summary and exports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportActiveMigrations}
            className="btn btn-secondary flex items-center gap-2"
            disabled={activeMigrations.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Active ({activeMigrations.length})
          </button>
          <button
            onClick={exportCompletedMigrations}
            className="btn btn-secondary flex items-center gap-2"
            disabled={completedMigrations.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Completed ({completedMigrations.length})
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30">
              <TrendingUp className="h-6 w-6 text-primary-400" />
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
              <p className="text-sm text-zinc-500">Completed (All Time)</p>
              <p className="text-2xl font-bold text-zinc-100">{completedMigrations.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Users (Active)</p>
              <p className="text-2xl font-bold text-zinc-100">{totalActiveUsers}</p>
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
              <p className="text-2xl font-bold text-zinc-100">{upcomingPorts.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Phase */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Active by Phase</h2>
          </div>
          <div className="space-y-3">
            <PhaseBar label="Cost Estimate" count={byPhase.estimate} total={activeMigrations.length} color="bg-zinc-500" />
            <PhaseBar label="Carrier Setup" count={byPhase.carrierSetup} total={activeMigrations.length} color="bg-red-500" />
            <PhaseBar label="Number Porting" count={byPhase.porting} total={activeMigrations.length} color="bg-amber-500" />
            <PhaseBar label="Teams Config" count={byPhase.teamsConfig} total={activeMigrations.length} color="bg-purple-500" />
          </div>
        </div>

        {/* Upcoming Ports */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Upcoming Ports (30 days)</h2>
          </div>
          {upcomingPorts.length === 0 ? (
            <p className="text-zinc-500 text-sm">No ports scheduled in the next 30 days</p>
          ) : (
            <div className="space-y-2">
              {upcomingPorts.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-surface-700/50 rounded-lg">
                  <div>
                    <p className="text-zinc-200 font-medium">{m.name}</p>
                    <p className="text-zinc-500 text-xs">{m.site_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-mono text-sm">
                      {new Date(m.scheduled_port_date!).toLocaleDateString()}
                    </p>
                    <p className="text-zinc-500 text-xs">{m.telephone_users} users</p>
                  </div>
                </div>
              ))}
              {upcomingPorts.length > 5 && (
                <p className="text-zinc-500 text-xs text-center">+{upcomingPorts.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Recently Completed (30 days)</h2>
          </div>
          {recentlyCompleted.length === 0 ? (
            <p className="text-zinc-500 text-sm">No migrations completed in the last 30 days</p>
          ) : (
            <div className="space-y-2">
              {recentlyCompleted.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div>
                    <p className="text-zinc-200 font-medium">{m.name}</p>
                    <p className="text-zinc-500 text-xs">{m.site_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-mono text-sm">
                      {m.completed_at && new Date(m.completed_at).toLocaleDateString()}
                    </p>
                    <p className="text-zinc-500 text-xs">{m.telephone_users} users</p>
                  </div>
                </div>
              ))}
              {recentlyCompleted.length > 5 && (
                <p className="text-zinc-500 text-xs text-center">+{recentlyCompleted.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Users Summary */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">User Summary</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-surface-700/50 rounded-lg">
              <span className="text-zinc-400">Active Migration Users</span>
              <span className="text-2xl font-bold text-zinc-100">{totalActiveUsers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <span className="text-zinc-400">Completed Migration Users</span>
              <span className="text-2xl font-bold text-green-400">{totalCompletedUsers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-primary-500/10 rounded-lg border border-primary-500/20">
              <span className="text-zinc-400">Total Users (All Time)</span>
              <span className="text-2xl font-bold text-primary-400">{totalActiveUsers + totalCompletedUsers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Phase progress bar component
function PhaseBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200 font-mono">{count}</span>
      </div>
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
