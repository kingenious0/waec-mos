'use client'

import React, { useRef, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PinInputProps {
  value: string
  onChange: (value: string) => void
  showPin: boolean
  onToggleShowPin: () => void
  disabled?: boolean
  error?: boolean
  id?: string
}

export function PinInput({
  value,
  onChange,
  showPin,
  onToggleShowPin,
  disabled = false,
  error = false,
  id = 'pin',
}: PinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const digits = [value[0] || '', value[1] || '', value[2] || '', value[3] || '']

  // Auto-focus the first empty box if user clicks the container
  const handleContainerClick = (index: number) => {
    if (disabled) return
    const targetIndex = Math.min(value.length, 3)
    inputsRef.current[index ?? targetIndex]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        // Clear current box
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join(''))
      } else if (index > 0) {
        // Move to and clear previous box
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        inputsRef.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 3) {
      e.preventDefault()
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const rawVal = e.target.value.replace(/\D/g, '')
    if (!rawVal) return

    const char = rawVal.slice(-1)
    const newDigits = [...digits]
    newDigits[index] = char
    const combined = newDigits.join('').slice(0, 4)
    onChange(combined)

    if (index < 3 && char) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted) {
      onChange(pasted)
      const nextIdx = Math.min(pasted.length, 3)
      inputsRef.current[nextIdx]?.focus()
    }
  }

  return (
    <div className="space-y-2">
      {/* Label and Show/Hide Toggle Header */}
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={`${id}-0`} className="font-medium text-zinc-300">
          4-digit PIN
        </label>
        <button
          type="button"
          onClick={onToggleShowPin}
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition cursor-pointer select-none"
          tabIndex={-1}
        >
          {showPin ? (
            <>
              <EyeOff className="size-3.5 text-zinc-400" />
              <span>Hide</span>
            </>
          ) : (
            <>
              <Eye className="size-3.5 text-zinc-400" />
              <span>Show</span>
            </>
          )}
        </button>
      </div>

      {/* 4 Digit Boxes */}
      <div className="grid grid-cols-4 gap-3 sm:gap-4" onPaste={handlePaste}>
        {[0, 1, 2, 3].map((index) => {
          const hasValue = Boolean(digits[index])

          return (
            <div
              key={index}
              onClick={() => handleContainerClick(index)}
              className={`relative h-14 sm:h-16 rounded-xl border transition-all flex items-center justify-center cursor-text ${
                error
                  ? 'border-red-500/50 bg-red-950/20'
                  : 'border-white/10 bg-[#0D1224] focus-within:border-[#375DFB] focus-within:ring-1 focus-within:ring-[#375DFB] focus-within:bg-[#121833]'
              }`}
            >
              <input
                ref={(el) => {
                  inputsRef.current[index] = el
                }}
                id={`${id}-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={showPin ? digits[index] : ''}
                disabled={disabled}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`absolute inset-0 size-full text-center bg-transparent focus:outline-none font-bold text-xl sm:text-2xl text-white ${
                  showPin ? 'opacity-100' : 'opacity-0'
                }`}
                autoComplete="off"
              />

              {/* Masked Dot display when hidden */}
              {!showPin && hasValue && (
                <span className="size-2.5 sm:size-3 rounded-full bg-white shrink-0 pointer-events-none shadow-sm" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
