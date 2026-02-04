import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { migrationsApi } from '../services/api'

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
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="card">
        <h1 className="text-xl font-bold mb-6">New EV Migration Project</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === step
                    ? 'bg-primary-600 text-white'
                    : s < step
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-1 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <div className="ml-4 text-sm text-gray-600">
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
              <p className="text-xs text-gray-500 mt-1">Optional - will default to site name</p>
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
              <p className="text-xs text-gray-500 mt-1">Users who need phone service in Teams</p>
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
              <p className="text-xs text-gray-500 mt-1">Desk phones, conference phones, etc.</p>
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
              <p className="text-xs text-gray-500 mt-1">From existing carrier invoice (optional)</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={formData.is_porting_numbers}
                  onChange={(e) => updateField('is_porting_numbers', e.target.checked)}
                />
                <span className="font-medium">Porting existing phone numbers</span>
              </label>
              <p className="text-xs text-gray-500 mt-2 ml-7">
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
                onChange={(e) => updateField('routing_type', e.target.value)}
              >
                <option value="direct_routing">Direct Routing</option>
                <option value="operator_connect">Operator Connect</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.routing_type === 'direct_routing'
                  ? 'Use your own SBC for PSTN connectivity'
                  : 'Carrier-managed connection to Teams'}
              </p>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-primary-50 rounded-lg">
              <h3 className="font-medium mb-2">Summary</h3>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Site:</dt>
                  <dd>{formData.site_name || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Users:</dt>
                  <dd>{formData.telephone_users}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Phones:</dt>
                  <dd>{formData.physical_phones_needed}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Carrier:</dt>
                  <dd className="capitalize">{formData.target_carrier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Porting Numbers:</dt>
                  <dd>{formData.is_porting_numbers ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
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
              className="btn btn-primary flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.telephone_users}
              className="btn btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Migration'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
