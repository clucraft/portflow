import { useEffect, useState } from 'react'

const STORAGE_KEY = 'portflow.particles.enabled'
const EVENT_NAME = 'portflow:particles-changed'

export function getParticlePreference(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

export function setParticlePreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

// Hook used by both Settings (write) and ParticleBackground (read). Stays in
// sync via a custom event so toggling in Settings updates the background
// immediately without a remount, and via the storage event for other tabs.
export function useParticlePreference(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(getParticlePreference)

  useEffect(() => {
    const handler = () => setEnabled(getParticlePreference())
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  return [
    enabled,
    (v: boolean) => {
      setParticlePreference(v)
      setEnabled(v)
    },
  ]
}
