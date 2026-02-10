import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, FileCode, Copy, Check,
  DollarSign, Building, Phone, UserCheck, Link2, ExternalLink, Trash2, ChevronDown, Pencil, X,
  CheckSquare, Square, AlertCircle, CheckCircle, Bell, BellOff
} from 'lucide-react'
import { migrationsApi, scriptsApi, carriersApi, voiceRoutingPoliciesApi, dialPlansApi, notificationsApi, type WorkflowStage, type PhaseTask } from '../services/api'
import CountryCodeSelect from '../components/CountryCodeSelect'
import ComboBox from '../components/ComboBox'
import { useAuth } from '../contexts/AuthContext'

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

// Format carrier name for display (fallback for when carriers haven't loaded)
const formatCarrierNameFallback = (carrier: string): string => {
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

// Default subtasks for Phase 4
const DEFAULT_PHASE_TASKS: Record<string, PhaseTask[]> = {
  phase_4: [
    { key: 'aa_cq_config', label: 'Auto Attendants & Call Queues', done: false },
    { key: 'holiday_sets', label: 'Holiday Sets', done: false },
    { key: 'phone_deployment', label: 'Physical Phone Deployment', done: false },
  ],
}

// Get tasks for a phase, falling back to defaults for migrations without phase_tasks
function getPhaseTasks(migration: { phase_tasks: Record<string, PhaseTask[]> | null }, phaseId: string): PhaseTask[] {
  if (migration.phase_tasks && migration.phase_tasks[phaseId]) {
    return migration.phase_tasks[phaseId]
  }
  return DEFAULT_PHASE_TASKS[phaseId] || []
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
  const { canWrite } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [copiedEstimate, setCopiedEstimate] = useState(false)
  const [scriptDropdownOpen, setScriptDropdownOpen] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState({
    name: '',
    site_name: '',
    site_address: '',
    site_city: '',
    site_state: '',
    site_country: '',
    site_timezone: '',
    current_pbx_type: '',
    current_carrier: '',
    routing_type: 'direct_routing',
    voice_routing_policy: '',
    dial_plan: '',
    country_code: '+1',
  })
  const scriptDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scriptDropdownRef.current && !scriptDropdownRef.current.contains(event.target as Node)) {
        setScriptDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const { data: carriers } = useQuery({ queryKey: ['carriers'], queryFn: carriersApi.list })
  const { data: vrps } = useQuery({ queryKey: ['voice-routing-policies'], queryFn: voiceRoutingPoliciesApi.list })
  const { data: dialPlanOptions } = useQuery({ queryKey: ['dial-plans'], queryFn: dialPlansApi.list })

  // Helper: format carrier name using dynamic data
  const formatCarrierName = (carrier: string): string => {
    const found = carriers?.find(c => c.slug === carrier)
    return found?.display_name || formatCarrierNameFallback(carrier)
  }

  const { data: mySubscriptions } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: notificationsApi.getMySubscriptions,
  })
  const isSubscribed = mySubscriptions?.includes(id!) || false

  const subscribeMutation = useMutation({
    mutationFn: () => notificationsApi.subscribe(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  })

  const unsubscribeMutation = useMutation({
    mutationFn: () => notificationsApi.unsubscribe(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] }),
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

  const deleteMigrationMutation = useMutation({
    mutationFn: () => migrationsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] })
      navigate('/')
    },
  })

  const generateTeamsScriptMutation = useMutation({
    mutationFn: () => scriptsApi.generateUserAssignments(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setScriptDropdownOpen(false)
      navigate('/scripts')
    },
  })

  const generateAdScriptMutation = useMutation({
    mutationFn: () => scriptsApi.generateAdPhoneNumbers(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setScriptDropdownOpen(false)
      navigate('/scripts')
    },
  })

  const updateDetailsMutation = useMutation({
    mutationFn: (data: typeof detailsForm) => migrationsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration', id] })
      queryClient.invalidateQueries({ queryKey: ['migrations'] })
      setEditingDetails(false)
    },
  })

  const updatePhaseTasksMutation = useMutation({
    mutationFn: (phase_tasks: Record<string, PhaseTask[]>) =>
      migrationsApi.update(id!, { phase_tasks } as Partial<import('../services/api').Migration>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const openEditDetails = () => {
    if (migration) {
      setDetailsForm({
        name: migration.name || '',
        site_name: migration.site_name || '',
        site_address: migration.site_address || '',
        site_city: migration.site_city || '',
        site_state: migration.site_state || '',
        site_country: migration.site_country || '',
        site_timezone: migration.site_timezone || '',
        current_pbx_type: migration.current_pbx_type || '',
        current_carrier: migration.current_carrier || '',
        routing_type: migration.routing_type || 'direct_routing',
        voice_routing_policy: migration.voice_routing_policy || '',
        dial_plan: migration.dial_plan || '',
        country_code: migration.country_code || '+1',
      })
      setEditingDetails(true)
    }
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${migration?.name}"? This action cannot be undone.`)) {
      deleteMigrationMutation.mutate()
    }
  }

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-100 truncate">{migration.name}</h1>
            {canWrite && (
              <button
                onClick={openEditDetails}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-surface-700 rounded-lg transition-colors"
                title="Edit project details"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-zinc-500 text-sm">
            {migration.site_name} &bull; <span className="capitalize">{migration.target_carrier}</span> &bull; <span className="capitalize">{migration.routing_type.replace('_', ' ')}</span>
            {migration.country_code && <span> &bull; <span className="font-mono">{migration.country_code}</span></span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => isSubscribed ? unsubscribeMutation.mutate() : subscribeMutation.mutate()}
            className={`btn btn-secondary flex items-center gap-2 ${isSubscribed ? 'text-primary-400 border-primary-500/30' : ''}`}
            title={isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}
            disabled={subscribeMutation.isPending || unsubscribeMutation.isPending}
          >
            {isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>
          <Link to={`/migrations/${id}/users`} className="btn btn-secondary flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({migration.total_users})
          </Link>
          <Link to="/scripts" className="btn btn-secondary flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Scripts
          </Link>
          {canWrite && (
            <button
              onClick={handleDelete}
              className="btn btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-500/50"
              title="Delete migration"
              disabled={deleteMigrationMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Edit Details Form */}
      {editingDetails && (
        <div className="card border-primary-500/30 bg-primary-500/5 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-100">Edit Project Details</h3>
            <button
              onClick={() => setEditingDetails(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Project Name</label>
              <input
                type="text"
                className="input"
                value={detailsForm.name}
                onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Site Name</label>
              <input
                type="text"
                className="input"
                value={detailsForm.site_name}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input
                type="text"
                className="input"
                value={detailsForm.site_address}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_address: e.target.value })}
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                type="text"
                className="input"
                value={detailsForm.site_city}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_city: e.target.value })}
              />
            </div>
            <div>
              <label className="label">State/Province</label>
              <input
                type="text"
                className="input"
                value={detailsForm.site_state}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_state: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input
                type="text"
                className="input"
                value={detailsForm.site_country}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_country: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                className="input"
                value={detailsForm.site_timezone}
                onChange={(e) => setDetailsForm({ ...detailsForm, site_timezone: e.target.value })}
              >
                {[
                  'America/New_York', 'America/Chicago', 'America/Denver',
                  'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
                  'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
                ].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Current PBX Type</label>
              <input
                type="text"
                className="input"
                value={detailsForm.current_pbx_type}
                onChange={(e) => setDetailsForm({ ...detailsForm, current_pbx_type: e.target.value })}
                placeholder="e.g., Avaya, Cisco, Mitel"
              />
            </div>
            <div>
              <label className="label">Current Carrier</label>
              <input
                type="text"
                className="input"
                value={detailsForm.current_carrier}
                onChange={(e) => setDetailsForm({ ...detailsForm, current_carrier: e.target.value })}
                placeholder="e.g., AT&T, CenturyLink"
              />
            </div>
            {detailsForm.routing_type === 'direct_routing' && (
              <div>
                <label className="label">Voice Routing Policy</label>
                <ComboBox
                  options={(vrps || []).map(v => ({ value: v.name, label: v.name }))}
                  value={detailsForm.voice_routing_policy}
                  onChange={(val) => setDetailsForm({ ...detailsForm, voice_routing_policy: val })}
                  placeholder="Select or type a policy..."
                  allowCustom
                />
              </div>
            )}
            <div>
              <label className="label">Tenant Dial Plan</label>
              <ComboBox
                options={(dialPlanOptions || []).map(d => ({ value: d.name, label: d.name }))}
                value={detailsForm.dial_plan}
                onChange={(val) => setDetailsForm({ ...detailsForm, dial_plan: val })}
                placeholder="Select or type a dial plan..."
                allowCustom
              />
            </div>
            <div>
              <label className="label">Phone Number Country Code</label>
              <CountryCodeSelect
                value={detailsForm.country_code}
                onChange={(val) => setDetailsForm({ ...detailsForm, country_code: val })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-surface-600">
            <button
              onClick={() => updateDetailsMutation.mutate(detailsForm)}
              disabled={!detailsForm.name || !detailsForm.site_name || updateDetailsMutation.isPending}
              className="btn btn-primary"
            >
              {updateDetailsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditingDetails(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                      {phase.id === 4 && (() => {
                        const tasks = getPhaseTasks(migration, 'phase_4')
                        const doneCount = tasks.filter(t => t.done).length
                        return (
                          <span>
                            {migration.configured_users}/{migration.total_users} configured
                            <span className="mx-2 text-zinc-600">&bull;</span>
                            {doneCount}/{tasks.length} tasks
                          </span>
                        )
                      })()}
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
                              {/* Script Generation Dropdown */}
                              <div className="relative" ref={scriptDropdownRef}>
                                <button
                                  onClick={() => setScriptDropdownOpen(!scriptDropdownOpen)}
                                  className="btn btn-secondary flex items-center gap-2"
                                  disabled={generateTeamsScriptMutation.isPending || generateAdScriptMutation.isPending}
                                >
                                  <FileCode className="h-4 w-4" />
                                  Generate Script
                                  <ChevronDown className={`h-4 w-4 transition-transform ${scriptDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {scriptDropdownOpen && (
                                  <div className="absolute right-0 mt-2 w-64 bg-surface-800 border border-surface-600 rounded-lg shadow-xl z-50">
                                    <div className="p-2">
                                      <button
                                        onClick={() => generateTeamsScriptMutation.mutate()}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors"
                                        disabled={generateTeamsScriptMutation.isPending}
                                      >
                                        <div className="font-medium text-zinc-200">Teams User Assignment</div>
                                        <div className="text-xs text-zinc-500">Assign phone numbers in Microsoft Teams</div>
                                      </button>
                                      <button
                                        onClick={() => generateAdScriptMutation.mutate()}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors mt-1"
                                        disabled={generateAdScriptMutation.isPending}
                                      >
                                        <div className="font-medium text-zinc-200">Active Directory</div>
                                        <div className="text-xs text-zinc-500">Update phone numbers in AD user accounts</div>
                                      </button>
                                    </div>
                                    <div className="border-t border-surface-600 p-2">
                                      <Link
                                        to="/scripts"
                                        className="block w-full text-left px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors text-sm text-zinc-400"
                                        onClick={() => setScriptDropdownOpen(false)}
                                      >
                                        View All Scripts
                                      </Link>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Data collection status indicator */}
                          {!migration.user_data_collection_complete && migration.total_users > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                              <span className="text-sm text-amber-300">Draft in progress ({migration.total_users} users saved)</span>
                            </div>
                          )}
                          {migration.user_data_collection_complete && (
                            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                              <span className="text-sm text-green-300">Data collection complete</span>
                            </div>
                          )}

                          {/* Phase 4 Subtask Checklist */}
                          {(() => {
                            const tasks = getPhaseTasks(migration, 'phase_4')
                            const doneCount = tasks.filter(t => t.done).length
                            return (
                              <div className="border border-surface-600 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium text-zinc-300">Configuration Tasks</span>
                                  <span className="text-xs text-zinc-500">{doneCount}/{tasks.length} tasks complete</span>
                                </div>
                                <div className="space-y-2">
                                  {tasks.map((task) => (
                                    <button
                                      key={task.key}
                                      className="flex items-center gap-3 w-full text-left px-2 py-1.5 rounded hover:bg-surface-700 transition-colors group"
                                      disabled={updatePhaseTasksMutation.isPending}
                                      onClick={() => {
                                        const updatedTasks = tasks.map(t =>
                                          t.key === task.key ? { ...t, done: !t.done } : t
                                        )
                                        const allPhaseTasks = { ...(migration.phase_tasks || {}), phase_4: updatedTasks }
                                        updatePhaseTasksMutation.mutate(allPhaseTasks)
                                      }}
                                    >
                                      {task.done ? (
                                        <CheckSquare className="h-4 w-4 text-green-400 flex-shrink-0" />
                                      ) : (
                                        <Square className="h-4 w-4 text-zinc-500 group-hover:text-zinc-400 flex-shrink-0" />
                                      )}
                                      <span className={task.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
                                        {task.label}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}

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

                  {isDone && phase.id === 2 && (
                    <div className="mt-1 ml-3 text-sm text-zinc-500">
                      {migration.verizon_request_submitted_at && (
                        <span>Submitted {new Date(migration.verizon_request_submitted_at).toLocaleDateString()}</span>
                      )}
                      {migration.verizon_request_email_sent_to && (
                        <span> to {migration.verizon_request_email_sent_to}</span>
                      )}
                      {migration.verizon_setup_complete_at && (
                        <span> &bull; Completed {new Date(migration.verizon_setup_complete_at).toLocaleDateString()}</span>
                      )}
                      {migration.verizon_site_id && (
                        <span> &bull; Site ID: {migration.verizon_site_id}</span>
                      )}
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
