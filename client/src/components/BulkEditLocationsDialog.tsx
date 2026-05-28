import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Pencil, AlertCircle } from 'lucide-react'
import { locationsApi, type Location, type LocationStatus } from '../services/api'

// Field definitions for the bulk editor. Order here is the order in the picker.
// Each kind drives which input we render and how we normalize the value.
type FieldKind = 'text' | 'number' | 'date' | 'textarea' | 'status' | 'level'

interface FieldDef {
  field: string         // matches server-side BULK_EDITABLE_FIELDS
  label: string         // human label in the picker
  kind: FieldKind
}

const FIELDS: FieldDef[] = [
  { field: 'assigned_engineer', label: 'Assigned Engineer', kind: 'text' },
  { field: 'local_it_contact',  label: 'Local IT Contact',  kind: 'text' },
  { field: 'priority',          label: 'Priority',          kind: 'level' },
  { field: 'complexity',        label: 'Complexity',        kind: 'level' },
  { field: 'status',            label: 'Status',            kind: 'status' },
  { field: 'region',            label: 'Region',            kind: 'text' },
  { field: 'country',           label: 'Country',           kind: 'text' },
  { field: 'company',           label: 'Company',           kind: 'text' },
  { field: 'estimated_users',   label: 'Estimated Users',   kind: 'number' },
  { field: 'planned_start_date', label: 'Planned Start Date', kind: 'date' },
  { field: 'planned_end_date',   label: 'Planned End Date',   kind: 'date' },
  { field: 'kickoff_with_it_date', label: 'Kickoff w/ IT Date', kind: 'date' },
  { field: 'notes',             label: 'Notes',             kind: 'textarea' },
]

const STATUS_OPTIONS: { value: LocationStatus; label: string }[] = [
  { value: 'planned',      label: 'Planned' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'completed',    label: 'Completed' },
  { value: 'on_hold',      label: 'On Hold' },
  { value: 'cancelled',    label: 'Cancelled' },
  { value: 'out_of_scope', label: 'Out of Scope' },
]

const LEVEL_OPTIONS = [
  { value: '',       label: '(clear)' },
  { value: 'High',   label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low',    label: 'Low' },
]

interface Props {
  open: boolean
  selectedLocations: Location[]
  onClose: () => void
  onComplete: () => void
}

export default function BulkEditLocationsDialog({ open, selectedLocations, onClose, onComplete }: Props) {
  const [fieldKey, setFieldKey] = useState<string>(FIELDS[0].field)
  const [value, setValue] = useState<string>('')

  const fieldDef = useMemo(() => FIELDS.find(f => f.field === fieldKey) || FIELDS[0], [fieldKey])
  const ids = selectedLocations.map(l => l.id)

  // How many selected locations already have a non-blank value for this field?
  // Used in the preview blurb to flag "5 of 12 will be overwritten."
  const alreadyHasValue = useMemo(() => {
    return selectedLocations.filter(l => {
      const v = (l as unknown as Record<string, unknown>)[fieldKey]
      return v !== null && v !== undefined && String(v).trim() !== ''
    }).length
  }, [selectedLocations, fieldKey])

  const isClearing = value === '' && (fieldDef.kind !== 'level' || value === '')

  const mutation = useMutation({
    mutationFn: () => {
      // Server normalizes '' → null, but we send the raw string. For numbers,
      // coerce client-side so we don't ship "12.5" to estimated_users.
      const payload = fieldDef.kind === 'number' && value !== ''
        ? Math.trunc(Number(value) || 0)
        : value
      return locationsApi.bulkUpdate(ids, fieldKey, payload)
    },
    onSuccess: () => {
      onComplete()
      onClose()
    },
  })

  if (!open) return null

  const count = ids.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <Pencil className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              Bulk Edit
              <span className="text-sm font-normal text-zinc-500 ml-2">
                {count} {count === 1 ? 'location' : 'locations'}
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Field to update</label>
            <select
              value={fieldKey}
              onChange={(e) => { setFieldKey(e.target.value); setValue('') }}
              className="input"
            >
              {FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">New value</label>
            {fieldDef.kind === 'text' && (
              <input
                type="text"
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Leave blank to clear"
              />
            )}
            {fieldDef.kind === 'number' && (
              <input
                type="number"
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Leave blank to clear"
              />
            )}
            {fieldDef.kind === 'date' && (
              <input
                type="date"
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            {fieldDef.kind === 'textarea' && (
              <textarea
                className="input min-h-[100px]"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Leave blank to clear. NOTE: this replaces existing notes."
              />
            )}
            {fieldDef.kind === 'status' && (
              <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">— pick one —</option>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {fieldDef.kind === 'level' && (
              <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* Preview */}
          <div className="p-3 bg-surface-700/50 border border-surface-600 rounded-lg space-y-2 text-sm">
            <div className="text-zinc-300">
              Applying <span className="font-mono text-primary-400">{fieldDef.label}</span>
              {' = '}
              <span className="font-mono text-zinc-200">{isClearing ? '(cleared)' : `"${value}"`}</span>
              {' to '}
              <span className="font-medium">{count}</span> {count === 1 ? 'location' : 'locations'}.
            </div>
            {alreadyHasValue > 0 && (
              <div className="text-xs text-amber-400 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {alreadyHasValue} of {count} already {alreadyHasValue === 1 ? 'has' : 'have'} a value for this field —
                  {isClearing ? ' it will be cleared.' : ' it will be overwritten.'}
                  {fieldDef.kind === 'textarea' && !isClearing && ' Existing notes are replaced, not appended.'}
                </span>
              </div>
            )}
          </div>

          {mutation.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              Update failed. {(mutation.error as Error)?.message || 'Try again.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-surface-600">
          <button onClick={onClose} className="btn btn-secondary" disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn btn-primary"
          >
            {mutation.isPending ? 'Applying…' : `Apply to ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}
