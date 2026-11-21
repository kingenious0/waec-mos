'use client'

/**
 * Officer emergency confirmation screen.
 *
 * Redesigned for stress: one clear headline, one primary action (call 191),
 * plain language, and a PIN-guarded stand-down. No telemetry jargon and no
 * surprise sounds except the single attention tone played when the alert sends.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertOctagon,
  BatteryMedium,
  Check,
  MapPin,
  Navigation,
  PhoneCall,
  ShieldCheck,
  X,
} from 'lucide-react'
import { SOS_HOLD_MS, sosCountdownLabel, sosHoldProgress } from '@/lib/field/sos'

interface EmergencySosModalProps {
  isOpen: boolean
  onClose: () => void
  initialTriggered?: boolean
  officerName?: string
  venueName?: string
  centerCode?: string
  coords?: { lat: string; lng: string; acc: string }
  batteryLevel?: string
  onDispatchSos?: (notes?: string) => Promise<void>
  onStandDown?: (pin: string) => Promise<{ ok: boolean; error?: string }>
}

const HOLD_RING_RADIUS = 58
const HOLD_RING_CIRCUMFERENCE = 2 * Math.PI * HOLD_RING_RADIUS

function formatGmtTime(date: Date) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Accra',
  })
}

function playAttentionTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(720, ctx.currentTime)
    osc.frequency.setValueAtTime(940, ctx.currentTime + 0.18)
    osc.frequency.setValueAtTime(720, ctx.currentTime + 0.36)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.7)
  } catch {
    // Browsers can block audio; the visual confirmation is authoritative.
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-red-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="truncate text-[13px] font-semibold text-zinc-100">{value}</p>
      </div>
    </div>
  )
}

export function EmergencySosModal({
  isOpen,
  onClose,
  initialTriggered = false,
  officerName = 'Field Officer',
  venueName = 'Assigned centre',
  centerCode = '',
  coords = { lat: '--', lng: '--', acc: '--' },
  batteryLevel = '--%',
  onDispatchSos,
  onStandDown,
}: EmergencySosModalProps) {
  const [isTriggered, setIsTriggered] = useState(initialTriggered)
  const [sentAt, setSentAt] = useState<string | null>(
    initialTriggered ? formatGmtTime(new Date()) : null
  )
  const [progress, setProgress] = useState(initialTriggered ? 1 : 0)
  const [isHolding, setIsHolding] = useState(false)
  const [notes, setNotes] = useState('')
  const [showStandDown, setShowStandDown] = useState(false)
  const [standDownPin, setStandDownPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSubmittingStandDown, setIsSubmittingStandDown] = useState(false)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setIsTriggered(initialTriggered)
    setProgress(initialTriggered ? 1 : 0)
    setIsHolding(false)
    setShowStandDown(false)
    setStandDownPin('')
    setPinError('')
    if (initialTriggered) {
      setSentAt(formatGmtTime(new Date()))
      playAttentionTone()
    }
  }, [isOpen, initialTriggered])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isTriggered) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, isTriggered, onClose])

  const step = useCallback(
    (now: number) => {
      if (startRef.current === null) return
      const next = sosHoldProgress(now - startRef.current)
      setProgress(next)
      if (next >= 1) {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        frameRef.current = null
        startRef.current = null
        setIsHolding(false)
        setIsTriggered(true)
        setSentAt(formatGmtTime(new Date()))
        playAttentionTone()
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([140, 70, 240])
          } catch {
            // optional
          }
        }
        void onDispatchSos?.(notes)
        return
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [notes, onDispatchSos]
  )

  const startHold = () => {
    if (isTriggered || isHolding) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    startRef.current = performance.now()
    setIsHolding(true)
    frameRef.current = requestAnimationFrame(step)
  }

  const cancelHold = () => {
    if (isTriggered || !isHolding) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    startRef.current = null
    setIsHolding(false)
    setProgress(0)
  }

  const verifyStandDown = async () => {
    const pin = standDownPin.trim()
    if (pin.length !== 4) {
      setPinError('Enter your 4-digit PIN to cancel the alert.')
      return
    }
    setIsSubmittingStandDown(true)
    setPinError('')
    try {
      const result = (await onStandDown?.(pin)) ?? { ok: true }
      if (!result.ok) {
        setPinError(result.error || 'That PIN did not work. The alert is still active.')
        return
      }
      setIsTriggered(false)
      setSentAt(null)
      setProgress(0)
      setShowStandDown(false)
      setStandDownPin('')
      setNotes('')
      onClose()
    } finally {
      setIsSubmittingStandDown(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#06070C]/95 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isTriggered ? 'Emergency alert sent' : 'Emergency assistance'}
        className={`w-full max-w-lg rounded-t-3xl border p-5 shadow-2xl sm:rounded-2xl ${
          isTriggered
            ? 'border-red-500/45 bg-[#140708] shadow-red-950/70'
            : 'border-[#252C44] bg-[#0E1220] shadow-black/80'
        }`}
      >
        {isTriggered ? (
          <>
            <div className="flex items-center justify-between border-b border-red-500/25 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-red-200">
                  Emergency sent
                </span>
              </div>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-300">
                {sentAt ?? '--:--'} GMT
              </span>
            </div>

            <div className="space-y-4 py-5">
              <div>
                <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                  Help is on the way.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Regional Command and the police have your location. Stay where you are if you can,
                  and keep your phone with you.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <InfoRow
                  icon={MapPin}
                  label="Centre"
                  value={centerCode ? `${venueName} · ${centerCode}` : venueName}
                />
                <InfoRow
                  icon={Navigation}
                  label="Your location"
                  value={`${coords.lat}, ${coords.lng} (${coords.acc})`}
                />
                <InfoRow icon={BatteryMedium} label="Phone battery" value={batteryLevel} />
                <InfoRow icon={ShieldCheck} label="Reported by" value={officerName} />
              </div>

              <a
                href="tel:191"
                className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-base font-extrabold text-[#0B1220] shadow-lg transition active:scale-[0.99] motion-reduce:transition-none"
              >
                <PhoneCall className="size-5" />
                Call police — 191
              </a>

              {!showStandDown ? (
                <button
                  type="button"
                  onClick={() => setShowStandDown(true)}
                  className="min-h-[52px] w-full rounded-2xl border border-white/15 bg-white/5 text-sm font-bold text-zinc-200 transition hover:bg-white/10 active:scale-[0.99] motion-reduce:transition-none cursor-pointer"
                >
                  I&apos;m safe — stand down
                </button>
              ) : (
                <div className="space-y-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="text-xs font-semibold text-zinc-200">
                    Enter your 4-digit PIN to cancel the alert:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={standDownPin}
                      onChange={(event) => {
                        setStandDownPin(event.target.value.replace(/\D/g, '').slice(0, 4))
                        setPinError('')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void verifyStandDown()
                      }}
                      placeholder="••••"
                      aria-label="4-digit PIN to stand down"
                      className="h-12 flex-1 rounded-xl border border-white/15 bg-[#0B101C] text-center text-lg font-bold tracking-[0.4em] text-white outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      disabled={isSubmittingStandDown}
                      onClick={() => void verifyStandDown()}
                      className="h-12 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmittingStandDown ? 'Checking…' : 'Confirm'}
                    </button>
                  </div>
                  {pinError && <p className="text-xs font-semibold text-red-300">{pinError}</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setShowStandDown(false)
                      setStandDownPin('')
                      setPinError('')
                    }}
                    className="text-xs font-semibold text-zinc-400 underline underline-offset-2 cursor-pointer"
                  >
                    Keep the alert on
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] leading-snug text-zinc-500">
                Only stand down when you are safe. An officer may call you.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-xs font-semibold text-zinc-400 underline underline-offset-2 cursor-pointer"
              >
                Back to field app — alert stays on
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-amber-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-zinc-200">
                  Emergency assistance
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div>
                <h2 className="text-xl font-extrabold text-white sm:text-2xl">Need urgent help?</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-300">
                  Hold the button to send your location to Regional Command. Use this only in an
                  emergency.
                </p>
              </div>

              <label className="w-full text-left">
                <span className="mb-1 block text-[11px] font-semibold text-zinc-400">
                  What happened? (optional)
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="e.g. Unauthorised person at the centre"
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#090C18] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                />
              </label>

              <div className="relative flex size-40 select-none items-center justify-center">
                <svg className="absolute size-40 -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                  <circle
                    cx="70"
                    cy="70"
                    r={HOLD_RING_RADIUS}
                    fill="none"
                    stroke="#242C44"
                    strokeWidth="8"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r={HOLD_RING_RADIUS}
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={HOLD_RING_CIRCUMFERENCE}
                    strokeDashoffset={HOLD_RING_CIRCUMFERENCE * (1 - progress)}
                    className="transition-[stroke-dashoffset] duration-75 ease-linear motion-reduce:transition-none"
                  />
                </svg>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.currentTarget.focus()
                    startHold()
                  }}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerLeave={cancelHold}
                  onContextMenu={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
                      event.preventDefault()
                      startHold()
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.code === 'Space' || event.code === 'Enter') {
                      event.preventDefault()
                      cancelHold()
                    }
                  }}
                  style={{ touchAction: 'none' }}
                  aria-label="Hold for one second to send emergency alert"
                  className={`relative flex size-28 flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition active:scale-95 motion-reduce:transition-none cursor-pointer ${
                    isHolding ? 'scale-95 bg-red-700 ring-4 ring-red-400/40' : ''
                  }`}
                >
                  {isTriggered ? (
                    <Check className="size-8" />
                  ) : (
                    <AlertOctagon className="size-8 text-amber-200" />
                  )}
                  <span className="mt-1 text-xs font-extrabold tracking-wider">HOLD 1s</span>
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-100" aria-live="polite">
                  {isHolding
                    ? sosCountdownLabel(progress)
                    : 'Press and hold to send the alert'}
                </p>
                <p className="text-xs text-zinc-400">Release early to cancel — nothing is sent.</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] w-full rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-zinc-300 transition hover:bg-white/10 cursor-pointer"
              >
                Not an emergency — close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
