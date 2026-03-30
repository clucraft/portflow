import { useState, useEffect } from 'react'
import type { Migration, Carrier } from '../services/api'

type SelectedMethod = 'A' | 'B' | 'C' | null

interface CostCalculatorData {
  // Shared inputs
  total_users: number
  dect_phones: number
  existing_headsets: number
  additional_headsets: number
  // Unit costs
  desk_phone_cost: number
  smartphone_cost: number
  headset_cost: number
  user_service_rate: number
  // Carrier
  carrier_monthly_flat: number
  activation_fee: number
  // Current system costs (annual)
  pbx_maintenance_annual: number
  carrier_annual: number
  usage_annual: number
  // Per-method desk phones
  desk_phones_a: number
  desk_phones_b: number
  desk_phones_c: number
  // Method B custom overrides
  smartphones_b: number
  headsets_b: number
  // Selected method
  selected_method: SelectedMethod
  // Notes
  notes: string
}

interface PricingRates {
  user_service_rate?: number
  phone_unit_cost?: number
  smartphone_unit_cost?: number
  headset_unit_cost?: number
  carrier_activation_fee?: number
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

interface CostCalculatorProps {
  migration: Migration
  pricingRates: PricingRates | null
  carriers: Carrier[] | undefined
  onSave: (data: {
    estimate_user_service_charge: number
    estimate_carrier_charge: number
    estimate_usage_charge: number
    estimate_phone_equipment_charge: number
    estimate_headset_equipment_charge: number
    estimate_notes: string
    cost_calculator: Record<string, unknown>
  }) => void
  onSaveCalculatorOnly: (data: {
    estimate_user_service_charge?: number
    estimate_carrier_charge?: number
    estimate_usage_charge?: number
    estimate_phone_equipment_charge?: number
    estimate_headset_equipment_charge?: number
    estimate_notes?: string
    cost_calculator: Record<string, unknown>
  }) => void
  currencySymbol: string
  isSaving: boolean
}

function initFromMigration(
  migration: Migration,
  pricingRates: PricingRates | null,
  carriers: Carrier[] | undefined
): CostCalculatorData {
  const saved = migration.cost_calculator as CostCalculatorData | null
  if (saved && typeof saved === 'object' && 'total_users' in saved) {
    return { ...saved }
  }

  // Pre-fill from questionnaire
  const q = (migration.site_questionnaire || {}) as Record<string, unknown>
  const totalUsers = Number(q.total_end_user_count) || 0
  const dectPhones = Number(q.dect_count) || 0
  const existingHeadsets = Number(q.headset_count) || 0
  const deskPhones = Number(q.personal_desk_phones) || 0

  // Unit costs from settings
  const deskPhoneCost = Number(pricingRates?.phone_unit_cost) || 0
  const smartphoneCost = Number(pricingRates?.smartphone_unit_cost) || 400
  const headsetCost = Number(pricingRates?.headset_unit_cost) || 0
  const userServiceRate = Number(pricingRates?.user_service_rate) || 3.45
  const activationFee = Number(pricingRates?.carrier_activation_fee) || 244

  // Carrier monthly from carrier record
  const carrierObj = carriers?.find(c => c.slug === migration.target_carrier)
  let carrierMonthly = Number(carrierObj?.monthly_charge) || 0
  if (carrierObj?.carrier_type === 'operator_connect' || carrierObj?.carrier_type === 'calling_plan') {
    carrierMonthly = parseFloat((carrierMonthly * totalUsers).toFixed(2))
  }

  return {
    total_users: totalUsers,
    dect_phones: dectPhones,
    existing_headsets: existingHeadsets,
    additional_headsets: 0,
    desk_phone_cost: deskPhoneCost,
    smartphone_cost: smartphoneCost,
    headset_cost: headsetCost,
    user_service_rate: userServiceRate,
    carrier_monthly_flat: carrierMonthly,
    activation_fee: activationFee,
    pbx_maintenance_annual: 0,
    carrier_annual: 0,
    usage_annual: 0,
    desk_phones_a: deskPhones,
    desk_phones_b: deskPhones,
    desk_phones_c: deskPhones,
    smartphones_b: 0,
    headsets_b: 0,
    selected_method: null,
    notes: migration.estimate_notes || '',
  }
}

function calcMethod(data: CostCalculatorData, method: 'A' | 'B' | 'C'): MethodResult {
  let deskPhones: number, smartphones: number, headsets: number

  if (method === 'A') {
    deskPhones = data.desk_phones_a
    smartphones = data.dect_phones
    const headsetsEst = Math.max(data.total_users - data.existing_headsets, 0)
    headsets = headsetsEst + data.additional_headsets
  } else if (method === 'B') {
    deskPhones = data.desk_phones_b
    smartphones = data.smartphones_b
    headsets = data.headsets_b
  } else {
    deskPhones = data.desk_phones_c
    smartphones = Math.round(data.dect_phones * 0.5)
    const headsetsEst = Math.round(data.total_users * 0.2)
    headsets = headsetsEst + data.additional_headsets
  }

  const onetime =
    deskPhones * data.desk_phone_cost +
    smartphones * data.smartphone_cost +
    headsets * data.headset_cost +
    data.activation_fee
  const monthly = data.total_users * data.user_service_rate + data.carrier_monthly_flat
  const annual = monthly * 12
  const firstYear = annual + onetime

  return { desk_phones: deskPhones, smartphones, headsets, onetime, monthly, annual, firstYear }
}

export default function CostCalculator({
  migration, pricingRates, carriers, onSave, onSaveCalculatorOnly, currencySymbol, isSaving,
}: CostCalculatorProps) {
  const [data, setData] = useState<CostCalculatorData>(() =>
    initFromMigration(migration, pricingRates, carriers)
  )

  // Re-init when migration.cost_calculator changes from server (e.g. after save)
  const [lastCalcJson, setLastCalcJson] = useState<string | null>(null)
  useEffect(() => {
    const serverJson = migration.cost_calculator ? JSON.stringify(migration.cost_calculator) : null
    if (serverJson && serverJson !== lastCalcJson) {
      setLastCalcJson(serverJson)
    }
  }, [migration.cost_calculator, lastCalcJson])

  const update = (patch: Partial<CostCalculatorData>) => setData(d => ({ ...d, ...patch }))

  const resultA = calcMethod(data, 'A')
  const resultB = calcMethod(data, 'B')
  const resultC = calcMethod(data, 'C')

  const handleApply = (method: 'A' | 'B' | 'C') => {
    update({ selected_method: method })
    const result = method === 'A' ? resultA : method === 'B' ? resultB : resultC
    const calcData = { ...data, selected_method: method }
    onSave({
      estimate_user_service_charge: parseFloat((data.total_users * data.user_service_rate).toFixed(2)),
      estimate_carrier_charge: parseFloat(data.carrier_monthly_flat.toFixed(2)),
      estimate_usage_charge: 0,
      estimate_phone_equipment_charge: parseFloat(
        (result.desk_phones * data.desk_phone_cost + result.smartphones * data.smartphone_cost).toFixed(2)
      ),
      estimate_headset_equipment_charge: parseFloat((result.headsets * data.headset_cost).toFixed(2)),
      estimate_notes: data.notes,
      cost_calculator: calcData as unknown as Record<string, unknown>,
    })
  }

  const handleSaveCalcOnly = () => {
    onSaveCalculatorOnly({
      cost_calculator: data as unknown as Record<string, unknown>,
    })
  }

  const fmt = (n: number) => n.toFixed(2)

  // Method A auto-derived values (display only)
  const smartphonesA = data.dect_phones
  const headsetsEstA = Math.max(data.total_users - data.existing_headsets, 0)
  const headsetsA = headsetsEstA + data.additional_headsets

  // Method C auto-derived values (display only)
  const smartphonesC = Math.round(data.dect_phones * 0.5)
  const headsetsEstC = Math.round(data.total_users * 0.2)
  const headsetsC = headsetsEstC + data.additional_headsets

  // Current system annual total
  const currentAnnual = data.pbx_maintenance_annual + data.carrier_annual + data.usage_annual

  return (
    <div className="space-y-4">
      {/* Site Inputs */}
      <div>
        <div className="text-sm text-zinc-400 mb-2">Site Inputs</div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="label">Total Users</label>
            <input type="number" className="input" value={data.total_users || ''}
              onChange={e => update({ total_users: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">DECT Phones</label>
            <input type="number" className="input" value={data.dect_phones || ''}
              onChange={e => update({ dect_phones: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Existing Headsets</label>
            <input type="number" className="input" value={data.existing_headsets || ''}
              onChange={e => update({ existing_headsets: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Additional Headsets</label>
            <input type="number" className="input" value={data.additional_headsets || ''}
              onChange={e => update({ additional_headsets: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      {/* Unit Costs */}
      <div>
        <div className="text-sm text-zinc-400 mb-2">Unit Costs (pre-filled from Settings)</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Desk Phone</label>
            <input type="number" className="input" step="0.01" value={data.desk_phone_cost || ''}
              onChange={e => update({ desk_phone_cost: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Smartphone</label>
            <input type="number" className="input" step="0.01" value={data.smartphone_cost || ''}
              onChange={e => update({ smartphone_cost: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Headset</label>
            <input type="number" className="input" step="0.01" value={data.headset_cost || ''}
              onChange={e => update({ headset_cost: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">User Service (per user/mo)</label>
            <input type="number" className="input" step="0.01" value={data.user_service_rate || ''}
              onChange={e => update({ user_service_rate: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Carrier Monthly</label>
            <input type="number" className="input" step="0.01" value={data.carrier_monthly_flat || ''}
              onChange={e => update({ carrier_monthly_flat: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Carrier Activation Fee</label>
            <input type="number" className="input" step="0.01" value={data.activation_fee || ''}
              onChange={e => update({ activation_fee: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      {/* Current System Costs */}
      <div>
        <div className="text-sm text-zinc-400 mb-2">Current System Costs (annual, for 3-year comparison)</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">PBX Maintenance</label>
            <input type="number" className="input" step="0.01" value={data.pbx_maintenance_annual || ''}
              onChange={e => update({ pbx_maintenance_annual: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Carrier Service</label>
            <input type="number" className="input" step="0.01" value={data.carrier_annual || ''}
              onChange={e => update({ carrier_annual: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Usage</label>
            <input type="number" className="input" step="0.01" value={data.usage_annual || ''}
              onChange={e => update({ usage_annual: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        {currentAnnual > 0 && (
          <div className="text-xs text-zinc-500 mt-1">
            Current annual total: {currencySymbol}{fmt(currentAnnual)}
          </div>
        )}
      </div>

      {/* 3-Method Comparison Table */}
      <div>
        <div className="text-sm text-zinc-400 mb-2">Method Comparison</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-surface-600">
                <th className="text-left py-2 text-zinc-400 font-medium w-32"></th>
                <th className="text-center py-2 text-zinc-300 font-medium px-2">A: Report</th>
                <th className="text-center py-2 text-zinc-300 font-medium px-2">B: Custom</th>
                <th className="text-center py-2 text-zinc-300 font-medium px-2">C: 20%/50%</th>
              </tr>
            </thead>
            <tbody>
              {/* Desk Phones */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">Desk Phones</td>
                <td className="text-center px-2">
                  <input type="number" className="input text-center py-1" value={data.desk_phones_a || ''}
                    onChange={e => update({ desk_phones_a: parseInt(e.target.value) || 0 })} />
                </td>
                <td className="text-center px-2">
                  <input type="number" className="input text-center py-1" value={data.desk_phones_b || ''}
                    onChange={e => update({ desk_phones_b: parseInt(e.target.value) || 0 })} />
                </td>
                <td className="text-center px-2">
                  <input type="number" className="input text-center py-1" value={data.desk_phones_c || ''}
                    onChange={e => update({ desk_phones_c: parseInt(e.target.value) || 0 })} />
                </td>
              </tr>
              {/* Smartphones */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">Smartphones</td>
                <td className="text-center px-2">
                  <span className="text-zinc-500 text-xs">= DECT ({smartphonesA})</span>
                </td>
                <td className="text-center px-2">
                  <input type="number" className="input text-center py-1" value={data.smartphones_b || ''}
                    onChange={e => update({ smartphones_b: parseInt(e.target.value) || 0 })} />
                </td>
                <td className="text-center px-2">
                  <span className="text-zinc-500 text-xs">= DECT&times;0.5 ({smartphonesC})</span>
                </td>
              </tr>
              {/* Headsets */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">Headsets</td>
                <td className="text-center px-2">
                  <span className="text-zinc-500 text-xs">users-existing+add'l ({headsetsA})</span>
                </td>
                <td className="text-center px-2">
                  <input type="number" className="input text-center py-1" value={data.headsets_b || ''}
                    onChange={e => update({ headsets_b: parseInt(e.target.value) || 0 })} />
                </td>
                <td className="text-center px-2">
                  <span className="text-zinc-500 text-xs">users&times;0.2+add'l ({headsetsC})</span>
                </td>
              </tr>
              {/* Separator */}
              <tr className="border-b border-surface-500">
                <td colSpan={4} className="py-0"></td>
              </tr>
              {/* One-time */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">One-time</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultA.onetime)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultB.onetime)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultC.onetime)}</td>
              </tr>
              {/* Monthly */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">Monthly</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultA.monthly)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultB.monthly)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultC.monthly)}</td>
              </tr>
              {/* Annual */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-400">Annual</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultA.annual)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultB.annual)}</td>
                <td className="text-center text-zinc-200 font-mono px-2">{currencySymbol}{fmt(resultC.annual)}</td>
              </tr>
              {/* 1st Year */}
              <tr className="border-b border-surface-700">
                <td className="py-1.5 text-zinc-300 font-medium">1st Year</td>
                <td className="text-center text-primary-400 font-mono font-medium px-2">{currencySymbol}{fmt(resultA.firstYear)}</td>
                <td className="text-center text-primary-400 font-mono font-medium px-2">{currencySymbol}{fmt(resultB.firstYear)}</td>
                <td className="text-center text-primary-400 font-mono font-medium px-2">{currencySymbol}{fmt(resultC.firstYear)}</td>
              </tr>
              {/* Apply buttons */}
              <tr>
                <td className="py-2"></td>
                {(['A', 'B', 'C'] as const).map(m => (
                  <td key={m} className="text-center py-2 px-2">
                    <button
                      onClick={() => handleApply(m)}
                      disabled={isSaving}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        data.selected_method === m
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-700 text-zinc-300 hover:bg-surface-600'
                      }`}
                    >
                      {data.selected_method === m ? 'Applied' : 'Apply'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Year Comparison (if current costs entered) */}
      {currentAnnual > 0 && data.selected_method && (() => {
        const result = data.selected_method === 'A' ? resultA : data.selected_method === 'B' ? resultB : resultC
        const teamsYear1 = result.firstYear
        const teamsYear2 = result.annual
        const teamsYear3 = result.annual
        const currentTotal3 = currentAnnual * 3
        const teamsTotal3 = teamsYear1 + teamsYear2 + teamsYear3
        return (
          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
            <div className="text-sm text-green-400 font-medium mb-2">3-Year Savings (Method {data.selected_method})</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div></div>
              <div className="text-center text-zinc-400">Year 1</div>
              <div className="text-center text-zinc-400">Year 2</div>
              <div className="text-center text-zinc-400">Year 3</div>
              <div className="text-zinc-400">Current</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(currentAnnual)}</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(currentAnnual)}</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(currentAnnual)}</div>
              <div className="text-zinc-400">Teams EV</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(teamsYear1)}</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(teamsYear2)}</div>
              <div className="text-center text-zinc-300 font-mono">{currencySymbol}{fmt(teamsYear3)}</div>
              <div className="text-green-400 font-medium">Savings</div>
              <div className="text-center text-green-400 font-mono">{currencySymbol}{fmt(currentAnnual - teamsYear1)}</div>
              <div className="text-center text-green-400 font-mono">{currencySymbol}{fmt(currentAnnual - teamsYear2)}</div>
              <div className="text-center text-green-400 font-mono">{currencySymbol}{fmt(currentAnnual - teamsYear3)}</div>
            </div>
            <div className="text-xs text-green-400 mt-2 font-medium">
              3-Year Total Savings: {currencySymbol}{fmt(currentTotal3 - teamsTotal3)}
            </div>
          </div>
        )
      })()}

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[60px]"
          value={data.notes}
          onChange={e => update({ notes: e.target.value })}
          placeholder="Additional notes..."
        />
      </div>

      {/* Save Calculator button */}
      <div className="flex gap-2">
        <button
          onClick={handleSaveCalcOnly}
          className="btn btn-secondary"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Calculator'}
        </button>
      </div>
    </div>
  )
}
