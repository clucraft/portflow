import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface ComboBoxOption {
  value: string
  label: string
}

interface ComboBoxProps {
  options: ComboBoxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowCustom?: boolean
  disabled?: boolean
}

export default function ComboBox({ options, value, onChange, placeholder = 'Select...', allowCustom = true, disabled = false }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCustom, setIsCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Determine if current value is a custom one (not in options)
  const isCurrentValueCustom = value && !options.some(o => o.value === value)

  useEffect(() => {
    if (isCurrentValueCustom && value) {
      setIsCustom(true)
    }
  }, [isCurrentValueCustom, value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = options.find(o => o.value === value)?.label

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { setIsCustom(false); onChange('') }}
          className="btn btn-secondary text-sm"
          disabled={disabled}
        >
          List
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`input w-full text-left flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={value ? 'text-zinc-200' : 'text-zinc-500'}>
          {selectedLabel || value || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-600 rounded-lg shadow-xl max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setIsOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors ${
                option.value === value ? 'text-primary-400 bg-primary-500/10' : 'text-zinc-200'
              }`}
            >
              {option.label}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">No options available</div>
          )}
          {allowCustom && (
            <button
              type="button"
              onClick={() => { setIsCustom(true); setIsOpen(false); onChange('') }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:bg-surface-700 border-t border-surface-600 transition-colors"
            >
              Custom...
            </button>
          )}
        </div>
      )}
    </div>
  )
}
