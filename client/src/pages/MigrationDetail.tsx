import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, FileCode, Copy, Check,
  DollarSign, Building, Phone, UserCheck, Link2, ExternalLink
} from 'lucide-react'
import { migrationsApi, WORKFLOW_STAGES, type WorkflowStage } from '../services/api'

// Phase definitions with their stages
// Phase 3 (Porting) and Phase 4 (Teams Config) can run in PARALLEL after Phase 2 completes
const BASE_PHASES = [
  { id: 1, name: 'Cost Estimate', stages: ['estimate'] as WorkflowStage[], icon: DollarSign, color: 'primary' },
  { id: 2, name: 'Carrier Setup', stages: ['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'] as WorkflowStage[], icon: Building, color: 'red' },
  { id: 3, name: 'Number Porting', stages: ['verizon_complete', 'porting_submitted', 'porting_scheduled', 'porting_complete'] as WorkflowStage[], icon: Phone, color: 'amber' },
  { id: 4, name: 'Teams Config', stages: ['user_config', 'completed'] as WorkflowStage[], icon: UserCheck, color: 'purple' },
]

// Stages where porting is complete (Phase 3 done)
const PORTING_COMPLETE_STAGES: WorkflowStage[] = ['porting_complete', 'user_config', 'completed']

// Stages where Phase 3 & 4 can run in parallel
const PARALLEL_PHASE_STAGES: WorkflowStage[] = ['verizon_complete', 'porting_submitted', 'porting_scheduled', 'porting_complete', 'user_config']

// Format carrier name for display
const formatCarrierName = (carrier: string): string => {
  const names: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  }
  return names[carrier?.toLowerCase()] || carrier || 'Carrier'
}

// Get phases with dynamic carrier name
const getPhases = (carrierName: string) => BASE_PHASES.map(phase =>
  phase.id === 2 ? { ...phase, name: `${carrierName} Setup` } : phase
)

