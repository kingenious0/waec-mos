'use client'

/**
 * Officer emergency trigger.
 *
 * HCI rules for an emergency control:
 * - always reachable (floating, in the thumb zone on phones)
 * - visually unmistakable (large, solid red, plain "EMERGENCY SOS" label)
 * - one quick gesture (1s hold prevents pocket dials without slowing a real call for help)
 * - immediate, plain-language feedback and haptics
 * - keyboard and screen-reader equivalent
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertOctagon, Check } from 'lucide-react'
import {
  SOS_HOLD_MS,
  SOS_RESET_MS,
  sosCountdownLabel,
  sosHoldProgress,
  sosResultLabel,
} from '@/lib/field/sos'

interface SosHoldButtonProps {
  onTriggerSos: () => Promise<void> | void
  isOffline?: boolean
  /** dock = wide bar in the action dock; floating = fixed thumb-zone pill */
  variant?: 'dock' | 'floating'
  className?: string
}

type Phase = 'idle' | 'sent' | 'cancelled'

const RING_RADIUS = 18
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const CANCEL_RESET_MS = 2000

function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Haptics are a bonus, never a requirement.
  }
}

export function SosHoldButton({
  onTriggerSos,
  isOffline = false,
  variant = 'dock',
  className = '',
}: SosHoldButtonProps) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(0)
    setHolding(false)
    setPhase('idle')
    startRef.current = null
  }, [])

  const complete = useCallback(async () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    startRef.current = null
    setHolding(false)
    setProgress(1)
    setPhase('sent')
    vibrate([140, 70, 240])
    try {
      await onTriggerSos()
    } catch {
      // The page shows a toast if dispatch fails; never leave the button stuck.
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) reset()
    }, SOS_RESET_MS)
  }, [onTriggerSos, reset])

  const step = useCallback(
    (now: number) => {
      if (startRef.current === null) return
      const next = sosHoldProgress(now - startRef.current)
      setProgress(next)
      if (next >= 1) {
        void complete()
        return
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [complete]
  )

  const start = useCallback(() => {
    if (phase !== 'idle' || holding) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    setHolding(true)
    setProgress(0)
    startRef.current = performance.now()
    vibrate(35)
    frameRef.current = requestAnimationFrame(step)
  }, [holding, phase, step])

  const cancel = useCallback(() => {
    if (!holding || phase !== 'idle') return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    startRef.current = null
    setHolding(false)
    setProgress(0)
    setPhase('cancelled')
    vibrate(45)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setPhase('idle')
    }, CANCEL_RESET_MS)
  }, [holding, phase])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
      event.preventDefault()
      start()
    }
  }

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault()
      cancel()
    }
  }

  const feedback =
    phase === 'sent'
      ? sosResultLabel(isOffline)
      : phase === 'cancelled'
      ? 'Cancelled — hold again to send help'
      : null

  const subLabel =
    phase === 'sent'
      ? 'Regional Command alerted'
      : holding
      ? sosCountdownLabel(progress)
      : isOffline
      ? 'Hold 1s to save — sends when online'
      : 'Hold 1s to send help now'

  const ring = (
    <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
      <circle
        cx="22"
        cy="22"
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="3"
      />
      <circle
        cx="22"
        cy="22"
        r={RING_RADIUS}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
        className="transition-[stroke-dashoffset] duration-75 ease-linear motion-reduce:transition-none"
      />
    </svg>
  )

  const icon =
    phase === 'sent' ? (
      <Check className="relative z-10 size-5 text-white" strokeWidth={3} />
    ) : (
      <AlertOctagon className="relative z-10 size-5 text-white" />
    )

  return (
    <div
      className={
        variant === 'floating'
          ? 'fixed right-4 z-40 lg:hidden'
          : `relative ${className}`
      }
      style={
        variant === 'floating'
          // Sits clear above the fixed mobile action dock (~84px + safe area).
          ? { bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }
          : undefined
      }
    >
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute left-0 right-0 -top-11 z-10 mx-auto w-max max-w-[90vw] rounded-xl px-3 py-2 text-center text-[11px] font-bold shadow-xl ${
            phase === 'sent'
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 text-[#1A1204]'
          }`}
        >
          {feedback}
        </div>
      )}

      <button
        type="button"
        aria-label="Emergency SOS. Press and hold for one second to send your location to Regional Command."
        onPointerDown={(event) => {
          event.preventDefault()
          event.currentTarget.focus()
          start()
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        style={{ touchAction: 'none' }}
        className={
          variant === 'floating'
            ? `flex h-16 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#E11D48] to-[#BE123C] pl-3 pr-5 text-white shadow-[0_12px_32px_-10px_rgba(225,29,72,0.9)] ring-2 ring-white/20 transition active:scale-[0.98] motion-reduce:transition-none cursor-pointer select-none ${
                holding ? 'scale-[0.97] ring-4 ring-red-300/50' : ''
              }`
            : `flex h-16 w-full items-center gap-3 rounded-2xl border border-red-300/30 bg-gradient-to-r from-[#E11D48] to-[#BE123C] px-4 text-white shadow-[0_12px_32px_-12px_rgba(225,29,72,0.85)] transition active:scale-[0.99] motion-reduce:transition-none cursor-pointer select-none ${
                holding ? 'scale-[0.99] ring-4 ring-red-300/50' : ''
              }`
        }
      >
        <span className="relative flex size-11 shrink-0 items-center justify-center">
          {ring}
          {icon}
        </span>

        {variant === 'floating' ? (
          <span className="text-base font-extrabold tracking-widest">SOS</span>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block text-sm font-extrabold tracking-wide">EMERGENCY SOS</span>
              <span className="block text-[11px] font-medium text-white/85">{subLabel}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold tabular-nums">
              191
            </span>
          </>
        )}
      </button>
    </div>
  )
}
