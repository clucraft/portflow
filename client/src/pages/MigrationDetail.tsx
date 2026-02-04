import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, FileCode, Copy, Check,
  DollarSign, Building, Phone, UserCheck, CheckCircle, Link2, ExternalLink
} from 'lucide-react'
import { migrationsApi, WORKFLOW_STAGES, type WorkflowStage } from '../services/api'

// Gantt chart phase groupings
const PHASES = [
  {
    name: 'Phase 1: Cost Estimate',
    stages: ['estimate', 'estimate_accepted'],
    color: 'bg-zinc-500',
    activeColor: 'bg-primary-500',
    completedColor: 'bg-green-500',
  },
  {
    name: 'Phase 2: Verizon Setup',
    stages: ['verizon_submitted', 'verizon_in_progress', 'verizon_complete'],
    color: 'bg-zinc-500',
    activeColor: 'bg-red-500',
    completedColor: 'bg-green-500',
  },
  {
    name: 'Phase 3: Number Porting',
    stages: ['porting_submitted', 'porting_scheduled', 'porting_complete'],
    color: 'bg-zinc-500',
    activeColor: 'bg-amber-500',
    completedColor: 'bg-green-500',
  },
  {
    name: 'Phase 4: Teams Config',
    stages: ['user_config', 'completed'],
    color: 'bg-zinc-500',
    activeColor: 'bg-purple-500',
    completedColor: 'bg-green-500',
  },
]

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

function getPhaseStatus(phase: typeof PHASES[0], currentStage: WorkflowStage): 'pending' | 'active' | 'completed' {
  const allStages = WORKFLOW_STAGES.map(s => s.stage)
  const currentIndex = allStages.indexOf(currentStage)
  const phaseFirstIndex = allStages.indexOf(phase.stages[0] as WorkflowStage)
  const phaseLastIndex = allStages.indexOf(phase.stages[phase.stages.length - 1] as WorkflowStage)

  if (currentIndex > phaseLastIndex) return 'completed'
  if (currentIndex >= phaseFirstIndex && currentIndex <= phaseLastIndex) return 'active'
  return 'pending'
}

function getStageInfo(stage: WorkflowStage) {
  return WORKFLOW_STAGES.find(s => s.stage === stage) || { label: stage, description: '' }
}

