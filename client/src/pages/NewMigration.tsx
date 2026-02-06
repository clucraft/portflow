import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { migrationsApi } from '../services/api'
import CountryCodeSelect from '../components/CountryCodeSelect'

export default function NewMigration() {
  const navigate = useNavigate()
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
    current_pbx_type: '',
    current_carrier: '',

    // Estimate inputs
    telephone_users: 0,
    physical_phones_needed: 0,
    monthly_calling_minutes: 0,
    is_porting_numbers: true,
    new_numbers_requested: 0,

    // Config
    target_carrier: 'verizon',
    routing_type: 'direct_routing',
    voice_routing_policy: '',
    country_code: '+1',
  })

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
          {[1, 2, 3].map((s) => (
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
              {s < 3 && (
                <div className={`w-12 h-0.5 ${s < step ? 'bg-green-500' : 'bg-surface-600'}`} />
              )}
            </div>
          ))}
          <div className="ml-4 text-sm text-zinc-400">
            {step === 1 && 'Site Information'}
            {step === 2 && 'Estimate Details'}
            {step === 3 && 'Configuration'}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Current PBX Type</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Avaya, Cisco, Mitel"
                  value={formData.current_pbx_type}
                  onChange={(e) => updateField('current_pbx_type', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Current Carrier</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., AT&T, CenturyLink"
                  value={formData.current_carrier}
                  onChange={(e) => updateField('current_carrier', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Estimate Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="label">Number of Telephone Users *</label>
              <input
                type="number"
                className="input"
                min="1"
                value={formData.telephone_users || ''}
                onChange={(e) => updateField('telephone_users', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-zinc-500 mt-1">Users who need phone service in Teams</p>
            </div>

            <div>
              <label className="label">Physical Phones Needed</label>
              <input
                type="number"
                className="input"
                min="0"
                value={formData.physical_phones_needed || ''}
                onChange={(e) => updateField('physical_phones_needed', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-zinc-500 mt-1">Desk phones, conference phones, etc.</p>
            </div>

            <div>
              <label className="label">Monthly Calling Minutes</label>
              <input
                type="number"
                className="input"
                min="0"
                value={formData.monthly_calling_minutes || ''}
                onChange={(e) => updateField('monthly_calling_minutes', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-zinc-500 mt-1">From existing carrier invoice (optional)</p>
            </div>

            <div className="p-4 bg-surface-700/50 rounded-lg border border-surface-600">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-surface-900"
                  checked={formData.is_porting_numbers}
                  onChange={(e) => updateField('is_porting_numbers', e.target.checked)}
                />
                <span className="font-medium text-zinc-200">Porting existing phone numbers</span>
              </label>
              <p className="text-xs text-zinc-500 mt-2 ml-7">
                Uncheck if requesting new numbers from carrier
              </p>
            </div>

            {!formData.is_porting_numbers && (
              <div>
                <label className="label">New Numbers Requested</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  value={formData.new_numbers_requested || ''}
                  onChange={(e) => updateField('new_numbers_requested', parseInt(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configuration */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label">Target Carrier</label>
              <select
                className="input"
                value={formData.target_carrier}
                onChange={(e) => updateField('target_carrier', e.target.value)}
              >
                <option value="verizon">Verizon</option>
                <option value="fusionconnect">FusionConnect</option>
                <option value="gtt">GTT</option>
              </select>
            </div>

            <div>
              <label className="label">Routing Type</label>
              <select
                className="input"
                value={formData.routing_type}
                onChange={(e) => {
                  const val = e.target.value
                  setFormData({ ...formData, routing_type: val, voice_routing_policy: val === 'operator_connect' ? '' : formData.voice_routing_policy })
                }}
              >
                <option value="direct_routing">Direct Routing</option>
                <option value="operator_connect">Operator Connect</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                {formData.routing_type === 'direct_routing'
                  ? 'Use your own SBC for PSTN connectivity'
                  : 'Carrier-managed connection to Teams'}
              </p>
            </div>

            {formData.routing_type === 'direct_routing' && (
              <div>
                <label className="label">Voice Routing Policy</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., International"
                  value={formData.voice_routing_policy}
                  onChange={(e) => updateField('voice_routing_policy', e.target.value)}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  The Teams voice routing policy to assign to each user
                </p>
              </div>
            )}

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

            {/* Summary */}
            <div className="mt-6 p-4 bg-primary-500/10 rounded-lg border border-primary-500/30">
              <h3 className="font-medium text-primary-400 mb-3">Summary</h3>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Site:</dt>
                  <dd className="text-zinc-200">{formData.site_name || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Users:</dt>
                  <dd className="text-zinc-200">{formData.telephone_users}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Phones:</dt>
                  <dd className="text-zinc-200">{formData.physical_phones_needed}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Carrier:</dt>
                  <dd className="text-zinc-200 capitalize">{formData.target_carrier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Porting Numbers:</dt>
                  <dd className="text-zinc-200">{formData.is_porting_numbers ? 'Yes' : 'No'}</dd>
                </div>
                {formData.routing_type === 'direct_routing' && formData.voice_routing_policy && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Voice Routing Policy:</dt>
                    <dd className="text-zinc-200">{formData.voice_routing_policy}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Country Code:</dt>
                  <dd className="text-zinc-200 font-mono">{formData.country_code}</dd>
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

          {step < 3 ? (
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
              disabled={createMutation.isPending || !formData.telephone_users}
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
