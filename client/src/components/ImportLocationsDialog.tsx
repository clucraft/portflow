import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Link2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { locationsApi, type Location } from '../services/api'

interface Props {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

// Map Excel column headers (and common variations) to internal field names.
// Fuzzy match: case-insensitive startsWith.
const COLUMN_MAP: Record<string, keyof Location> = {
  'Site Code': 'site_code',
  'Location': 'location_name',
  'Region': 'region',
  'Country': 'country',
  'Company': 'company',
  'TN Users': 'estimated_users',
  'Estimated Users': 'estimated_users',
  'Priority': 'priority',
  'Complexity Reasons': 'complexity_reasons',
  'Complexity': 'complexity',
  'Assigned Engineer': 'assigned_engineer',
  'Local IT Contact': 'local_it_contact',
  'Verizon Request': 'verizon_request_submitted_date',
  'Setup Complete': 'setup_complete_date',
  'Kick-off w/ Local IT': 'kickoff_with_it_date',
  'Kick-off w/Local IT': 'kickoff_with_it_date',
  'Kickoff w/ Local IT': 'kickoff_with_it_date',
  'Kick-off Complete': 'kickoff_complete_date',
  'Kickoff Complete': 'kickoff_complete_date',
  'Port Scheduling': 'port_scheduling_submitted_date',
  'Port Complete': 'port_complete_date',
  'Hypercare Start': 'hypercare_start_date',
  'Hypercare End': 'hypercare_end_date',
  'Notes': 'notes',
  'Status': 'status',
  'Planned Start': 'planned_start_date',
  'Planned End': 'planned_end_date',
}

// Excel stores dates as serial numbers (days since 1900). Convert if needed.
function excelDateToISO(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    // Excel epoch: Jan 1 1900, but with the leap-year bug. Use SheetJS conversion.
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    const yyyy = String(date.y).padStart(4, '0')
    const mm = String(date.m).padStart(2, '0')
    const dd = String(date.d).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  // Try parsing string
  const d = new Date(String(value))
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function normalizeStatus(s: unknown): string {
  if (!s) return 'planned'
  const v = String(s).toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (['planned', 'in_progress', 'completed', 'on_hold', 'cancelled', 'out_of_scope'].includes(v)) return v
  // Handle common variants
  if (v.includes('progress')) return 'in_progress'
  if (v.includes('hold')) return 'on_hold'
  if (v.includes('complete')) return 'completed'
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('out') || v.includes('scope')) return 'out_of_scope'
  return 'planned'
}

const DATE_FIELDS = new Set([
  'planned_start_date', 'planned_end_date',
  'verizon_request_submitted_date', 'setup_complete_date',
  'kickoff_with_it_date', 'kickoff_complete_date',
  'port_scheduling_submitted_date', 'port_complete_date',
  'hypercare_start_date', 'hypercare_end_date',
])

function mapRow(raw: Record<string, unknown>): Partial<Location> {
  const out: Record<string, unknown> = {}
  for (const [excelCol, val] of Object.entries(raw)) {
    let field = COLUMN_MAP[excelCol]
    if (!field) {
      const lower = excelCol.toLowerCase().replace(/\s+/g, ' ').trim()
      for (const [k, v] of Object.entries(COLUMN_MAP)) {
        if (lower.startsWith(k.toLowerCase())) {
          field = v
          break
        }
      }
    }
    if (!field) continue
    if (val == null || val === '') continue

    if (DATE_FIELDS.has(field)) {
      const iso = excelDateToISO(val)
      if (iso) out[field] = iso
    } else if (field === 'estimated_users') {
      const n = Number(val)
      if (!isNaN(n)) out[field] = n
    } else if (field === 'status') {
      out[field] = normalizeStatus(val)
    } else if (field === 'site_code') {
      out[field] = String(val).trim().toUpperCase()
    } else {
      out[field] = String(val).trim()
    }
  }
  return out as Partial<Location>
}

type Step = 'file' | 'preview' | 'done'

export default function ImportLocationsDialog({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<Partial<Location>[]>([])
  const [preview, setPreview] = useState<{
    to_create: Array<{ site_code: string; location_name: string; matched_migration: { id: string; name: string; workflow_stage: string } | null }>
    already_exists: Array<{ site_code: string; location_name: string }>
  } | null>(null)
  const [linkOverrides, setLinkOverrides] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; linked: number; skipped: number; errors: { site_code: string; error: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('file')
    setRows([])
    setPreview(null)
    setLinkOverrides({})
    setLoading(false)
    setError('')
    setResult(null)
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (file: File) => {
    setError('')
    setLoading(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (jsonRows.length === 0) {
        setError('No data rows found in the spreadsheet.')
        setLoading(false)
        return
      }

      const mapped = jsonRows.map(mapRow).filter(r => r.site_code && r.location_name)

      if (mapped.length === 0) {
        setError('No rows with both Site Code and Location columns found.')
        setLoading(false)
        return
      }

      const previewResult = await locationsApi.importPreview(mapped)
      setRows(mapped)
      setPreview(previewResult)
      // All matches default to "auto-link enabled"
      const defaults: Record<string, boolean> = {}
      previewResult.to_create.forEach(r => {
        if (r.matched_migration) defaults[r.site_code.toLowerCase()] = true
      })
      setLinkOverrides(defaults)
      setStep('preview')
    } catch (err) {
      setError((err as Error).message || 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const toggleLink = (siteCode: string) => {
    setLinkOverrides(prev => ({ ...prev, [siteCode.toLowerCase()]: !prev[siteCode.toLowerCase()] }))
  }

  const handleImport = async () => {
    setLoading(true)
    setError('')
    try {
      // Convert linkOverrides into the format expected by the server: only include FALSE values
      const overrides: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(linkOverrides)) {
        if (v === false) overrides[k] = false
      }
      const res = await locationsApi.importLocations(rows, overrides)
      setResult(res)
      setStep('done')
      onComplete()
    } catch (err) {
      setError((err as Error).message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const matchedCount = preview?.to_create.filter(r => r.matched_migration && linkOverrides[r.site_code.toLowerCase()] !== false).length || 0
  const newCount = preview?.to_create.length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Import Locations from Excel</h2>
          </div>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Step 1 */}
          {step === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-surface-500 rounded-lg hover:border-primary-500/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-zinc-500 mb-4" />
              <p className="text-zinc-300 font-medium">Drop your Excel file here or click to browse</p>
              <p className="text-sm text-zinc-500 mt-1">.xlsx, .xls</p>
              <p className="text-xs text-zinc-600 mt-3">
                Expected columns: Site Code, Location, Region, Country, Company, TN Users, Priority,<br />
                Complexity, dates (Verizon Request, Setup Complete, Kick-off…, Hypercare…), Status, Notes
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              {loading && (
                <div className="flex items-center gap-2 mt-4 text-primary-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Parsing file...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <p className="text-xs text-primary-400 uppercase tracking-wider">Will create</p>
                  <p className="text-2xl font-bold text-zinc-100">{newCount}</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-xs text-green-400 uppercase tracking-wider">Will auto-link</p>
                  <p className="text-2xl font-bold text-zinc-100">{matchedCount}</p>
                </div>
                <div className="p-3 bg-zinc-500/10 border border-zinc-500/30 rounded-lg">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Already exist (skip)</p>
                  <p className="text-2xl font-bold text-zinc-100">{preview.already_exists.length}</p>
                </div>
              </div>

              <div className="border border-surface-600 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-700 border-b border-surface-600">
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Site Code</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Location</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Action</th>
                      <th className="px-3 py-2 text-center text-zinc-400 font-medium w-24">Auto-link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.to_create.map((r) => {
                      const willLink = r.matched_migration && linkOverrides[r.site_code.toLowerCase()] !== false
                      return (
                        <tr key={r.site_code} className="border-b border-surface-600/50">
                          <td className="px-3 py-2 font-mono text-zinc-200">{r.site_code}</td>
                          <td className="px-3 py-2 text-zinc-300">{r.location_name}</td>
                          <td className="px-3 py-2">
                            {r.matched_migration ? (
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <Link2 className="h-3 w-3 text-primary-400" />
                                {willLink
                                  ? <>Create + link to <span className="text-primary-400">{r.matched_migration.name}</span></>
                                  : <>Create only (skip linking <span className="text-zinc-500">{r.matched_migration.name}</span>)</>
                                }
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">Create only (no project match)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.matched_migration ? (
                              <input
                                type="checkbox"
                                checked={willLink as boolean}
                                onChange={() => toggleLink(r.site_code)}
                                className="rounded border-surface-500 bg-surface-700 text-primary-500"
                              />
                            ) : (
                              <span className="text-zinc-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {preview.already_exists.map(r => (
                      <tr key={r.site_code} className="border-b border-surface-600/50 opacity-60">
                        <td className="px-3 py-2 font-mono text-zinc-400">{r.site_code}</td>
                        <td className="px-3 py-2 text-zinc-500">{r.location_name}</td>
                        <td className="px-3 py-2 text-xs text-zinc-500">Already exists, will skip</td>
                        <td className="px-3 py-2 text-center text-zinc-600">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-400" />
              <h3 className="text-xl font-semibold text-zinc-100">Import Complete</h3>
              <div className="text-sm text-zinc-400 space-y-1 text-center">
                <p><span className="font-semibold text-green-400">{result.created}</span> locations created</p>
                <p><span className="font-semibold text-primary-400">{result.linked}</span> auto-linked to existing projects</p>
                {result.skipped > 0 && <p><span className="font-semibold">{result.skipped}</span> skipped (already existed)</p>}
                {result.errors.length > 0 && <p className="text-red-400"><span className="font-semibold">{result.errors.length}</span> errors</p>}
              </div>
              {result.errors.length > 0 && (
                <div className="w-full max-w-md bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 max-h-40 overflow-auto">
                  {result.errors.map((e, i) => <p key={i}>{e.site_code}: {e.error}</p>)}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-600">
          {step === 'preview' && (
            <>
              <button onClick={reset} className="btn btn-secondary">Back</button>
              <button onClick={handleImport} disabled={newCount === 0 || loading} className="btn btn-primary flex items-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</> : <><Upload className="h-4 w-4" />Import {newCount} Location{newCount === 1 ? '' : 's'}</>}
              </button>
            </>
          )}
          {step === 'done' && <button onClick={handleClose} className="btn btn-primary">Close</button>}
          {step === 'file' && <button onClick={handleClose} className="btn btn-secondary">Cancel</button>}
        </div>
      </div>
    </div>
  )
}
