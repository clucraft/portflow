import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Calendar, Users, Phone, CheckCircle, Clock } from 'lucide-react'
import { migrationsApi, WORKFLOW_STAGES, type WorkflowStage } from '../services/api'

const stageColors: Record<string, string> = {
  estimate: 'bg-gray-500',
  estimate_accepted: 'bg-blue-500',
  verizon_submitted: 'bg-yellow-500',
  verizon_in_progress: 'bg-yellow-500',
  verizon_complete: 'bg-green-500',
  porting_submitted: 'bg-orange-500',
  porting_scheduled: 'bg-orange-500',
  porting_complete: 'bg-green-500',
  user_config: 'bg-purple-500',
  completed: 'bg-green-600',
  on_hold: 'bg-red-500',
}

function getStageInfo(stage: WorkflowStage) {
  return WORKFLOW_STAGES.find(s => s.stage === stage) || { label: stage, description: '' }
}

function getStageNumber(stage: WorkflowStage): number {
  const index = WORKFLOW_STAGES.findIndex(s => s.stage === stage)
  return index >= 0 ? index + 1 : 0
}

export default function Dashboard() {
  const { data: migrations, isLoading } = useQuery({
    queryKey: ['migrations', 'dashboard'],
    queryFn: migrationsApi.dashboard,
  })

  const activeMigrations = migrations?.filter((m) =>
    !['completed', 'cancelled', 'on_hold'].includes(m.workflow_stage)
  ) || []

  const completedCount = migrations?.filter((m) => m.workflow_stage === 'completed').length || 0
  const totalUsers = migrations?.reduce((sum, m) => sum + m.telephone_users, 0) || 0

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EV Migrations Dashboard</h1>
          <p className="text-gray-600">Track enterprise voice migration projects</p>
        </div>
        <Link to="/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="h-5 w-5" />
          New Migration
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Migrations</p>
              <p className="text-2xl font-bold">{activeMigrations.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Upcoming Ports</p>
              <p className="text-2xl font-bold">
                {migrations?.filter(m => m.scheduled_port_date && !m.actual_port_date).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Migrations with Progress */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Active Migrations</h2>

        {activeMigrations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Phone className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>No active migrations</p>
            <Link to="/new" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
              Start a new migration
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMigrations.map((migration) => {
              const stageInfo = getStageInfo(migration.workflow_stage)
              const stageNum = getStageNumber(migration.workflow_stage)
              const progressPct = (stageNum / WORKFLOW_STAGES.length) * 100

              return (
                <Link
                  key={migration.id}
                  to={`/migrations/${migration.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{migration.name}</h3>
                      <p className="text-sm text-gray-600">
                        {migration.site_name}
                        {migration.site_city && `, ${migration.site_city}`}
                        {migration.site_state && `, ${migration.site_state}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white ${stageColors[migration.workflow_stage]}`}>
                        {stageInfo.label}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {migration.telephone_users} users • {migration.target_carrier}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageColors[migration.workflow_stage]} transition-all duration-500`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {/* Stage dots */}
                    <div className="flex justify-between mt-1">
                      {WORKFLOW_STAGES.map((stage, i) => (
                        <div
                          key={stage.stage}
                          className={`w-2 h-2 rounded-full ${
                            i < stageNum ? stageColors[migration.workflow_stage] : 'bg-gray-300'
                          }`}
                          title={stage.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Key dates */}
                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
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
                        Verizon submitted: {new Date(migration.verizon_request_submitted_at).toLocaleDateString()}
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
          <h2 className="text-lg font-semibold mb-4">Recently Completed</h2>
          <div className="space-y-2">
            {migrations
              ?.filter(m => m.workflow_stage === 'completed')
              .slice(0, 5)
              .map(m => (
                <Link
                  key={m.id}
                  to={`/migrations/${m.id}`}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{m.site_name}</span>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
