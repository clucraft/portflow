import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, MailCheck, Check } from 'lucide-react'
import { locationsApi, type Location } from '../services/api'

interface Props {
  open: boolean
  selectedLocations: Location[]
  onClose: () => void
  onComplete: () => void
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MarkKickoffSentDialog({ open, selectedLocations, onClose, onComplete }: Props) {
  const [sentAt, setSentAt] = useState(todayISO())
  const [result, setResult] = useState<{ updated: number } | null>(null)

  useEffect(() => {
    if (open) {
      setSentAt(todayISO())
      setResult(null)
    }
  }, [open])

  const markMutation = useMutation({
    mutationFn: () => locationsApi.markKickoffSent(
      selectedLocations.map(l => l.id),
      sentAt || undefined
    ),
    onSuccess: (data) => {
      setResult(data)
      onComplete()
    },
  })

  if (!open) return null

  const ids = selectedLocations.map(l => l.id)
  const alreadySent = selectedLocations.filter(l => l.kickoff_email_sent_at).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <MailCheck className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-semibold text-zinc-100">
              Mark Kick-off Sent
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {!result && (
            <>
              <p className="text-sm text-zinc-400">
                Marks {ids.length} {ids.length === 1 ? 'location' : 'locations'} as having had a kick-off email sent.
                <strong className="text-zinc-300"> No email is actually sent.</strong> Use this when you've already
                sent the kick-off email manually (e.g. via Outlook).
              </p>

              {alreadySent > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                  {alreadySent} of the selected {alreadySent === 1 ? 'location already has' : 'locations already have'} a sent date on file. This will overwrite it.
                </div>
              )}

              <div>
                <label className="label">Sent date</label>
                <input
                  type="date"
                  className="input"
                  value={sentAt}
                  onChange={(e) => setSentAt(e.target.value)}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Defaults to today. Use a past date to backdate existing outreach.
                </p>
              </div>

              <div className="max-h-32 overflow-auto p-2 bg-surface-900/50 border border-surface-600 rounded text-xs font-mono space-y-0.5">
                {selectedLocations.map(l => (
                  <div key={l.id} className="text-zinc-300">
                    <span className="text-primary-400">{l.site_code}</span>
                    <span className="text-zinc-500 ml-2">{l.location_name}</span>
                    {l.kickoff_email_sent_at && (
                      <span className="text-amber-400 ml-2 text-[10px]">(already marked)</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {result && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-sm text-green-300">
              <Check className="h-4 w-4" />
              Marked {result.updated} {result.updated === 1 ? 'location' : 'locations'} as kick-off sent.
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-surface-600 flex items-center justify-end gap-2">
          {result ? (
            <button onClick={onClose} className="btn btn-primary">Close</button>
          ) : (
            <>
              <button onClick={onClose} disabled={markMutation.isPending} className="btn btn-secondary">Cancel</button>
              <button
                onClick={() => markMutation.mutate()}
                disabled={!sentAt || markMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <MailCheck className="h-4 w-4" />
                {markMutation.isPending ? 'Marking...' : `Mark ${ids.length} ${ids.length === 1 ? 'Location' : 'Locations'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