export default function MigrationDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [copiedEstimate, setCopiedEstimate] = useState(false)

  // Form states for each phase
  const [estimateForm, setEstimateForm] = useState({
    estimate_user_service_charge: 0,
    estimate_equipment_charge: 0,
    estimate_usage_charge: 0,
    estimate_notes: '',
  })

  const [verizonForm, setVerizonForm] = useState({
    billing_contact_name: '',
    billing_contact_email: '',
    billing_contact_phone: '',
    local_contact_name: '',
    local_contact_email: '',
    local_contact_phone: '',
    email_sent_to: '',
  })

  const [portingForm, setPortingForm] = useState({
    foc_date: '',
    scheduled_port_date: '',
  })

  const { data: migration, isLoading } = useQuery({
    queryKey: ['migration', id],
    queryFn: () => migrationsApi.get(id!),
    enabled: !!id,
  })

  // Mutations
  const updateEstimateMutation = useMutation({
    mutationFn: (data: typeof estimateForm) => migrationsApi.updateEstimate(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const acceptEstimateMutation = useMutation({
    mutationFn: () => migrationsApi.acceptEstimate(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const generateEstimateLinkMutation = useMutation({
    mutationFn: () => migrationsApi.generateEstimateLink(id!, 14),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const submitVerizonMutation = useMutation({
    mutationFn: () => migrationsApi.submitVerizonRequest(id!, verizonForm.email_sent_to),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const completeVerizonMutation = useMutation({
    mutationFn: () => migrationsApi.completeVerizonSetup(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const setFocMutation = useMutation({
    mutationFn: () => migrationsApi.setFocDate(id!, portingForm.foc_date, portingForm.scheduled_port_date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const completePortingMutation = useMutation({
    mutationFn: () => migrationsApi.completePorting(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const updateStageMutation = useMutation({
    mutationFn: (stage: WorkflowStage) => migrationsApi.updateStage(id!, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const copyEstimateLink = async () => {
    if (migration?.estimate_link_token) {
      await navigator.clipboard.writeText(`${window.location.origin}/estimate/${migration.estimate_link_token}`)
      setCopiedEstimate(true)
      setTimeout(() => setCopiedEstimate(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-pulse">
          <Phone className="h-8 w-8 text-primary-500" />
        </div>
        <p className="mt-2 text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!migration) {
    return <div className="text-center py-12 text-zinc-500">Migration not found</div>
  }

  const stageInfo = getStageInfo(migration.workflow_stage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-surface-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-100">{migration.name}</h1>
          <p className="text-zinc-500">
            {migration.site_name} • <span className="capitalize">{migration.target_carrier}</span> • <span className="capitalize">{migration.routing_type.replace('_', ' ')}</span>
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${stageBadgeStyles[migration.workflow_stage]}`}>
          {stageInfo.label}
        </span>
      </div>

      {/* Gantt-style Progress Chart */}
      <div className="card">
        <h2 className="font-semibold text-zinc-100 mb-4">Workflow Progress</h2>
        <div className="space-y-3">
          {PHASES.map((phase) => {
            const status = getPhaseStatus(phase, migration.workflow_stage)
            const barColor = status === 'completed' ? phase.completedColor : status === 'active' ? phase.activeColor : phase.color

            // Calculate progress within the phase
            let progressPct = 0
            if (status === 'completed') {
              progressPct = 100
            } else if (status === 'active') {
              const currentStageIndex = phase.stages.indexOf(migration.workflow_stage)
              progressPct = ((currentStageIndex + 0.5) / phase.stages.length) * 100
            }

            return (
              <div key={phase.name} className="flex items-center gap-4">
                <div className="w-40 flex-shrink-0">
                  <span className={`text-sm font-medium ${status === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                    {phase.name}
                  </span>
                </div>
                <div className="flex-1 relative">
                  <div className="h-6 bg-surface-700 rounded-lg overflow-hidden border border-surface-600">
                    <div
                      className={`h-full ${barColor} transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${progressPct}%`, minWidth: progressPct > 0 ? '20px' : '0' }}
                    >
                      {status === 'completed' && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </div>
                  {/* Stage markers */}
                  <div className="absolute top-0 left-0 w-full h-full flex">
                    {phase.stages.map((stage, i) => {
                      const stagePos = ((i + 1) / phase.stages.length) * 100
                      if (i === phase.stages.length - 1) return null
                      return (
                        <div
                          key={stage}
                          className="absolute top-0 bottom-0 w-px bg-surface-500/50"
                          style={{ left: `${stagePos}%` }}
                        />
                      )
                    })}
                  </div>
                </div>
                <div className="w-20 text-right">
                  {status === 'completed' && <span className="text-xs text-green-400">Complete</span>}
                  {status === 'active' && <span className="text-xs text-primary-400">Active</span>}
                  {status === 'pending' && <span className="text-xs text-zinc-600">Pending</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to={`/migrations/${id}/users`}
          className="card hover:border-primary-500/50 transition-colors flex items-center gap-3"
        >
          <Users className="h-6 w-6 text-purple-400" />
          <div>
            <p className="font-medium text-zinc-200">{migration.total_users} Users</p>
            <p className="text-xs text-zinc-500">{migration.configured_users} configured</p>
          </div>
        </Link>

        <Link to="/scripts" className="card hover:border-primary-500/50 transition-colors flex items-center gap-3">
          <FileCode className="h-6 w-6 text-green-400" />
          <div>
            <p className="font-medium text-zinc-200">Scripts</p>
            <p className="text-xs text-zinc-500">Generate PS scripts</p>
          </div>
        </Link>

        <div className="card flex items-center gap-3">
          <Phone className="h-6 w-6 text-amber-400" />
          <div>
            <p className="font-medium text-zinc-200">{migration.telephone_users} Users</p>
            <p className="text-xs text-zinc-500">{migration.physical_phones_needed} phones</p>
          </div>
        </div>

        <div className="card flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-green-400" />
          <div>
            <p className="font-medium text-zinc-200">${migration.estimate_total_monthly?.toFixed(0) || 0}/mo</p>
            <p className="text-xs text-zinc-500">${migration.estimate_total_onetime?.toFixed(0) || 0} one-time</p>
          </div>
        </div>
      </div>

      {/* Phase-specific cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase 1: Estimate */}
        <div className={`card ${migration.workflow_stage === 'estimate' ? 'ring-2 ring-primary-500/50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-400" />
            <h2 className="font-semibold text-zinc-100">Phase 1: Cost Estimate</h2>
            {migration.estimate_accepted_at && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {migration.workflow_stage === 'estimate' ? (
            <div className="space-y-3">
              <div>
                <label className="label">User Service Charge (Monthly)</label>
                <input
                  type="number"
                  className="input"
                  value={estimateForm.estimate_user_service_charge || ''}
                  onChange={(e) => setEstimateForm({ ...estimateForm, estimate_user_service_charge: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Equipment Charge (One-time)</label>
                <input
                  type="number"
                  className="input"
                  value={estimateForm.estimate_equipment_charge || ''}
                  onChange={(e) => setEstimateForm({ ...estimateForm, estimate_equipment_charge: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Usage Charge (Monthly)</label>
                <input
                  type="number"
                  className="input"
                  value={estimateForm.estimate_usage_charge || ''}
                  onChange={(e) => setEstimateForm({ ...estimateForm, estimate_usage_charge: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input min-h-[60px]"
                  value={estimateForm.estimate_notes}
                  onChange={(e) => setEstimateForm({ ...estimateForm, estimate_notes: e.target.value })}
                  placeholder="Additional notes for the estimate..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => updateEstimateMutation.mutate(estimateForm)}
                  className="btn btn-secondary"
                  disabled={updateEstimateMutation.isPending}
                >
                  Save
                </button>
                <button
                  onClick={() => generateEstimateLinkMutation.mutate()}
                  className="btn btn-secondary flex items-center gap-2"
                  disabled={generateEstimateLinkMutation.isPending}
                >
                  <Link2 className="h-4 w-4" />
                  Send to Customer
                </button>
                <button
                  onClick={() => acceptEstimateMutation.mutate()}
                  className="btn btn-primary"
                  disabled={acceptEstimateMutation.isPending}
                  title="Override: Accept estimate without customer approval"
                >
                  Accept (Override)
                </button>
              </div>

              {/* Estimate Link Display */}
              {migration.estimate_link_token && (
                <div className="mt-4 p-3 bg-primary-500/10 rounded-lg border border-primary-500/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-400 mb-1">Customer Estimate Link</p>
                      <code className="block text-xs text-zinc-400 truncate bg-surface-800 px-2 py-1 rounded">
                        {window.location.origin}/estimate/{migration.estimate_link_token}
                      </code>
                      {migration.estimate_link_expires_at && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Expires: {new Date(migration.estimate_link_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={copyEstimateLink}
                        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 rounded transition-colors"
                        title="Copy link"
                      >
                        {copiedEstimate ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <a
                        href={`/estimate/${migration.estimate_link_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 rounded transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Monthly Total:</span>
                <span className="text-zinc-200 font-mono">${migration.estimate_total_monthly?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">One-time Total:</span>
                <span className="text-zinc-200 font-mono">${migration.estimate_total_onetime?.toFixed(2) || '0.00'}</span>
              </div>
              {migration.estimate_accepted_at && (
                <p className="text-green-400 pt-2 border-t border-surface-600">
                  Accepted: {new Date(migration.estimate_accepted_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Phase 2: Verizon Setup */}
        <div className={`card ${['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(migration.workflow_stage) ? 'ring-2 ring-red-500/50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-zinc-100">Phase 2: Verizon Setup</h2>
            {migration.verizon_setup_complete_at && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {migration.workflow_stage === 'estimate_accepted' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Billing Contact Name</label>
                  <input
                    type="text"
                    className="input"
                    value={verizonForm.billing_contact_name}
                    onChange={(e) => setVerizonForm({ ...verizonForm, billing_contact_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Billing Contact Email</label>
                  <input
                    type="email"
                    className="input"
                    value={verizonForm.billing_contact_email}
                    onChange={(e) => setVerizonForm({ ...verizonForm, billing_contact_email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Verizon Email Sent To</label>
                <input
                  type="email"
                  className="input"
                  value={verizonForm.email_sent_to}
                  onChange={(e) => setVerizonForm({ ...verizonForm, email_sent_to: e.target.value })}
                  placeholder="verizon-rep@example.com"
                />
              </div>
              <button
                onClick={() => submitVerizonMutation.mutate()}
                className="btn btn-primary w-full"
                disabled={submitVerizonMutation.isPending}
              >
                Mark Verizon Request Submitted
              </button>
            </div>
          ) : ['verizon_submitted', 'verizon_in_progress'].includes(migration.workflow_stage) ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Submitted: {migration.verizon_request_submitted_at && new Date(migration.verizon_request_submitted_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-amber-400">Waiting for Verizon to complete setup (typically 1-2 weeks)</p>
              <button
                onClick={() => completeVerizonMutation.mutate()}
                className="btn btn-primary w-full"
                disabled={completeVerizonMutation.isPending}
              >
                Mark Verizon Setup Complete
              </button>
            </div>
          ) : migration.verizon_setup_complete_at ? (
            <p className="text-sm text-green-400">
              Completed: {new Date(migration.verizon_setup_complete_at).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Complete Phase 1 first</p>
          )}
        </div>

        {/* Phase 3: Porting */}
        <div className={`card ${['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(migration.workflow_stage) ? 'ring-2 ring-amber-500/50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Phone className="h-5 w-5 text-amber-400" />
            <h2 className="font-semibold text-zinc-100">Phase 3: Number Porting</h2>
            {migration.actual_port_date && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {!migration.is_porting_numbers ? (
            <p className="text-sm text-zinc-500">Not porting numbers - using new numbers from carrier</p>
          ) : migration.workflow_stage === 'verizon_complete' ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Submit LOA to Verizon for number porting</p>
              <button
                onClick={() => updateStageMutation.mutate('porting_submitted')}
                className="btn btn-primary w-full"
              >
                Mark LOA Submitted
              </button>
            </div>
          ) : migration.workflow_stage === 'porting_submitted' ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-400">Waiting for FOC (typically 17 business days)</p>
              <div>
                <label className="label">FOC Date</label>
                <input
                  type="date"
                  className="input"
                  value={portingForm.foc_date}
                  onChange={(e) => setPortingForm({ ...portingForm, foc_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Scheduled Port Date</label>
                <input
                  type="date"
                  className="input"
                  value={portingForm.scheduled_port_date}
                  onChange={(e) => setPortingForm({ ...portingForm, scheduled_port_date: e.target.value })}
                />
              </div>
              <button
                onClick={() => setFocMutation.mutate()}
                className="btn btn-primary w-full"
                disabled={!portingForm.foc_date || !portingForm.scheduled_port_date}
              >
                Set FOC & Port Date
              </button>
            </div>
          ) : migration.workflow_stage === 'porting_scheduled' ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">FOC: {migration.foc_date && new Date(migration.foc_date).toLocaleDateString()}</p>
              <p className="text-sm font-medium text-zinc-200">Port Date: {migration.scheduled_port_date && new Date(migration.scheduled_port_date).toLocaleDateString()}</p>
              <button
                onClick={() => completePortingMutation.mutate()}
                className="btn btn-primary w-full"
              >
                Mark Porting Complete
              </button>
            </div>
          ) : migration.actual_port_date ? (
            <p className="text-sm text-green-400">
              Ported: {new Date(migration.actual_port_date).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Complete Phase 2 first</p>
          )}
        </div>

        {/* Phase 4: User Configuration */}
        <div className={`card ${['porting_complete', 'user_config'].includes(migration.workflow_stage) ? 'ring-2 ring-purple-500/50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-zinc-100">Phase 4: Teams Configuration</h2>
            {migration.workflow_stage === 'completed' && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {['porting_complete', 'user_config'].includes(migration.workflow_stage) ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                {migration.total_users} users, {migration.configured_users} configured
              </p>
              <div className="flex gap-2">
                <Link to={`/migrations/${id}/users`} className="btn btn-secondary flex-1">
                  Manage Users
                </Link>
                <Link to="/scripts" className="btn btn-secondary flex-1">
                  Generate Script
                </Link>
              </div>
              <button
                onClick={() => updateStageMutation.mutate('completed')}
                className="btn btn-primary w-full"
              >
                Mark Migration Complete
              </button>
            </div>
          ) : migration.workflow_stage === 'completed' ? (
            <p className="text-sm text-green-400">Migration completed!</p>
          ) : (
            <p className="text-sm text-zinc-500">Complete previous phases first</p>
          )}
        </div>
      </div>
    </div>
  )
}
