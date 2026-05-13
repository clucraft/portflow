import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Mail, Send, Copy, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { locationsApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const BCC_ME_STORAGE_KEY = 'portflow.kickoff.bccMe'

interface Props {
  open: boolean
  ids: string[]
  onClose: () => void
  onSent?: () => void
}

export default function SendKickoffEmailDialog({ open, ids, onClose, onSent }: Props) {
  const { user } = useAuth()
  const [activeIdx, setActiveIdx] = useState(0)
  const [subjectOverride, setSubjectOverride] = useState('')
  const [bodyOverride, setBodyOverride] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bccMe, setBccMe] = useState<boolean>(() => {
    try { return localStorage.getItem(BCC_ME_STORAGE_KEY) === '1' } catch { return false }
  })
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: { site_code: string; error: string }[] } | null>(null)

  const { data: preview, isFetching, refetch } = useQuery({
    queryKey: ['kickoff-preview', ids, subjectOverride, bodyOverride],
    queryFn: () => locationsApi.kickoffPreview(ids, {
      subject: editMode ? subjectOverride : undefined,
      body: editMode ? bodyOverride : undefined,
    }),
    enabled: open && ids.length > 0,
  })

  const sendMutation = useMutation({
    mutationFn: () => locationsApi.kickoffSend(ids, {
      subject: editMode ? subjectOverride : undefined,
      body: editMode ? bodyOverride : undefined,
      bcc: bccMe && user?.email ? [user.email] : undefined,
    }),
    onSuccess: (data) => {
      setResult(data)
      if (data.sent > 0) onSent?.()
    },
  })

  // Persist the BCC-me preference across sessions
  useEffect(() => {
    try { localStorage.setItem(BCC_ME_STORAGE_KEY, bccMe ? '1' : '0') } catch { /* ignore */ }
  }, [bccMe])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setActiveIdx(0)
      setEditMode(false)
      setSubjectOverride('')
      setBodyOverride('')
      setCopied(false)
      setResult(null)
    }
  }, [open])

  if (!open) return null

  const emails = preview?.emails || []
  const current = emails[activeIdx]
  const validCount = emails.filter(e => e.valid).length
  const invalidCount = emails.length - validCount

  // Prime overrides from the currently-previewed email so the user can hand-edit it
  const enterEditMode = () => {
    if (current) {
      setSubjectOverride(current.subject)
      setBodyOverride(current.body)
    }
    setEditMode(true)
  }

  const handleCopy = async () => {
    if (!current) return
    const text = `To: ${current.to}\nSubject: ${current.subject}\n\n${current.body}`
    // Prefer modern Clipboard API on HTTPS / localhost
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch { /* fall through */ }
    }
    // Fallback for plain HTTP
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-99999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              Send Kick-off Email
              <span className="text-sm font-normal text-zinc-500 ml-2">
                {emails.length} {emails.length === 1 ? 'location' : 'locations'}
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {isFetching && !preview && (
            <div className="text-center py-8 text-zinc-500">Loading preview...</div>
          )}

          {preview && emails.length > 0 && !result && (
            <>
              {/* Summary banner */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <p className="text-xs uppercase tracking-wider text-primary-400">Total</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{emails.length}</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-xs uppercase tracking-wider text-green-400">Will send</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{validCount}</p>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs uppercase tracking-wider text-amber-400">Missing email</p>
                  <p className="text-2xl font-bold text-zinc-100 mt-1">{invalidCount}</p>
                </div>
              </div>

              {invalidCount > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    {invalidCount} {invalidCount === 1 ? 'location is' : 'locations are'} missing a valid Local IT Contact email. {invalidCount === 1 ? 'It' : 'They'} will be skipped on send.
                  </div>
                </div>
              )}

              {/* Sender info */}
              {(preview.from_address || preview.from_name) && (
                <div className="text-xs text-zinc-500">
                  Sending as: <span className="text-zinc-300">{preview.from_name ? `${preview.from_name} ` : ''}{preview.from_address && `<${preview.from_address}>`}</span>
                </div>
              )}

              {/* Edit toggle */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  Preview email {activeIdx + 1} of {emails.length}
                </p>
                {!editMode ? (
                  <button
                    onClick={enterEditMode}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    Edit subject/body for this send
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditMode(false); refetch() }}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Reset to template
                  </button>
                )}
              </div>

              {current && (
                <div className="border border-surface-600 rounded-lg overflow-hidden">
                  {current.previously_sent_at && (
                    <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Kick-off was previously sent on {new Date(current.previously_sent_at).toLocaleDateString()}
                        {current.previously_sent_to && current.previously_sent_to !== current.to && (
                          <> to <span className="font-mono">{current.previously_sent_to}</span> (different from current contact)</>
                        )}
                        {current.previously_sent_to && current.previously_sent_to === current.to && (
                          <>. Re-sending will go to the same address.</>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="px-4 py-2 bg-surface-700/50 border-b border-surface-600 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-zinc-400">To: </span>
                      <span className={current.valid ? 'text-zinc-200' : 'text-red-400'}>
                        {current.to || '(no email on file)'}
                      </span>
                      <span className="text-zinc-500 ml-3">{current.site_code} — {current.location_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
                        disabled={activeIdx === 0}
                        className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setActiveIdx(Math.min(emails.length - 1, activeIdx + 1))}
                        disabled={activeIdx === emails.length - 1}
                        className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="label text-xs">Subject</label>
                      {editMode ? (
                        <input
                          className="input text-sm"
                          value={subjectOverride}
                          onChange={(e) => setSubjectOverride(e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-zinc-200 font-medium">{current.subject}</p>
                      )}
                    </div>
                    <div>
                      <label className="label text-xs">Body</label>
                      {editMode ? (
                        <textarea
                          className="input text-sm font-mono min-h-[300px]"
                          value={bodyOverride}
                          onChange={(e) => setBodyOverride(e.target.value)}
                        />
                      ) : (
                        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans bg-surface-900/40 p-3 rounded">{current.body}</pre>
                      )}
                      {editMode && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Note: when editing, your text is used as-is for the previewed location ({current.site_code}). Placeholders won't re-render across other locations — for that, edit the master template in Settings.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Result panel */}
          {result && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border ${result.sent > 0 ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                <p className="font-medium">
                  Sent {result.sent} {result.sent === 1 ? 'email' : 'emails'}.
                  {result.skipped > 0 && ` Skipped ${result.skipped} (missing email address).`}
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
                  <p className="text-red-400 font-medium mb-2">{result.errors.length} {result.errors.length === 1 ? 'error' : 'errors'}:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-red-300 text-xs">• {e.site_code}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-surface-600">
          <div className="flex-1 min-w-0">
            {!result && user?.email && (
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bccMe}
                  onChange={(e) => setBccMe(e.target.checked)}
                  className="h-4 w-4 rounded border-surface-500 bg-surface-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                />
                <span>
                  BCC me <span className="text-zinc-500">({user.email})</span>
                </span>
                {bccMe && validCount > 1 && (
                  <span className="text-amber-400/80 text-[11px]">— you'll receive {validCount} copies</span>
                )}
              </label>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result ? (
              <button onClick={onClose} className="btn btn-primary">Close</button>
            ) : (
              <>
                <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button
                  onClick={handleCopy}
                  disabled={!current}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {copied ? <><Check className="h-4 w-4 text-green-400" /> Copied</> : <><Copy className="h-4 w-4" /> Copy Current</>}
                </button>
                <button
                  onClick={() => sendMutation.mutate()}
                  disabled={validCount === 0 || sendMutation.isPending}
                  className="btn btn-primary flex items-center gap-2"
                  title={validCount === 0 ? 'No valid recipients' : ''}
                >
                  {sendMutation.isPending ? (
                    <>Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send {validCount} {validCount === 1 ? 'Email' : 'Emails'}</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
