'use client'

import React, { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PinInputProps {
  value: string
  onChange: (value: string) => void
  showPin: boolean
  onToggleShowPin: () => void
  disabled?: boolean
  error?: boolean
  id?: string
  autoFocus?: boolean
}

/**
 * PIN entry for the sign-in surface. One invisible input owns the keyboard
 * session (paste, backspace, auto-advance, password managers); four visual
 * boxes render the value with masked dots or digits.
 */
export function PinInput({
  value,
  onChange,
  showPin,
  onToggleShowPin,
  disabled = false,
  error = false,
  id = 'pin',
  autoFocus = false,
}: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const digits = [value[0] || '', value[1] || '', value[2] || '', value[3] || '']

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 4)
    onChange(clean)
  }

  return (
    <div className="space-y-2">
      {/* Label and Show/Hide toggle */}
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={`${id}-0`} className="authb-label" style={{ marginBottom: 0 }}>
          4-digit PIN
        </label>
        <button
          type="button"
          onClick={onToggleShowPin}
          className="authb-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', minHeight: 30 }}
          aria-pressed={showPin}
        >
          {showPin ? (
            <>
              <EyeOff className="size-4" aria-hidden />
              <span>Hide</span>
            </>
          ) : (
            <>
              <Eye className="size-4" aria-hidden />
              <span>Show</span>
            </>
          )}
        </button>
      </div>

      {/* Boxes + the one real input sitting on top, invisible */}
      <div
        className="authb-pin-wrap"
        data-focus={focused}
        data-invalid={error}
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="4-digit security PIN"
      >
        <div className="authb-pin-grid" aria-hidden>
          {[0, 1, 2, 3].map((index) => {
            const d = digits[index]
            return (
              <div key={index} className="authb-pin-box" id={`${id}-0-${index}`}>
                {d ? (showPin ? d : '•') : <span className="size-2.5 rounded-full border border-white/25" />}
              </div>
            )
          })}
        </div>
        <input
          ref={inputRef}
          id={`${id}-0`}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
            onChange(pasted)
          }}
          autoComplete="current-password"
          name="pin"
          aria-label="4-digit PIN"
          aria-invalid={error}
          className="authb-pin-input"
        />
      </div>
    </div>
  )
}
