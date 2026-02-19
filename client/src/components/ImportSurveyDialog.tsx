import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { migrationsApi } from '../services/api'

interface ImportSurveyDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

interface SurveyRow {
  survey_id: string
  [key: string]: unknown
}

// Map Excel column headers to internal field names
const COLUMN_MAP: Record<string, string> = {
  'ID': 'survey_id',
  'Email': 'email',
  'Name': 'name',
  'Company Name': 'company_name',
  'Legal Entity Code': 'legal_entity_code',
  'Site Address': 'site_address',
  'Project Requestor': 'project_requestor',
  'Head of Location': 'head_of_location',
  'Infrastructure Contact': 'infrastructure_contact',
  'Service Desk': 'service_desk',
  'Phone System Manufacturer': 'phone_system_manufacturer',
  'Phone System Model': 'phone_system_model',
  'Phone System Age': 'phone_system_age',
  'Phone System Maintenance': 'phone_system_maintenance',
  'Telephony Provider': 'telephony_provider',
  'Provider Contract Term': 'provider_contract_term',
  'Earliest Cancel Date': 'earliest_cancel_date',
  'Connection Details': 'connection_details',
  'Concurrent Channels': 'concurrent_channels',
  'Main Subscriber Range': 'main_subscriber_range',
  'Total End User Count': 'total_end_user_count',
  'Personal Desk Phones': 'personal_desk_phones',
  'Headset %': 'headset_percentage',
  'Default Headset': 'default_headset',
  'Conference Room Devices': 'conference_room_devices',
  'DECT in use?': 'cordless_dect_in_use',
  'DECT Details': 'dect_details',
  'DECT Count': 'dect_count',
  'DECT Smartphone %': 'dect_smartphone_percentage',
  'Mobile Standard Device': 'mobile_standard_device',
  'Special Endpoints?': 'special_endpoints',
  'Special Endpoint Config': 'special_endpoint_config',
  'Special Call Flow': 'special_call_flow',
  'Internal Emergency #': 'internal_emergency_number',
  'Public Emergency #s': 'public_emergency_numbers',
  'Infrastructure Operator': 'infrastructure_operator',
  'Network Standard Planned?': 'network_standard_planned',
  'Network Project Timeline': 'network_project_timeline',
  'LAN Subnets': 'lan_subnets',
  'Client Access Port Speed': 'client_access_port_speed',
  'WLAN Coverage': 'wlan_coverage',
  'Redundant WAN': 'redundant_wan',
  'WAN Bandwidth': 'wan_bandwidth',
}

function mapRow(excelRow: Record<string, unknown>): SurveyRow {
  const mapped: Record<string, unknown> = {}
  for (const [excelCol, value] of Object.entries(excelRow)) {
    const fieldName = COLUMN_MAP[excelCol]
    if (fieldName) {
      mapped[fieldName] = value
    }
  }
  // Ensure survey_id is always a string
  mapped.survey_id = String(mapped.survey_id || '')
  return mapped as SurveyRow
}

type Step = 'file' | 'preview' | 'done'

export default function ImportSurveyDialog({ open, onClose, onComplete }: ImportSurveyDialogProps) {
  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<SurveyRow[]>([])
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; error: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('file')
    setRows([])
    setExistingIds(new Set())
    setSelected(new Set())
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
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (jsonRows.length === 0) {
        setError('No data rows found in the spreadsheet.')
        setLoading(false)
        return
      }

      const mapped = jsonRows.map(mapRow).filter(r => r.survey_id)

      if (mapped.length === 0) {
        setError('No rows with an ID column found. Make sure the spreadsheet has an "ID" column.')
        setLoading(false)
        return
      }

      // Ask server which IDs already exist
      const preview = await migrationsApi.importPreview(mapped)
      const existSet = new Set(preview.existing_ids.map(String))

      setRows(mapped)
      setExistingIds(existSet)
      // Pre-select all new rows
      setSelected(new Set(mapped.filter(r => !existSet.has(r.survey_id)).map(r => r.survey_id)))
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

  const newRows = rows.filter(r => !existingIds.has(r.survey_id))
  const existingRows = rows.filter(r => existingIds.has(r.survey_id))

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === newRows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(newRows.map(r => r.survey_id)))
    }
  }

  const handleImport = async () => {
    setLoading(true)
    setError('')

    try {
      const toImport = rows.filter(r => selected.has(r.survey_id))
      const res = await migrationsApi.importSurvey(toImport)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Import Survey</h2>
          </div>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: File Select */}
          {step === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-surface-500 rounded-lg hover:border-primary-500/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-zinc-500 mb-4" />
              <p className="text-zinc-300 font-medium">Drop an XLSX file here or click to browse</p>
              <p className="text-sm text-zinc-500 mt-1">Microsoft Forms survey export (.xlsx)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              {loading && (
                <div className="flex items-center gap-2 mt-4 text-primary-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Parsing file...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-zinc-300">
                    <span className="font-semibold text-primary-400">{newRows.length}</span> new
                  </span>
                  {existingRows.length > 0 && (
                    <span className="text-zinc-500">
                      <span className="font-semibold">{existingRows.length}</span> already imported
                    </span>
                  )}
                </div>
                {newRows.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {selected.size === newRows.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="border border-surface-600 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-700 border-b border-surface-600">
                      <th className="px-3 py-2 text-left w-10"></th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">ID</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Company</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Site Address</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">End Users</th>
                      <th className="px-3 py-2 text-left text-zinc-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isExisting = existingIds.has(row.survey_id)
                      return (
                        <tr
                          key={row.survey_id}
                          className={`border-b border-surface-600/50 ${isExisting ? 'opacity-50' : 'hover:bg-surface-700/50'}`}
                        >
                          <td className="px-3 py-2">
                            {!isExisting && (
                              <input
                                type="checkbox"
                                checked={selected.has(row.survey_id)}
                                onChange={() => toggleRow(row.survey_id)}
                                className="rounded border-surface-500 bg-surface-700 text-primary-500 focus:ring-primary-500"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{row.survey_id}</td>
                          <td className="px-3 py-2 text-zinc-200">{String(row.company_name || '')}</td>
                          <td className="px-3 py-2 text-zinc-400 truncate max-w-[200px]" title={String(row.site_address || '')}>
                            {String(row.site_address || '')}
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{String(row.total_end_user_count || '-')}</td>
                          <td className="px-3 py-2">
                            {isExisting ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                                Already imported
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-400" />
              <h3 className="text-xl font-semibold text-zinc-100">Import Complete</h3>
              <div className="text-sm text-zinc-400 space-y-1 text-center">
                <p><span className="font-semibold text-green-400">{result.created}</span> migrations created</p>
                {result.skipped > 0 && <p><span className="font-semibold">{result.skipped}</span> skipped (already exist)</p>}
                {result.errors.length > 0 && (
                  <p className="text-red-400"><span className="font-semibold">{result.errors.length}</span> errors</p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="w-full max-w-md bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {result.errors.map((e, i) => (
                    <p key={i}>Row {e.row + 1}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-600">
          {step === 'preview' && (
            <>
              <button onClick={reset} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || loading}
                className="btn btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import {selected.size} Selected
                  </>
                )}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={handleClose} className="btn btn-primary">
              Close
            </button>
          )}
          {step === 'file' && (
            <button onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
