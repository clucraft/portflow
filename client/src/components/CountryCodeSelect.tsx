import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { COUNTRY_CODES } from '../utils/phoneValidation'

interface CountryCodeSelectProps {
  value: string
  onChange: (value: string) => void
}

export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  const selected = COUNTRY_CODES.find((c) => c.code === value)

  const filtered = COUNTRY_CODES.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.code.includes(q)
  })

  const handleSelect = (code: string) => {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span className="truncate">
          {selected ? `${selected.code} - ${selected.name}` : value}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-600 rounded-lg shadow-xl max-h-64 flex flex-col">
          <div className="p-2 border-b border-surface-600">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                ref={searchRef}
                type="text"
                className="input w-full pl-8 py-1.5 text-sm"
                placeholder="Search country or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center">No matches found</div>
            ) : (
              filtered.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelect(country.code)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                    country.code === value ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-300'
                  }`}
                >
                  <span className="font-mono text-zinc-500 w-12 flex-shrink-0">{country.code}</span>
                  <span className="truncate">{country.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