// Helper to safely format currency (handles string/number/null from PostgreSQL)
const formatCurrency = (value: unknown): string => {
  const num = Number(value)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

function getPhaseForStage(stage: WorkflowStage): number {
  // For parallel phases, return the "primary" track (porting)
  if (stage === 'estimate') return 1
  if (['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(stage)) return 2
  if (['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(stage)) return 3
  return 4
}

function getPhaseStatus(phaseId: number, currentStage: WorkflowStage): 'done' | 'active' | 'pending' {
  // Phase 1: done once we move past estimate
  if (phaseId === 1) {
    return currentStage === 'estimate' ? 'active' : 'done'
  }

  // Phase 2: done once carrier setup completes (verizon_complete or beyond)
  if (phaseId === 2) {
    if (currentStage === 'estimate') return 'pending'
    if (['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(currentStage)) return 'active'
    return 'done'
  }

  // Phase 3 (Porting): active once Phase 2 done, done once porting completes
  if (phaseId === 3) {
    if (['estimate', 'estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(currentStage)) return 'pending'
    if (PORTING_COMPLETE_STAGES.includes(currentStage)) return 'done'
    return 'active'
  }

  // Phase 4 (Teams Config): active in PARALLEL with Phase 3 after Phase 2 completes
  if (phaseId === 4) {
    if (['estimate', 'estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(currentStage)) return 'pending'
    if (currentStage === 'completed') return 'done'
    return 'active' // Active alongside Phase 3
  }

  return 'pending'
}

// Check if porting is complete (for gating Phase 4 completion)
function isPortingComplete(stage: WorkflowStage): boolean {
  return PORTING_COMPLETE_STAGES.includes(stage)
}

function getOverallProgress(stage: WorkflowStage): number {
  // Progress based on both tracks:
  // Phase 1 complete: 25%
  // Phase 2 complete: 50%
  // Phase 3 OR 4 progress adds up to remaining 50%

  if (stage === 'estimate') return 10
  if (stage === 'estimate_accepted') return 25
  if (stage === 'verizon_submitted') return 35
  if (stage === 'verizon_in_progress') return 45
  if (stage === 'verizon_complete') return 55
  if (stage === 'porting_submitted') return 65
  if (stage === 'porting_scheduled') return 75
  if (stage === 'porting_complete') return 85
  if (stage === 'user_config') return 90
  if (stage === 'completed') return 100
  return 0
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

  const progress = getOverallProgress(migration.workflow_stage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/" className="p-2 hover:bg-surface-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200 mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-100 truncate">{migration.name}</h1>
          <p className="text-zinc-500 text-sm">
            {migration.site_name} &bull; <span className="capitalize">{migration.target_carrier}</span> &bull; <span className="capitalize">{migration.routing_type.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/migrations/${id}/users`} className="btn btn-secondary flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({migration.total_users})
          </Link>
          <Link to="/scripts" className="btn btn-secondary flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Scripts
          </Link>
        </div>
      </div>

      {/* Terminal-style Progress */}
      <div className="card font-mono text-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-zinc-500">WORKFLOW PROGRESS</span>
          <span className="text-primary-400">{progress}% complete</span>
        </div>
        <div className="flex gap-2 mb-3">
          {BASE_PHASES.map((phase) => {
            const status = getPhaseStatus(phase.id, migration.workflow_stage)
            return (
              <div key={phase.id} className="flex items-center gap-1">
                <span className={`
                  ${status === 'done' ? 'text-green-400' : ''}
                  ${status === 'active' ? 'text-primary-400' : ''}
                  ${status === 'pending' ? 'text-zinc-600' : ''}
                `}>
                  [{status === 'done' ? '✓' : status === 'active' ? '►' : ' '}]
                </span>
                <span className={`
                  ${status === 'done' ? 'text-green-400' : ''}
                  ${status === 'active' ? 'text-primary-400' : ''}
                  ${status === 'pending' ? 'text-zinc-600' : ''}
                `}>
                  Phase {phase.id}
                </span>
                {phase.id < 4 && <span className="text-zinc-700 mx-1">→</span>}
              </div>
            )
          })}
        </div>
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-0">
        {getPhases(formatCarrierName(migration.target_carrier)).map((phase) => {
          const status = getPhaseStatus(phase.id, migration.workflow_stage)
          const PhaseIcon = phase.icon
          const isActive = status === 'active'
          const isDone = status === 'done'

          return (
            <div key={phase.id} className="relative">
              {/* Vertical line connector */}
              {phase.id < 4 && (
                <div className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${isDone ? 'bg-green-500' : 'bg-surface-600'}`} />
              )}

              <div className={`relative flex gap-4 ${isActive ? 'pb-4' : 'pb-6'}`}>
                {/* Status indicator */}
                <div className={`
                  relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${isDone ? 'bg-green-500/20 border-2 border-green-500 text-green-400' : ''}
                  ${isActive ? 'bg-primary-500/20 border-2 border-primary-500 text-primary-400 animate-pulse' : ''}
                  ${status === 'pending' ? 'bg-surface-700 border-2 border-surface-600 text-zinc-600' : ''}
                `}>
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <PhaseIcon className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className={`
                    flex items-center justify-between py-2 px-3 rounded-lg
                    ${isActive ? 'bg-surface-800 border border-surface-600' : ''}
                    ${isDone ? 'opacity-75' : ''}
                  `}>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${status === 'pending' ? 'text-zinc-600' : 'text-zinc-200'}`}>
                        PHASE {phase.id}: {phase.name.toUpperCase()}
                      </span>
                      {isDone && (
                        <span className="text-xs text-green-400 font-mono">DONE</span>
                      )}
                      {isActive && (
                        <span className="text-xs text-primary-400 font-mono">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {/* Phase-specific summary info */}
                      {phase.id === 1 && isDone && migration.estimate_accepted_at && (
                        <span>Accepted {new Date(migration.estimate_accepted_at).toLocaleDateString()}</span>
                      )}
                      {phase.id === 1 && isDone && (
                        <span className="ml-3 font-mono">${formatCurrency(migration.estimate_total_monthly).split('.')[0]}/mo</span>
                      )}
                      {phase.id === 2 && isDone && migration.verizon_setup_complete_at && (
                        <span>Complete {new Date(migration.verizon_setup_complete_at).toLocaleDateString()}</span>
                      )}
                      {phase.id === 3 && isDone && migration.actual_port_date && (
                        <span>Ported {new Date(migration.actual_port_date).toLocaleDateString()}</span>
                      )}
                      {phase.id === 3 && isActive && migration.scheduled_port_date && (
                        <span>Port: {new Date(migration.scheduled_port_date).toLocaleDateString()}</span>
                      )}
                      {phase.id === 4 && (
                        <span>{migration.configured_users}/{migration.total_users} configured</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded content for active phase */}
                  {isActive && (
                    <div className="mt-3 p-4 bg-surface-800/50 border border-surface-600 rounded-lg">
                      {/* Phase 1: Estimate */}
                      {phase.id === 1 && migration.workflow_stage === 'estimate' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="label">User Service (Monthly)</label>
                              <input
                                type="number"
                                className="input"
                                value={estimateForm.estimate_user_service_charge || ''}
                                onChange={(e) => setEstimateForm({ ...estimateForm, estimate_user_service_charge: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="label">Equipment (One-time)</label>
                              <input
                                type="number"
                                className="input"
                                value={estimateForm.estimate_equipment_charge || ''}
                                onChange={(e) => setEstimateForm({ ...estimateForm, estimate_equipment_charge: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="label">Usage (Monthly)</label>
                              <input
                                type="number"
                                className="input"
                                value={estimateForm.estimate_usage_charge || ''}
                                onChange={(e) => setEstimateForm({ ...estimateForm, estimate_usage_charge: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label">Notes</label>
                            <textarea
                              className="input min-h-[60px]"
                              value={estimateForm.estimate_notes}
                              onChange={(e) => setEstimateForm({ ...estimateForm, estimate_notes: e.target.value })}
                              placeholder="Additional notes..."
                            />
                          </div>
                          <div className="flex gap-2">
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
                            >
                              Accept (Override)
                            </button>
                          </div>

                          {migration.estimate_link_token && (
                            <div className="mt-4 p-3 bg-primary-500/10 rounded-lg border border-primary-500/30">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-primary-400 mb-1">Customer Estimate Link</p>
                                  <code className="text-xs text-zinc-400 truncate block">
                                    {window.location.origin}/estimate/{migration.estimate_link_token}
                                  </code>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={copyEstimateLink} className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 rounded">
                                    {copiedEstimate ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                  <a href={`/estimate/${migration.estimate_link_token}`} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 rounded">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Phase 2: Carrier Setup */}
                      {phase.id === 2 && migration.workflow_stage === 'estimate_accepted' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
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
                            <label className="label">{formatCarrierName(migration.target_carrier)} Email Sent To</label>
                            <input
                              type="email"
                              className="input"
                              value={verizonForm.email_sent_to}
                              onChange={(e) => setVerizonForm({ ...verizonForm, email_sent_to: e.target.value })}
                              placeholder="carrier-rep@example.com"
                            />
                          </div>
                          <button
                            onClick={() => submitVerizonMutation.mutate()}
                            className="btn btn-primary"
                            disabled={submitVerizonMutation.isPending}
                          >
                            Mark {formatCarrierName(migration.target_carrier)} Request Submitted
                          </button>
                        </div>
                      )}

                      {phase.id === 2 && ['verizon_submitted', 'verizon_in_progress'].includes(migration.workflow_stage) && (
                        <div className="space-y-4">
                          <p className="text-zinc-400">
                            Submitted: {migration.verizon_request_submitted_at && new Date(migration.verizon_request_submitted_at).toLocaleDateString()}
                          </p>
                          <p className="text-amber-400 text-sm">Waiting for {formatCarrierName(migration.target_carrier)} to complete setup (typically 1-2 weeks)</p>
                          <button
                            onClick={() => completeVerizonMutation.mutate()}
                            className="btn btn-primary"
                            disabled={completeVerizonMutation.isPending}
                          >
                            Mark {formatCarrierName(migration.target_carrier)} Setup Complete
                          </button>
                        </div>
                      )}

                      {/* Phase 3: Porting */}
                      {phase.id === 3 && !migration.is_porting_numbers && (
                        <div className="text-zinc-400">
                          Not porting numbers - using new numbers from carrier.
                          <button
                            onClick={() => updateStageMutation.mutate('user_config')}
                            className="btn btn-primary ml-4"
                          >
                            Skip to User Config
                          </button>
                        </div>
                      )}

                      {phase.id === 3 && migration.is_porting_numbers && migration.workflow_stage === 'verizon_complete' && (
                        <div className="space-y-4">
                          <p className="text-zinc-400">Submit LOA to {formatCarrierName(migration.target_carrier)} for number porting</p>
                          <button
                            onClick={() => updateStageMutation.mutate('porting_submitted')}
                            className="btn btn-primary"
                          >
                            Mark LOA Submitted
                          </button>
                        </div>
                      )}

                      {phase.id === 3 && migration.workflow_stage === 'porting_submitted' && (
                        <div className="space-y-4">
                          <p className="text-amber-400 text-sm">Waiting for FOC (typically 17 business days)</p>
                          <div className="grid grid-cols-2 gap-4">
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
                          </div>
                          <button
                            onClick={() => setFocMutation.mutate()}
                            className="btn btn-primary"
                            disabled={!portingForm.foc_date || !portingForm.scheduled_port_date}
                          >
                            Set FOC & Port Date
                          </button>
                        </div>
                      )}

                      {phase.id === 3 && migration.workflow_stage === 'porting_scheduled' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-zinc-500">FOC Date:</span>
                              <span className="ml-2 text-zinc-200">{migration.foc_date && new Date(migration.foc_date).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Port Date:</span>
                              <span className="ml-2 text-zinc-200 font-medium">{migration.scheduled_port_date && new Date(migration.scheduled_port_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => completePortingMutation.mutate()}
                            className="btn btn-primary"
                          >
                            Mark Porting Complete
                          </button>
                        </div>
                      )}

                      {/* Phase 4: User Config - runs in PARALLEL with Phase 3 */}
                      {phase.id === 4 && ['verizon_complete', 'porting_submitted', 'porting_scheduled', 'porting_complete', 'user_config'].includes(migration.workflow_stage) && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">
                              {migration.configured_users} of {migration.total_users} users configured
                            </span>
                            <div className="flex gap-2">
                              <Link to={`/migrations/${id}/users`} className="btn btn-secondary flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Manage Users
                              </Link>
                              <Link to="/scripts" className="btn btn-secondary flex items-center gap-2">
                                <FileCode className="h-4 w-4" />
                                Generate Script
                              </Link>
                            </div>
                          </div>

                          {/* Show waiting message if porting not complete */}
                          {!isPortingComplete(migration.workflow_stage) && (
                            <p className="text-amber-400 text-sm">
                              Waiting for number porting to complete before finalizing migration
                            </p>
                          )}

                          <button
                            onClick={() => updateStageMutation.mutate('completed')}
                            className="btn btn-primary"
                            disabled={!isPortingComplete(migration.workflow_stage)}
                          >
                            Mark Migration Complete
                          </button>
                        </div>
                      )}

                      {/* Completed state */}
                      {phase.id === 4 && migration.workflow_stage === 'completed' && (
                        <div className="text-green-400 flex items-center gap-2">
                          <Check className="h-5 w-5" />
                          Migration completed successfully!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed phase summary */}
                  {isDone && phase.id === 1 && (
                    <div className="mt-1 ml-3 text-sm text-zinc-500">
                      Monthly: ${formatCurrency(migration.estimate_total_monthly)} &bull; One-time: ${formatCurrency(migration.estimate_total_onetime)}
                      {migration.estimate_accepted_by && <span> &bull; Accepted by: {migration.estimate_accepted_by}</span>}
                    </div>
                  )}

                  {isDone && phase.id === 2 && migration.verizon_site_id && (
                    <div className="mt-1 ml-3 text-sm text-zinc-500">
                      Site ID: {migration.verizon_site_id}
                    </div>
                  )}

                  {/* Pending phase message */}
                  {status === 'pending' && (
                    <div className="mt-1 ml-3 text-sm text-zinc-600">
                      Waiting for Phase {phase.id - 1} to complete
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
