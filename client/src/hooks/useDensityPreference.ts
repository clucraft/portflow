import { useEffect, useState } from 'react'

const STORAGE_KEY = 'portflow.density'
const EVENT_NAME = 'portflow:density-changed'

export type Density = 'comfortable' | 'compact'

export function getDensityPreference(): Density {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export function setDensityPreference(density: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, density)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

// Mirrors useParticlePreference: the custom event lets Settings (write) and
// any table component (read) stay in sync without a remount, and the storage
// event keeps multiple tabs aligned.
export function useDensityPreference(): [Density, (v: Density) => void] {
  const [density, setDensity] = useState<Density>(getDensityPreference)

  useEffect(() => {
    const handler = () => setDensity(getDensityPreference())
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  return [
    density,
    (v: Density) => {
      setDensityPreference(v)
      setDensity(v)
    },
  ]
}

// Class helpers — keeps the conditional logic in one place so callers just
// spread these into their cells / rows. `compact` halves vertical padding
// and drops font one step; `comfortable` is the existing default.
export function tableCellClasses(density: Density): string {
  return density === 'compact' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
}

export function tableHeaderCellClasses(density: Density): string {
  return density === 'compact' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
}
