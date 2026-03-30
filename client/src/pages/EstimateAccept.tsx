import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, Zap, DollarSign, Users, Check, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react'
import { publicApi, formatRoutingType } from '../services/api'
import ParticleBackground from '../components/ParticleBackground'

// Helper to safely format currency (handles string/number/null)
const formatCurrency = (value: unknown): string => {
  const num = Number(value)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

// Compact currency format for chart labels (e.g. "$12,244" or "CHF 12,244")
const formatCompact = (value: number, symbol: string): string => {
  if (value >= 1000) {
    return `${symbol}${Math.round(value).toLocaleString()}`
  }
  return `${symbol}${value.toFixed(0)}`
}

// Replicate CostCalculator method logic for customer page
interface CalcData {
  total_users: number
  dect_phones: number
  existing_headsets: number
  additional_headsets: number
  desk_phone_cost: number
  smartphone_cost: number
  headset_cost: number
  user_service_rate: number
  carrier_monthly_flat: number
  activation_fee: number
  pbx_maintenance_annual: number
  carrier_annual: number
  usage_annual: number
  desk_phones_a: number
  desk_phones_b: number
  desk_phones_c: number
  smartphones_b: number
  headsets_b: number
  selected_method: string | null
}

interface MethodResult {
  desk_phones: number
  smartphones: number
  headsets: number
  onetime: number
  monthly: number
  annual: number
  firstYear: number
}

function calcMethod(data: CalcData, method: 'A' | 'B' | 'C'): MethodResult {
  let deskPhones: number, smartphones: number, headsets: number
  if (method === 'A') {
    deskPhones = data.desk_phones_a
    smartphones = data.dect_phones
    headsets = Math.max(data.total_users - data.existing_headsets, 0) + data.additional_headsets
  } else if (method === 'B') {
    deskPhones = data.desk_phones_b
    smartphones = data.smartphones_b
    headsets = data.headsets_b
  } else {
    deskPhones = data.desk_phones_c
    smartphones = Math.round(data.dect_phones * 0.5)
    headsets = Math.round(data.total_users * 0.2) + data.additional_headsets
  }
  const onetime = deskPhones * data.desk_phone_cost + smartphones * data.smartphone_cost + headsets * data.headset_cost + data.activation_fee
  const monthly = data.total_users * data.user_service_rate + data.carrier_monthly_flat
  const annual = monthly * 12
  return { desk_phones: deskPhones, smartphones, headsets, onetime, monthly, annual, firstYear: annual + onetime }
}

const METHOD_LABELS: Record<string, string> = { A: 'Method A (Report)', B: 'Method B (Custom)', C: 'Method C (20%/50%)' }

// SVG Cumulative Line Chart component
function CumulativeChart({ currentAnnual, teamsYear1, teamsAnnual, currencySymbol }: {
  currentAnnual: number; teamsYear1: number; teamsAnnual: number; currencySymbol: string
}) {
  // Data points: start, end of Y1, end of Y2, end of Y3
  const currentPoints = [0, currentAnnual, currentAnnual * 2, currentAnnual * 3]
  const teamsPoints = [0, teamsYear1, teamsYear1 + teamsAnnual, teamsYear1 + teamsAnnual * 2]

  const maxVal = Math.max(...currentPoints, ...teamsPoints)
  if (maxVal === 0) return null

  // Chart dimensions
  const w = 580, h = 200, padL = 12, padR = 72, padT = 16, padB = 28
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  const toX = (i: number) => padL + (i / 3) * plotW
  const toY = (v: number) => padT + plotH - (v / maxVal) * plotH

  const currentPath = currentPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const teamsPath = teamsPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  // Fill area between the two lines (savings area)
  const fillPath = `${currentPath} L${toX(3).toFixed(1)},${toY(teamsPoints[3]).toFixed(1)} L${toX(2).toFixed(1)},${toY(teamsPoints[2]).toFixed(1)} L${toX(1).toFixed(1)},${toY(teamsPoints[1]).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxWidth: 580 }}>
      {/* Grid lines */}
      {[0, 1, 2, 3].map(i => (
        <line key={`grid-${i}`} x1={toX(i)} y1={padT} x2={toX(i)} y2={padT + plotH} stroke="#3f3f46" strokeWidth="0.5" />
      ))}
      {/* Savings fill */}
      <path d={fillPath} fill="#22c55e" opacity="0.08" />
      {/* Current system line */}
      <path d={currentPath} fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Teams line */}
      <path d={teamsPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Data points */}
      {currentPoints.map((v, i) => i > 0 && (
        <circle key={`cp-${i}`} cx={toX(i)} cy={toY(v)} r="3.5" fill="#f87171" />
      ))}
      {teamsPoints.map((v, i) => i > 0 && (
        <circle key={`tp-${i}`} cx={toX(i)} cy={toY(v)} r="3.5" fill="#22d3ee" />
      ))}
      {/* End labels */}
      <text x={toX(3) + 2} y={toY(currentPoints[3]) - 6} fill="#f87171" fontSize="10" fontFamily="monospace">
        {formatCompact(currentPoints[3], currencySymbol)}
      </text>
      <text x={toX(3) + 2} y={toY(teamsPoints[3]) + 14} fill="#22d3ee" fontSize="10" fontFamily="monospace">
        {formatCompact(teamsPoints[3], currencySymbol)}
      </text>
      {/* X-axis labels */}
      {['Start', 'Year 1', 'Year 2', 'Year 3'].map((label, i) => (
        <text key={label} x={toX(i)} y={h - 4} fill="#71717a" fontSize="10" textAnchor="middle">{label}</text>
      ))}
      {/* Legend */}
      <line x1={padL} y1={6} x2={padL + 16} y2={6} stroke="#f87171" strokeWidth="2" />
      <text x={padL + 20} y={10} fill="#f87171" fontSize="9">Current System</text>
      <line x1={padL + 120} y1={6} x2={padL + 136} y2={6} stroke="#22d3ee" strokeWidth="2" />
      <text x={padL + 140} y={10} fill="#22d3ee" fontSize="9">Teams EV</text>
    </svg>
  )
}

// Bar chart component for year-by-year comparison
function YearlyBarChart({ currentAnnual, teamsYear1, teamsAnnual, currencySymbol }: {
  currentAnnual: number; teamsYear1: number; teamsAnnual: number; currencySymbol: string
}) {
  const years = [
    { label: 'Year 1', current: currentAnnual, teams: teamsYear1 },
    { label: 'Year 2', current: currentAnnual, teams: teamsAnnual },
    { label: 'Year 3', current: currentAnnual, teams: teamsAnnual },
  ]
  const maxVal = Math.max(...years.flatMap(y => [y.current, y.teams]))
  if (maxVal === 0) return null

  const pct = (v: number) => Math.max((v / maxVal) * 100, 1)

  return (
    <div className="space-y-3">
      {years.map(y => (
        <div key={y.label}>
          <div className="text-xs text-zinc-400 mb-1">{y.label}</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-zinc-500 text-right shrink-0">Current</div>
              <div className="flex-1 bg-surface-700 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-red-400/70 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${pct(y.current)}%` }}
                >
                  <span className="text-[10px] font-mono text-white whitespace-nowrap">{formatCompact(y.current, currencySymbol)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-zinc-500 text-right shrink-0">Teams</div>
              <div className="flex-1 bg-surface-700 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-primary-400/70 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${pct(y.teams)}%` }}
                >
                  <span className="text-[10px] font-mono text-white whitespace-nowrap">{formatCompact(y.teams, currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EstimateAccept() {
  const { token } = useParams<{ token: string }>()
  const [acceptedBy, setAcceptedBy] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [showConverted, setShowConverted] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<{ rate: number; date: string } | null>(null)
  const [exchangeLoading, setExchangeLoading] = useState(false)

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

  const migration = data?.migration
  const currency = migration?.currency || 'USD'
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'CHF' ? 'CHF ' : '$'
  const otherCurrency = currency === 'EUR' ? 'USD' : 'EUR'
  const otherSymbol = currency === 'EUR' ? '$' : '€'

  useEffect(() => {
    if (!showConverted || exchangeRate) return
    setExchangeLoading(true)
    fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=${otherCurrency}`)
      .then(res => res.json())
      .then(data => {
        setExchangeRate({ rate: data.rates[otherCurrency], date: data.date })
      })
      .catch(() => {})
      .finally(() => setExchangeLoading(false))
  }, [showConverted, exchangeRate, currency, otherCurrency])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center relative">
        <ParticleBackground />
        <div className="text-center relative z-10">
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
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative">
        <ParticleBackground />
        <div className="card max-w-md text-center relative z-10">
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

  if (!migration) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center relative">
        <ParticleBackground />
        <div className="card max-w-md text-center relative z-10">
          <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Estimate Not Found</h1>
          <p className="text-zinc-400">
            Unable to load estimate data. The link may be invalid or the estimate hasn't been created yet.
          </p>
        </div>
      </div>
    )
  }

  const qData = (migration.site_questionnaire || {}) as Record<string, unknown>
  const endUsers = Number(qData.total_end_user_count) || 0
  const deskPhones = Number(qData.personal_desk_phones) || 0
  const headsets = Number(qData.headset_count) || 0
  const alreadyAccepted = !!migration.estimate_accepted_at

  // Compute alternative methods if cost_calculator data is available
  const calc = migration.cost_calculator as CalcData | null
  const hasCalcData = calc && typeof calc === 'object' && 'total_users' in calc
  const selectedMethod = hasCalcData ? calc.selected_method : null
  const alternativeMethods = hasCalcData
    ? (['A', 'B', 'C'] as const).filter(m => m !== selectedMethod).map(m => ({ method: m, result: calcMethod(calc, m) }))
    : []

  // 3-year comparison data
  const pbxMaintenance = hasCalcData ? (Number(calc.pbx_maintenance_annual) || 0) : 0
  const carrierAnnual = hasCalcData ? (Number(calc.carrier_annual) || 0) : 0
  const usageAnnual = hasCalcData ? (Number(calc.usage_annual) || 0) : 0
  const currentAnnual = pbxMaintenance + carrierAnnual + usageAnnual
  const teamsMonthly = Number(migration.estimate_total_monthly) || 0
  const teamsOnetime = Number(migration.estimate_total_onetime) || 0
  const teamsAnnual = teamsMonthly * 12
  const teamsYear1 = teamsAnnual + teamsOnetime

  if (accepted || alreadyAccepted) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative">
        <ParticleBackground />
        <div className="card max-w-md text-center relative z-10">
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
    <div className="min-h-screen bg-surface-900 p-4 md:p-8 relative">
      <ParticleBackground />
      <div className="max-w-2xl mx-auto relative z-10">
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
              <p className="text-sm text-zinc-500">End Users</p>
              <p className="text-zinc-200">{endUsers}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Desk Phones</p>
              <p className="text-zinc-200">{deskPhones}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Headsets</p>
              <p className="text-zinc-200">{headsets}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Target Carrier</p>
              <p className="text-zinc-200 capitalize">{migration.target_carrier}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Routing Type</p>
              <p className="text-zinc-200">{formatRoutingType(migration.routing_type)}</p>
            </div>
          </div>
        </div>

        {/* Cost Estimate */}
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              Cost Estimate ({currency})
              {selectedMethod && (
                <span className="text-sm font-normal text-zinc-500 ml-2">
                  — {METHOD_LABELS[selectedMethod] || `Method ${selectedMethod}`}
                </span>
              )}
            </h2>
          </div>

          <div className="space-y-3">
            {/* Monthly line items */}
            {Number(migration.estimate_carrier_charge) > 0 && (
              <div className="flex justify-between py-2 border-b border-surface-600">
                <span className="text-zinc-400">Carrier Charge (Monthly)</span>
                <span className="text-zinc-200 font-mono">
                  {currencySymbol}{formatCurrency(migration.estimate_carrier_charge)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-surface-600">
              <span className="text-zinc-400">User Service Charge (Monthly)</span>
              <span className="text-zinc-200 font-mono">
                {currencySymbol}{formatCurrency(migration.estimate_user_service_charge)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-600">
              <span className="text-zinc-400">Usage Charge (Monthly)</span>
              <span className="text-zinc-200 font-mono">
                {currencySymbol}{formatCurrency(migration.estimate_usage_charge)}
              </span>
            </div>

            {/* Equipment line items - split if phone/headset available, fallback to single line */}
            {(migration.estimate_phone_equipment_charge != null || migration.estimate_headset_equipment_charge != null) ? (
              <>
                {Number(migration.estimate_phone_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Phone Equipment (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      {currencySymbol}{formatCurrency(migration.estimate_phone_equipment_charge)}
                    </span>
                  </div>
                )}
                {Number(migration.estimate_headset_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Headset Equipment (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      {currencySymbol}{formatCurrency(migration.estimate_headset_equipment_charge)}
                    </span>
                  </div>
                )}
                {Number(migration.estimate_phone_equipment_charge) === 0 && Number(migration.estimate_headset_equipment_charge) === 0 && Number(migration.estimate_equipment_charge) > 0 && (
                  <div className="flex justify-between py-2 border-b border-surface-600">
                    <span className="text-zinc-400">Equipment Charge (One-time)</span>
                    <span className="text-zinc-200 font-mono">
                      {currencySymbol}{formatCurrency(migration.estimate_equipment_charge)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              Number(migration.estimate_equipment_charge) > 0 && (
                <div className="flex justify-between py-2 border-b border-surface-600">
                  <span className="text-zinc-400">Equipment Charge (One-time)</span>
                  <span className="text-zinc-200 font-mono">
                    {currencySymbol}{formatCurrency(migration.estimate_equipment_charge)}
                  </span>
                </div>
              )
            )}

            {/* Totals */}
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">Monthly Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  {currencySymbol}{formatCurrency(migration.estimate_total_monthly)}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">Annual Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  {currencySymbol}{formatCurrency(Number(migration.estimate_total_monthly || 0) * 12)}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-zinc-300 font-medium">One-time Total</span>
                <span className="text-primary-400 font-bold font-mono">
                  {currencySymbol}{formatCurrency(migration.estimate_total_onetime)}
                </span>
              </div>
            </div>

            {/* Show in other currency toggle */}
            <div className="pt-3 border-t border-surface-600">
              <button
                onClick={() => setShowConverted(!showConverted)}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${exchangeLoading ? 'animate-spin' : ''}`} />
                {showConverted ? `Hide ${otherCurrency} conversion` : `Show in ${otherCurrency}`}
              </button>
              {showConverted && exchangeRate && (
                <div className="mt-3 p-3 bg-surface-700/50 rounded-lg border border-surface-600 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Monthly Total</span>
                    <span className="text-zinc-300 font-mono">
                      {otherSymbol}{formatCurrency(Number(migration.estimate_total_monthly || 0) * exchangeRate.rate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Annual Total</span>
                    <span className="text-zinc-300 font-mono">
                      {otherSymbol}{formatCurrency(Number(migration.estimate_total_monthly || 0) * 12 * exchangeRate.rate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">One-time Total</span>
                    <span className="text-zinc-300 font-mono">
                      {otherSymbol}{formatCurrency(Number(migration.estimate_total_onetime || 0) * exchangeRate.rate)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Exchange rate: {exchangeRate.rate.toFixed(4)} as of {exchangeRate.date} (ECB reference rate)
                  </p>
                </div>
              )}
              {showConverted && exchangeLoading && (
                <p className="mt-2 text-xs text-zinc-500">Loading exchange rate...</p>
              )}
            </div>
          </div>

          {migration.estimate_notes && (
            <div className="mt-4 p-3 bg-surface-700/50 rounded-lg border border-surface-600">
              <p className="text-sm text-zinc-400 font-medium mb-1">Notes</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{migration.estimate_notes}</p>
            </div>
          )}

          {/* Alternative Estimates (collapsible) */}
          {alternativeMethods.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-600">
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1.5 transition-colors"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
                {showAlternatives ? 'Hide alternative estimates' : 'View alternative estimates'}
              </button>
              {showAlternatives && (
                <div className="mt-3 space-y-3">
                  {alternativeMethods.map(({ method, result }) => (
                    <div key={method} className="p-3 bg-surface-700/50 rounded-lg border border-surface-600">
                      <div className="text-sm font-medium text-zinc-300 mb-2">{METHOD_LABELS[method]}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500">Desk Phones</span>
                          <p className="text-zinc-300">{result.desk_phones}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Smartphones</span>
                          <p className="text-zinc-300">{result.smartphones}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Headsets</span>
                          <p className="text-zinc-300">{result.headsets}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-surface-600 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500">Monthly</span>
                          <p className="text-zinc-200 font-mono">{currencySymbol}{formatCurrency(result.monthly)}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">One-time</span>
                          <p className="text-zinc-200 font-mono">{currencySymbol}{formatCurrency(result.onetime)}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">1st Year</span>
                          <p className="text-zinc-200 font-mono">{currencySymbol}{formatCurrency(result.firstYear)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3-Year Cost Comparison */}
        {currentAnnual > 0 && (() => {
          const teamsYear2 = teamsAnnual
          const teamsYear3 = teamsAnnual
          const currentTotal3 = currentAnnual * 3
          const teamsTotal3 = teamsYear1 + teamsYear2 + teamsYear3
          const savingsTotal = currentTotal3 - teamsTotal3

          return (
            <div className="card mb-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-semibold text-zinc-100">3-Year Cost Comparison</h2>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-600">
                      <th className="text-left py-2 text-zinc-400 font-medium"></th>
                      <th className="text-right py-2 text-zinc-400 font-medium px-3">Year 1</th>
                      <th className="text-right py-2 text-zinc-400 font-medium px-3">Year 2</th>
                      <th className="text-right py-2 text-zinc-400 font-medium px-3">Year 3</th>
                      <th className="text-right py-2 text-zinc-400 font-medium px-3">3-Year Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-700">
                      <td className="py-2 text-zinc-300">Current System</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono font-medium px-3">{currencySymbol}{formatCurrency(currentTotal3)}</td>
                    </tr>
                    <tr className="border-b border-surface-700">
                      <td className="py-2 text-zinc-300">Teams EV</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(teamsYear1)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(teamsYear2)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono px-3">{currencySymbol}{formatCurrency(teamsYear3)}</td>
                      <td className="text-right py-2 text-zinc-200 font-mono font-medium px-3">{currencySymbol}{formatCurrency(teamsTotal3)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-green-400 font-medium">Savings</td>
                      <td className="text-right py-2 text-green-400 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual - teamsYear1)}</td>
                      <td className="text-right py-2 text-green-400 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual - teamsYear2)}</td>
                      <td className="text-right py-2 text-green-400 font-mono px-3">{currencySymbol}{formatCurrency(currentAnnual - teamsYear3)}</td>
                      <td className="text-right py-2 text-green-400 font-mono font-bold px-3">{currencySymbol}{formatCurrency(savingsTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Yearly Bar Chart */}
              <div className="mt-6 pt-4 border-t border-surface-700">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Annual Cost Breakdown</h3>
                <YearlyBarChart
                  currentAnnual={currentAnnual}
                  teamsYear1={teamsYear1}
                  teamsAnnual={teamsAnnual}
                  currencySymbol={currencySymbol}
                />
              </div>

              {/* Cumulative Line Chart */}
              <div className="mt-6 pt-4 border-t border-surface-700">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Cumulative Spend Over 3 Years</h3>
                <CumulativeChart
                  currentAnnual={currentAnnual}
                  teamsYear1={teamsYear1}
                  teamsAnnual={teamsAnnual}
                  currencySymbol={currencySymbol}
                />
                {savingsTotal > 0 && (
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <span className="text-green-400 font-medium">
                      Projected 3-year savings: {currencySymbol}{formatCurrency(savingsTotal)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Summary */}
        <div className="card bg-primary-500/10 border-primary-500/30 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary-400" />
            <h3 className="font-medium text-primary-400">Summary</h3>
          </div>
          <p className="text-zinc-300 text-sm">
            This estimate covers Teams Enterprise Voice migration for <strong>{endUsers} users</strong>
            {deskPhones > 0 && (
              <> with <strong>{deskPhones} desk phones</strong></>
            )}
            {headsets > 0 && (
              <> and <strong>{headsets} headsets</strong></>
            )}
            {' '}using <strong>{formatRoutingType(migration.routing_type)}</strong> via{' '}
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
            <label className="label">Your Name *</label>
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
            disabled={acceptMutation.isPending || !acceptedBy.trim()}
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
