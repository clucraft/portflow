import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { Check, X, Share2, ExternalLink } from 'lucide-react'
import { effectiveUserCount, type Migration } from '../services/api'

interface Props {
  migration: Migration
  onClose: () => void
}

// Match PortFlow's brand palette so confetti feels native
const CONFETTI_COLORS = ['#06b6d4', '#22d3ee', '#10b981', '#34d399', '#ffffff']

function formatCarrierName(carrier: string | null | undefined): string {
  const map: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  }
  return map[(carrier || '').toLowerCase()] || carrier || 'Carrier'
}

function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null
  const start = new Date(a).getTime()
  const end = new Date(b).getTime()
  if (isNaN(start) || isNaN(end)) return null
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24))
  return days >= 0 ? days : null
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CompletionCelebration({ migration, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const [reduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )

  // Stats from existing migration data
  const userCount = effectiveUserCount(migration)
  const carrier = formatCarrierName(migration.target_carrier)
  const startDate = migration.estimate_created_at || migration.created_at
  const endDate = migration.completed_at || new Date().toISOString()
  const totalDays = daysBetween(startDate, endDate)

  const closeAndDismiss = useCallback(() => {
    onClose()
  }, [onClose])

  // Esc key dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndDismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeAndDismiss])

  // Choreographed confetti bursts
  useEffect(() => {
    if (reduceMotion) return

    let cancelled = false

    const burstFromLeft = () => confetti({
      particleCount: 80,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors: CONFETTI_COLORS,
      ticks: 200,
    })

    const burstFromRight = () => confetti({
      particleCount: 80,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors: CONFETTI_COLORS,
      ticks: 200,
    })

    const burstFromCenter = () => confetti({
      particleCount: 120,
      spread: 100,
      origin: { x: 0.5, y: 0.6 },
      colors: CONFETTI_COLORS,
      startVelocity: 35,
      ticks: 250,
    })

    // Sequence: left → right → center → left+right finale
    const t1 = setTimeout(() => { if (!cancelled) burstFromLeft() }, 600)
    const t2 = setTimeout(() => { if (!cancelled) burstFromRight() }, 900)
    const t3 = setTimeout(() => { if (!cancelled) burstFromCenter() }, 1300)
    const t4 = setTimeout(() => {
      if (!cancelled) {
        burstFromLeft()
        burstFromRight()
      }
    }, 2000)

    return () => {
      cancelled = true
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
      // Reset any in-flight confetti when unmounting
      confetti.reset()
    }
  }, [reduceMotion])

  const handleShare = async () => {
    const lines = [
      `🎉 We just completed the ${migration.name} migration!`,
      `${userCount} ${userCount === 1 ? 'user' : 'users'} migrated to Teams Enterprise Voice${totalDays ? ` in ${totalDays} ${totalDays === 1 ? 'day' : 'days'}` : ''}.`,
    ]
    if (migration.site_name && migration.site_country) {
      lines.push(`Site: ${migration.site_name}, ${migration.site_country}`)
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — silently fail
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={closeAndDismiss}
    >
      {/* Stop click propagation so clicks inside the card don't dismiss */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg"
      >
        {/* Animated checkmark */}
        <div className="flex justify-center mb-6">
          <div className={`relative ${reduceMotion ? '' : 'animate-celebrate-pop'}`}>
            <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.4)]">
              <Check className={`h-14 w-14 text-green-400 ${reduceMotion ? '' : 'animate-celebrate-check'}`} strokeWidth={3} />
            </div>
            {!reduceMotion && (
              <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-celebrate-ring" />
            )}
          </div>
        </div>

        {/* Card */}
        <div className={`bg-surface-800 border border-green-500/30 rounded-2xl shadow-2xl p-6 ${reduceMotion ? '' : 'animate-celebrate-card'}`}>
          {/* Close button */}
          <button
            onClick={closeAndDismiss}
            className="absolute top-2 right-2 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center mb-5">
            <div className="text-3xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold text-zinc-100">Migration Complete!</h2>
            <p className="text-lg text-primary-400 font-mono mt-2">{migration.name}</p>
            <p className="text-sm text-zinc-500">
              {migration.site_name}
              {migration.site_city && `, ${migration.site_city}`}
              {migration.site_country && `, ${migration.site_country}`}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-surface-900/50 border border-surface-600 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Users</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{userCount}</p>
            </div>
            <div className="bg-surface-900/50 border border-surface-600 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Days</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{totalDays !== null ? totalDays : '—'}</p>
            </div>
            <div className="bg-surface-900/50 border border-surface-600 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Carrier</p>
              <p className="text-base font-semibold text-zinc-100 mt-2 truncate" title={carrier}>{carrier}</p>
            </div>
          </div>

          {/* Phase timeline */}
          {startDate && endDate && (
            <div className="text-center text-xs text-zinc-500 mb-5">
              {fmtDate(startDate)} <span className="text-zinc-600">→</span> {fmtDate(endDate)}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleShare}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              {copied ? (
                <><Check className="h-4 w-4 text-green-400" /> Copied!</>
              ) : (
                <><Share2 className="h-4 w-4" /> Share</>
              )}
            </button>
            <Link
              to={`/migrations/${migration.id}`}
              onClick={closeAndDismiss}
              className="btn btn-secondary text-sm flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Project
            </Link>
            <button
              onClick={closeAndDismiss}
              className="btn btn-primary text-sm"
            >
              Done
            </button>
          </div>

          {copied && (
            <p className="text-center text-xs text-zinc-500 mt-3">
              Celebration message copied to clipboard. Paste it into Teams or email!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
