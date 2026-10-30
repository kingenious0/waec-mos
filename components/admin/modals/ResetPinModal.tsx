'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import type { UserAccount } from '@/lib/db'

interface ResetPinModalProps {
  officer: UserAccount | null
  onClose: () => void
  onSave: (officerId: string, newPin: string) => void
}

export function ResetPinModal({
  officer,
  onClose,
  onSave,
}: ResetPinModalProps) {
  const [mounted, setMounted] = useState(false)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (officer) {
      // Generate a clean random 4-digit PIN default
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
      setPin(randomPin)
    }
  }, [officer])

  if (!officer || !mounted) return null

  const handleGenerateNew = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
    setPin(randomPin)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin || pin.length !== 4) {
      alert('Please enter a valid 4-digit PIN.')
      return
    }
    onSave(officer.id, pin)
    onClose()
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#22263C] bg-[#0E111D] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#1E2B7B] border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300]">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Reset Login PIN
              </h3>
              <p className="text-xs text-slate-400">
                4-Digit Authentication PIN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full bg-[#181D2E] text-slate-400 hover:text-white hover:bg-[#222942] transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-[#22263C] bg-[#121626] p-4 space-y-3">
            <div className="text-xs text-slate-300">
              Generating new login credentials for{' '}
              <span className="font-bold text-white">{officer.name}</span>{' '}
              <span className="text-slate-400 font-sans text-[11px]">({officer.phone})</span>.
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  New 4-Digit PIN
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateNew}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    <span>Generate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] py-3 text-center font-sans text-2xl font-black tracking-widest text-[#F6D300] focus:outline-hidden focus:border-sky-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#22263C] bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-[#F6D300]/40 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5 text-[#F6D300]" />
              <span>Save New PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
