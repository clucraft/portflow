import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { migrationsApi, carriersApi, voiceRoutingPoliciesApi, dialPlansApi, teamApi, type Carrier } from '../services/api'
import CountryCodeSelect from '../components/CountryCodeSelect'
import ComboBox from '../components/ComboBox'
import { useAuth } from '../contexts/AuthContext'

export default function NewMigration() {
  const navigate = useNavigate()
  const { canWrite, user } = useAuth()

  if (!canWrite) {
    return <Navigate to="/" replace />
  }
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    // Site info
    name: '',
    site_name: '',
    site_address: '',
    site_city: '',
    site_state: '',
    site_country: 'United States',
    site_timezone: 'America/New_York',

    // Config
    target_carrier: 'verizon',
    routing_type: 'direct_routing',
    voice_routing_policy: '',
    dial_plan: '',
    country_code: '+1',
    currency: 'USD',
    assigned_to: user?.id || '',
  })

  const { data: carriers } = useQuery({ queryKey: ['carriers'], queryFn: carriersApi.list })
  const { data: vrps } = useQuery({ queryKey: ['voice-routing-policies'], queryFn: voiceRoutingPoliciesApi.list })
  const { data: dialPlans } = useQuery({ queryKey: ['dial-plans'], queryFn: dialPlansApi.list })
  const { data: teamMembers } = useQuery({ queryKey: ['team'], queryFn: teamApi.list })

  const createMutation = useMutation({
    mutationFn: migrationsApi.create,
    onSuccess: (data) => {
      navigate(`/migrations/${data.id}`)
    },
  })

  const updateField = (field: string, value: unknown) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = () => {
    createMutation.mutate({
      ...formData,
      name: formData.name || `${formData.site_name} Migration`,
    })
  }

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="card">
        <h1 className="text-xl font-bold text-zinc-100 mb-6">New EV Migration Project</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border transition-all ${
                  s === step
                    ? 'bg-primary-600 text-white border-primary-500 glow-primary'
                    : s < step
                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                    : 'bg-surface-700 text-zinc-500 border-surface-600'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 2 && (
                <div className={`w-12 h-0.5 ${s < step ? 'bg-green-500' : 'bg-surface-600'}`} />
              )}
            </div>
          ))}
          <div className="ml-4 text-sm text-zinc-400">
            {step === 1 && 'Site Information'}
            {step === 2 && 'Configuration'}
          </div>
        </div>

        {/* Step 1: Site Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Site Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., New York Headquarters"
                value={formData.site_name}
                onChange={(e) => updateField('site_name', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Project Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., NYC HQ EV Migration Q1"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <p className="text-xs text-zinc-500 mt-1">Optional - will default to site name</p>
            </div>

            <div>
              <label className="label">Address</label>
              <input
                type="text"
                className="input"
                placeholder="Street address"
                value={formData.site_address}
                onChange={(e) => updateField('site_address', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  className="input"
                  value={formData.site_city}
                  onChange={(e) => updateField('site_city', e.target.value)}
                />
              </div>
              <div>
                <label className="label">State/Province</label>
                <input
                  type="text"
                  className="input"
                  value={formData.site_state}
                  onChange={(e) => updateField('site_state', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Country</label>
                <input
                  type="text"
                  className="input"
                  value={formData.site_country}
                  onChange={(e) => updateField('site_country', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Timezone</label>
                <select
                  className="input"
                  value={formData.site_timezone}
                  onChange={(e) => updateField('site_timezone', e.target.value)}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label">Target Carrier</label>
              <select
                className="input"
                value={formData.target_carrier}
                onChange={(e) => {
                  const slug = e.target.value
                  const carrierObj = carriers?.find((c: Carrier) => c.slug === slug)
                  const newRoutingType = carrierObj?.carrier_type || 'direct_routing'
                  setFormData({ ...formData, target_carrier: slug, routing_type: newRoutingType, voice_routing_policy: newRoutingType !== 'direct_routing' ? '' : formData.voice_routing_policy })
                }}
              >
                {carriers?.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.display_name}</option>
                ))}
                {(!carriers || carriers.length === 0) && (
                  <>
                    <option value="verizon">Verizon</option>
                    <option value="fusionconnect">FusionConnect</option>
                    <option value="gtt">GTT</option>
                  </>
                )}
              </select>
            </div>

            {(() => { const selectedCarrier = carriers?.find((c: Carrier) => c.slug === formData.target_carrier); return selectedCarrier?.carrier_type === 'direct_routing'; })() && (
              <div>
                <label className="label">Voice Routing Policy</label>
                <ComboBox
                  options={(vrps || []).map(v => ({ value: v.name, label: v.name }))}
                  value={formData.voice_routing_policy}
                  onChange={(val) => updateField('voice_routing_policy', val)}
                  placeholder="Select or type a policy..."
                  allowCustom
                />
                <p className="text-xs text-zinc-500 mt-1">
                  The Teams voice routing policy to assign to each user
                </p>
              </div>
            )}

            <div>
              <label className="label">Tenant Dial Plan</label>
              <ComboBox
                options={(dialPlans || []).map(d => ({ value: d.name, label: d.name }))}
                value={formData.dial_plan}
                onChange={(val) => updateField('dial_plan', val)}
                placeholder="Select or type a dial plan..."
                allowCustom
              />
              <p className="text-xs text-zinc-500 mt-1">
                The Teams tenant dial plan to assign to each user
              </p>
            </div>

            <div>
              <label className="label">Phone Number Country Code</label>
              <CountryCodeSelect
                value={formData.country_code}
                onChange={(val) => updateField('country_code', val)}
              />
              <p className="text-xs text-zinc-500 mt-1">
                All phone numbers in this migration must use this country code (E.164 format)
              </p>
            </div>
            <div>
              <label className="label">Estimate Currency</label>
              <select
                className="input"
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                All estimate amounts will be displayed in this currency
              </p>
            </div>

            <div>
              <label className="label">Assigned To</label>
              <select
                className="input"
                value={formData.assigned_to}
                onChange={(e) => updateField('assigned_to', e.target.value)}
              >
                <option value="">Unassigned</option>
                {teamMembers?.filter(tm => tm.is_active).map(tm => (
                  <option key={tm.id} value={tm.id}>{tm.display_name}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                Team member responsible for this migration
              </p>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
              <h3 className="font-medium text-primary-400 mb-3">Summary</h3>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Site:</dt>
                  <dd className="text-zinc-200">{formData.site_name || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Carrier:</dt>
                  <dd className="text-zinc-200 capitalize">{formData.target_carrier}</dd>
                </div>
                {formData.routing_type === 'direct_routing' && formData.voice_routing_policy && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Voice Routing Policy:</dt>
                    <dd className="text-zinc-200">{formData.voice_routing_policy}</dd>
                  </div>
                )}
                {formData.dial_plan && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Dial Plan:</dt>
                    <dd className="text-zinc-200">{formData.dial_plan}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Country Code:</dt>
                  <dd className="text-zinc-200 font-mono">{formData.country_code}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Currency:</dt>
                  <dd className="text-zinc-200">{formData.currency === 'EUR' ? '€ EUR' : '$ USD'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-surface-600">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.site_name}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Migration'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
