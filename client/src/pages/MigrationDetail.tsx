import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Users, FileCode, Link2, Copy, Check,
  DollarSign, Building, Phone, UserCheck, CheckCircle
} from 'lucide-react'
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
}

function getStageNumber(stage: WorkflowStage): number {
  const index = WORKFLOW_STAGES.findIndex((s) => s.stage === stage)
  return index >= 0 ? index + 1 : 0
}

export default function MigrationDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  // Form states for each phase
  const [estimateForm, setEstimateForm] = useState({
    estimate_user_service_charge: 0,
    estimate_equipment_charge: 0,
    estimate_usage_charge: 0,
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

  const generateMagicLinkMutation = useMutation({
    mutationFn: () => migrationsApi.generateMagicLink(id!, 30),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const updateStageMutation = useMutation({
    mutationFn: (stage: WorkflowStage) => migrationsApi.updateStage(id!, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration', id] }),
  })

  const copyMagicLink = async () => {
    if (migration?.magic_link_token) {
      await navigator.clipboard.writeText(`${window.location.origin}/collect/${migration.magic_link_token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!migration) {
    return <div className="text-center py-12">Migration not found</div>
  }

  const stageNum = getStageNumber(migration.workflow_stage)
  const progressPct = (stageNum / WORKFLOW_STAGES.length) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{migration.name}</h1>
          <p className="text-gray-600">
            {migration.site_name} • {migration.target_carrier} • {migration.routing_type.replace('_', ' ')}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${stageColors[migration.workflow_stage]}`}>
          {WORKFLOW_STAGES.find((s) => s.stage === migration.workflow_stage)?.label || migration.workflow_stage}
        </span>
      </div>

      {/* Progress */}
      <div className="card">
        <h2 className="font-semibold mb-3">Workflow Progress</h2>
        <div className="relative mb-2">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${stageColors[migration.workflow_stage]} transition-all duration-500`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs">
          {WORKFLOW_STAGES.map((stage, i) => (
            <div
              key={stage.stage}
              className={`text-center ${i < stageNum ? 'text-green-600' : 'text-gray-400'}`}
              style={{ width: `${100 / WORKFLOW_STAGES.length}%` }}
            >
              <div
                className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                  i < stageNum ? stageColors[migration.workflow_stage] : 'bg-gray-300'
                }`}
              />
              <span className="hidden md:block">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to={`/migrations/${id}/users`}
          className="card hover:border-primary-300 transition-colors flex items-center gap-3"
        >
          <Users className="h-6 w-6 text-blue-500" />
          <div>
            <p className="font-medium">{migration.total_users} Users</p>
            <p className="text-xs text-gray-500">{migration.configured_users} configured</p>
          </div>
        </Link>

        <button
          onClick={() => generateMagicLinkMutation.mutate()}
          className="card hover:border-primary-300 transition-colors flex items-center gap-3 text-left"
        >
          <Link2 className="h-6 w-6 text-purple-500" />
          <div>
            <p className="font-medium">Customer Link</p>
            <p className="text-xs text-gray-500">
              {migration.magic_link_token ? 'Active' : 'Generate'}
            </p>
          </div>
        </button>

        <Link to="/scripts" className="card hover:border-primary-300 transition-colors flex items-center gap-3">
          <FileCode className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium">Scripts</p>
            <p className="text-xs text-gray-500">Generate PS scripts</p>
          </div>
        </Link>

        <div className="card flex items-center gap-3">
          <Phone className="h-6 w-6 text-orange-500" />
          <div>
            <p className="font-medium">{migration.telephone_users} Users</p>
            <p className="text-xs text-gray-500">{migration.physical_phones_needed} phones</p>
          </div>
        </div>
      </div>

      {/* Magic Link Display */}
      {migration.magic_link_token && (
        <div className="card bg-purple-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Customer Data Collection Link</h3>
              <p className="text-sm text-gray-600 mt-1">
                Share this link with the customer to collect user/phone number data
              </p>
              <code className="block mt-2 text-sm bg-white px-3 py-2 rounded border">
                {window.location.origin}/collect/{migration.magic_link_token}
              </code>
              {migration.magic_link_expires_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Expires: {new Date(migration.magic_link_expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={copyMagicLink}
              className="btn btn-secondary flex items-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Phase-specific cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase 1: Estimate */}
        <div className={`card ${migration.workflow_stage === 'estimate' ? 'ring-2 ring-primary-500' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold">Phase 1: Cost Estimate</h2>
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
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => updateEstimateMutation.mutate(estimateForm)}
                  className="btn btn-secondary"
                  disabled={updateEstimateMutation.isPending}
                >
                  Save
                </button>
                <button
                  onClick={() => acceptEstimateMutation.mutate()}
                  className="btn btn-primary"
                  disabled={acceptEstimateMutation.isPending}
                >
                  Accept Estimate
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <p>Monthly: ${migration.estimate_total_monthly?.toFixed(2) || '0.00'}</p>
              <p>One-time: ${migration.estimate_total_onetime?.toFixed(2) || '0.00'}</p>
              {migration.estimate_accepted_at && (
                <p className="text-green-600">
                  Accepted: {new Date(migration.estimate_accepted_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Phase 2: Verizon Setup */}
        <div className={`card ${['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(migration.workflow_stage) ? 'ring-2 ring-primary-500' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Phase 2: Verizon Setup</h2>
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
              <p className="text-sm text-gray-600">
                Submitted: {migration.verizon_request_submitted_at && new Date(migration.verizon_request_submitted_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-yellow-600">Waiting for Verizon to complete setup (typically 1-2 weeks)</p>
              <button
                onClick={() => completeVerizonMutation.mutate()}
                className="btn btn-primary w-full"
                disabled={completeVerizonMutation.isPending}
              >
                Mark Verizon Setup Complete
              </button>
            </div>
          ) : migration.verizon_setup_complete_at ? (
            <p className="text-sm text-green-600">
              Completed: {new Date(migration.verizon_setup_complete_at).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Complete Phase 1 first</p>
          )}
        </div>

        {/* Phase 3: Porting */}
        <div className={`card ${['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(migration.workflow_stage) ? 'ring-2 ring-primary-500' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Phone className="h-5 w-5 text-orange-600" />
            <h2 className="font-semibold">Phase 3: Number Porting</h2>
            {migration.actual_port_date && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {!migration.is_porting_numbers ? (
            <p className="text-sm text-gray-500">Not porting numbers - using new numbers from carrier</p>
          ) : migration.workflow_stage === 'verizon_complete' ? (
            <div className="space-y-3">
              <p className="text-sm">Submit LOA to Verizon for number porting</p>
              <button
                onClick={() => updateStageMutation.mutate('porting_submitted')}
                className="btn btn-primary w-full"
              >
                Mark LOA Submitted
              </button>
            </div>
          ) : migration.workflow_stage === 'porting_submitted' ? (
            <div className="space-y-3">
              <p className="text-sm text-yellow-600">Waiting for FOC (typically 17 business days)</p>
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
              <p className="text-sm">FOC: {migration.foc_date && new Date(migration.foc_date).toLocaleDateString()}</p>
              <p className="text-sm font-medium">Port Date: {migration.scheduled_port_date && new Date(migration.scheduled_port_date).toLocaleDateString()}</p>
              <button
                onClick={() => completePortingMutation.mutate()}
                className="btn btn-primary w-full"
              >
                Mark Porting Complete
              </button>
            </div>
          ) : migration.actual_port_date ? (
            <p className="text-sm text-green-600">
              Ported: {new Date(migration.actual_port_date).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Complete Phase 2 first</p>
          )}
        </div>

        {/* Phase 4: User Configuration */}
        <div className={`card ${['porting_complete', 'user_config'].includes(migration.workflow_stage) ? 'ring-2 ring-primary-500' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-purple-600" />
            <h2 className="font-semibold">Phase 4: Teams Configuration</h2>
            {migration.workflow_stage === 'completed' && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
          </div>

          {['porting_complete', 'user_config'].includes(migration.workflow_stage) ? (
            <div className="space-y-3">
              <p className="text-sm">
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
            <p className="text-sm text-green-600">Migration completed!</p>
          ) : (
            <p className="text-sm text-gray-500">Complete previous phases first</p>
          )}
        </div>
      </div>
    </div>
  )
}
