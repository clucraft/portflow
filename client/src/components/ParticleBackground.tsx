import { useEffect, useMemo, useState } from 'react'
import { useParticlePreference } from '../hooks/useParticlePreference'

function generateParticles(count: number, spacing: number, color: string): string {
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * spacing)
    const y = Math.floor(Math.random() * spacing)
    shadows.push(`${x}px ${y}px ${color}`)
  }
  return shadows.join(', ')
}

interface ParticleLayerProps {
  count: number
  size: number
  duration: number
  color: string
  spacing: number
  paused: boolean
}

function ParticleLayer({ count, size, duration, color, spacing, paused }: ParticleLayerProps) {
  const boxShadow = useMemo(() => generateParticles(count, spacing, color), [count, spacing, color])
  const boxShadowAfter = useMemo(() => generateParticles(Math.floor(count * 0.8), spacing, color), [count, spacing, color])

  return (
    <div
      className="particle-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${size}px`,
        height: `${size}px`,
        background: 'transparent',
        boxShadow,
        borderRadius: '50%',
        animation: `particleFloat ${duration}s linear infinite`,
        animationPlayState: paused ? 'paused' : 'running',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: `${spacing}px`,
          left: 0,
          width: `${size}px`,
          height: `${size}px`,
          background: 'transparent',
          boxShadow: boxShadowAfter,
          borderRadius: '50%',
        }}
      />
    </div>
  )
}

export default function ParticleBackground() {
  const [enabled] = useParticlePreference()
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden')
  const spacing = 2000

  // Pause the CSS animation when the tab is hidden — the work is GPU-cheap but
  // not free, and there's no point compositing for a tab the user isn't looking at.
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (!enabled) return null

  return (
    <div className="particle-background">
      <style>{`
        .particle-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          opacity: 0.6;
        }

        @keyframes particleFloat {
          from {
            transform: translateY(0px);
          }
          to {
            transform: translateY(-${spacing}px);
          }
        }
      `}</style>

      {/* Multiple layers with different speeds for depth effect */}
      {/* Cyan particles matching the primary accent color */}
      <ParticleLayer count={250} size={1} duration={90} color="#06b6d4" spacing={spacing} paused={hidden} />
      <ParticleLayer count={150} size={1} duration={130} color="#22d3ee" spacing={spacing} paused={hidden} />
      <ParticleLayer count={80} size={2} duration={170} color="#67e8f9" spacing={spacing} paused={hidden} />
    </div>
  )
}
