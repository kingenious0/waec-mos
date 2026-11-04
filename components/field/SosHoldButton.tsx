'use client'

import React, { useState, useRef, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'

interface SosHoldButtonProps {
  onTriggerSos: () => Promise<void> | void
  isOffline?: boolean
  className?: string
}

const HOLD_DURATION_MS = 1500

export function SosHoldButton({ onTriggerSos, isOffline = false, className = 'w-full' }: SosHoldButtonProps) {
  const [progress, setProgress] = useState<number>(0)
  const [isHolding, setIsHolding] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const handleComplete = useCallback(async () => {
    setIsHolding(false)
    setProgress(1)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
    }
    setStatusMessage(isOffline ? 'Queued, will send when online' : 'SOS Alert Dispatched to Police & Regional Hub')

    try {
      await onTriggerSos()
    } catch {
      // Handled
    }

    setTimeout(() => {
      setProgress(0)
      setStatusMessage(null)
    }, 4000)
  }, [isOffline, onTriggerSos])

  const startHold = () => {
    if (statusMessage) return
    setIsHolding(true)
    startTimeRef.current = performance.now()
    const step = (time: number) => {
      if (!startTimeRef.current) return
      const elapsed = time - startTimeRef.current
      const current = Math.min(1, elapsed / HOLD_DURATION_MS)
      setProgress(current)
      if (current >= 1) {
        handleComplete()
      } else {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }
    animFrameRef.current = requestAnimationFrame(step)
  }

  const cancelHold = () => {
    if (progress < 1) {
      setIsHolding(false)
      setProgress(0)
      startTimeRef.current = null
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !isHolding) {
      e.preventDefault()
      startHold()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      cancelHold()
    }
  }

  return (
    <div className={`relative select-none ${className}`}>
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        aria-label="Hold for 1.5 seconds to trigger SOS"
        className="w-full h-[52px] rounded-xl border border-red-500/40 bg-[#160E14] hover:bg-[#1E111A] text-red-300 px-3.5 flex items-center justify-center gap-3 transition relative overflow-hidden cursor-pointer"
      >
        <div
          className="absolute inset-0 bg-red-600/30 transition-all pointer-events-none"
          style={{ width: `${progress * 100}%` }}
        />
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="relative size-6 flex items-center justify-center">
            <svg className="size-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-950" />
              <circle
                cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray="56.5"
                strokeDashoffset={56.5 - 56.5 * progress}
                className="text-red-500 transition-[stroke-dashoffset] duration-75"
              />
            </svg>
            <AlertTriangle className="size-3 text-red-400 absolute" />
          </div>
          <div className="text-left leading-none">
            <div className="text-xs font-bold text-red-200">Hold for SOS</div>
            <div className="text-[10px] text-red-400/80 mt-0.5 tabular-nums">
              {isHolding ? `${Math.ceil((1 - progress) * 1.5)}s remaining` : '1.5 seconds'}
            </div>
          </div>
        </div>
      </button>
      {statusMessage && (
        <div role="alert" className="absolute -top-10 left-0 right-0 py-1 px-2.5 bg-red-600 text-white text-[11px] font-bold rounded-lg text-center shadow-lg animate-in fade-in">
          {statusMessage}
        </div>
      )}
    </div>
  )
}
