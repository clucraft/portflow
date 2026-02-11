import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, Zap, DollarSign, Users, Check, AlertCircle } from 'lucide-react'
import { publicApi } from '../services/api'

// Helper to safely format currency (handles string/number/null)
const formatCurrency = (value: unknown): string => {
  const num = Number(value)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

export default function EstimateAccept() {
  const { token } = useParams<{ token: string }>()
  const [acceptedBy, setAcceptedBy] = useState('')
  const [accepted, setAccepted] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['estimate', token],
    queryFn: () => publicApi.getEstimate(token!),
    enabled: !!token,
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () => publicApi.acceptEstimate(token!, acceptedBy || undefined),
    onSuccess: () => {
      setAccepted(true)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-8 w-8 text-primary-500 mx-auto animate-pulse" />
          <p className="mt-2 text-zinc-500">Loading estimate...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (error as Error)?.message
      || 'Unknown error'

    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Link Invalid or Expired</h1>
          <p className="text-zinc-400 mb-4">
            This estimate link is no longer valid. Please contact your administrator for a new link.
          </p>
          <p className="text-xs text-zinc-600 font-mono bg-surface-800 p-2 rounded">
            {errorMessage}
          </p>
        </div>
      </div>
    )
  }

  const migration = data?.migration

  if (!migration) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="card max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Estimate Not Found</h1>
          <p className="text-zinc-400">
            Unable to load estimate data. The link may be invalid or the estimate hasn't been created yet.
          </p>
        </div>
      </div>
    )
  }

  const alreadyAccepted = !!migration.estimate_accepted_at

  if (accepted || alreadyAccepted) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Estimate Accepted</h1>
          <p className="text-zinc-400 mb-4">
            {alreadyAccepted && !accepted
              ? 'This estimate has already been accepted.'
              : 'Thank you for accepting the estimate. Your migration project will now proceed to the next phase.'}
          </p>
          <p className="text-sm text-zinc-500">
            You can close this window.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            <Phone className="h-8 w-8 text-primary-400" />
            <Zap className="h-3 w-3 text-primary-300 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-400 text-glow">PortFlow</h1>
            <p className="text-xs text-zinc-500 tracking-wider">COST ESTIMATE REVIEW</p>
          </div>
        </div>

        {/* Project Info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Project Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-zinc-500">Project Name</p>
              <p className="text-zinc-200 font-medium">{migration.name}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Site</p>
              <p className="text-zinc-200">
                {migration.site_name}
                {migration.site_city && `, ${migration.site_city}`}
                {migration.site_state && `, ${migration.site_state}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Telephone Users</p>
              <p className="text-zinc-200">{migration.telephone_users}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Physical Phones</p>
              <p className="text-zinc-200">{migration.physical_phones_needed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Target Carrier</p>
              <p className="text-zinc-200 capitalize">{migration.target_carrier}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Routing Type</p>
              <p className="text-zinc-200 capitalize">{migration.routing_type?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Cost Estimate */}
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Cost Estimate</h2>
          </div>

          <div className="space-y-3">
            {/* Monthly line items */}
            {Number(migration.estimate_carrier_charge) > 0 && (
              <div className="flex justify-between py-2 border-b border-surface-600">
                <span className="text-zinc-400">Carrier Charge (Monthly)</span>
                <span className="text-zinc-200 font-mono">
                  ${formatCurrency(migration.estimate_carrier_charge)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-surface-600">
              <span className="text-zinc-400">User Service Charge (Monthly)</span>
              <span className="text-zinc-200 font-mono">
                ${formatCurrency(migration.estimate_user_service_charge)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-600">
              <span className="text-zinc-400">Usage Charge (Monthly)</span>
              <span className="text-zinc-200 font-mono">
                ${formatCurrency(migration.estimate_usage_charge)}
              </span>
            </div>

            {/* Equipment line items - split if phone/headset available, fallback to single line */}
            {(migration.estimate_phone_equipment_charge != null || migration.estimate_headset_equipment_charge != null) ? (
              <>
                {Number(migration.estimate_phone_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Phone Equipment (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      ${formatCurrency(migration.estimate_phone_equipment_charge)}
                    </span>
                  </div>
                )}
                {Number(migration.estimate_headset_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Headset Equipment (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      ${formatCurrency(migration.estimate_headset_equipment_charge)}
                    </span>
                  </div>
                )}
                {Number(migration.estimate_phone_equipment_charge) === 0 && Number(migration.estimate_headset_equipment_charge) === 0 && Number(migration.estimate_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Equipment Charge (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      ${formatCurrency(migration.estimate_equipment_charge)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              Number(migration.estimate_equipment_charge) > 0 && (
                <div className="flex justify-between py-2 border-b border-surface-600">
                  <span className="text-zinc-400">Equipment Charge (One-time)</span>
                  <span className="text-zinc-200 font-mono">
                    ${formatCurrency(migration.estimate_equipment_charge)}
                  </span>
                </div>
              )
            )}

            {/* Totals */}
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">Monthly Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  ${formatCurrency(migration.estimate_total_monthly)}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">Annual Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  ${formatCurrency(Number(migration.estimate_total_monthly || 0) * 12)}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">One-time Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  ${formatCurrency(migration.estimate_total_onetime)}
                </span>
              </div>
            </div>
          </div>

          {migration.estimate_notes && (
            <div className="mt-4 p-3 bg-surface-700/50 rounded-lg border border-surface-600">
              <p className="text-sm text-zinc-400 font-medium mb-1">Notes</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{migration.estimate_notes}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card bg-primary-500/10 border-primary-500/30 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary-400" />
            <h3 className="font-medium text-primary-400">Summary</h3>
          </div>
          <p className="text-zinc-300 text-sm">
            This estimate covers Teams Enterprise Voice migration for <strong>{migration.telephone_users} users</strong>
            {(migration.physical_phones_needed ?? 0) > 0 && (
              <> with <strong>{migration.physical_phones_needed} physical phones</strong></>
            )}
            {Number(migration.estimate_headset_equipment_charge) > 0 && ' and headsets'}
            {' '}using <strong className="capitalize">{migration.routing_type?.replace('_', ' ')}</strong> via{' '}
            <strong className="capitalize">{migration.target_carrier}</strong>.
          </p>
        </div>

        {/* Accept Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Accept Estimate</h2>
          <p className="text-zinc-400 text-sm mb-4">
            By accepting this estimate, you authorize the migration project to proceed to the next phase.
          </p>

          <div className="mb-4">
            <label className="label">Your Name (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={acceptedBy}
              onChange={(e) => setAcceptedBy(e.target.value)}
            />
          </div>

          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {acceptMutation.isPending ? (
              'Accepting...'
            ) : (
              <>
                <Check className="h-5 w-5" />
                Accept Estimate
              </>
            )}
          </button>

          {acceptMutation.isError && (
            <p className="text-red-400 text-sm mt-3 text-center">
              Failed to accept estimate. Please try again.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Powered by PortFlow - Enterprise Voice Migration Manager
        </p>
      </div>
    </div>
  )
}
