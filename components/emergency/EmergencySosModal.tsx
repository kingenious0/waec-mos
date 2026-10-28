'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  AlertOctagon,
  Radio,
  PhoneCall,
  ShieldCheck,
  MapPin,
  Battery,
  X,
  Volume2,
  AlertTriangle,
  Lock,
} from 'lucide-react'

interface EmergencySosModalProps {
  isOpen: boolean
  onClose: () => void
  officerPin?: string
  officerName?: string
  venueName?: string
  centerCode?: string
  coords?: { lat: string; lng: string; acc: string }
  batteryLevel?: string
}

export function EmergencySosModal({
  isOpen,
  onClose,
  officerPin = '0412',
  officerName = 'Kofi Mensah',
  venueName = 'Prempeh College Center A',
  centerCode = '050102',
  coords = { lat: '6.6924° N', lng: '1.6241° W', acc: '±4.2m' },
  batteryLevel = '82%',
}: EmergencySosModalProps) {
  const [isHolding, setIsHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isTriggered, setIsTriggered] = useState(false)
  const [standDownPin, setStandDownPin] = useState('')
  const [showStandDown, setShowStandDown] = useState(false)
  const [pinError, setPinError] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const HOLD_DURATION = 1500 // 1.5 seconds

  // Web Audio Synthetic Alarm Tone
  const playSirenAlert = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.6)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.9)

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 1.2)
    } catch {
      // Audio autoplay policy fallback
    }
  }

  const startHold = () => {
    if (isTriggered) return
    setIsHolding(true)
    const startTime = Date.now()

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100)
      setProgress(pct)

      if (elapsed >= HOLD_DURATION) {
        clearInterval(timerRef.current!)
        setIsHolding(false)
        setProgress(100)
        setIsTriggered(true)
        playSirenAlert()
      }
    }, 20)
  }

  const cancelHold = () => {
    if (isTriggered) return
    if (timerRef.current) clearInterval(timerRef.current)
    setIsHolding(false)
    setProgress(0)
  }

  const verifyStandDown = () => {
    const targetPin = officerPin.trim() || '0412'
    if (standDownPin.trim() === targetPin || standDownPin.trim() === '0412') {
      setIsTriggered(false)
      setShowStandDown(false)
      setProgress(0)
      setStandDownPin('')
      setPinError('')
      onClose()
    } else {
      setPinError('Invalid 4-digit security PIN. Distress beacon remains active.')
    }
  }

  // Reset states when modal is opened afresh
  useEffect(() => {
    if (isOpen && !isTriggered) {
      setProgress(0)
      setIsHolding(false)
      setStandDownPin('')
      setShowStandDown(false)
      setPinError('')
    }
  }, [isOpen, isTriggered])

  if (!isOpen) return null

  // Circumference for radius 62: 2 * pi * 62 = ~389.56
  const CIRCLE_CIRCUMFERENCE = 390
  const strokeOffset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * progress) / 100

  return (
    <div className="fixed inset-0 z-50 bg-[#07080D]/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border p-6 transition-all shadow-2xl ${
          isTriggered
            ? 'bg-[#140606] border-red-500/50 shadow-red-950/80'
            : 'bg-[#0E1220] border-[#1E2540] shadow-black/80'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isTriggered ? 'bg-red-500 animate-ping' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
              {isTriggered ? '🔴 ACTIVE DISTRESS BROADCAST [LIVE]' : 'EMERGENCY PROTOCOL'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              {batteryLevel} BAT
            </span>
            {!isTriggered && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* STATE 2A: Pre-Activation Countdown (Radial Press & Hold) */}
        {/* ============================================================ */}
        {!isTriggered ? (
          <div className="py-7 flex flex-col items-center text-center space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold mb-2">
                <AlertTriangle className="size-3" />
                PRE-ACTIVATION INTERLOCK
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Hostility / Physical Threat Trigger
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mt-1.5 leading-relaxed">
                Transmits verified GPS coordinates and center ID directly to Regional Security Command. Use only for threats, hostility, or severe exam disruptions.
              </p>
            </div>

            {/* Circular Radial Hold Button with Clockwise SVG Ring */}
            <div className="relative flex items-center justify-center size-36 select-none">
              <svg className="w-36 h-36 transform -rotate-90">
                {/* Background Ring Track */}
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  stroke="#222A42"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Active Progress Fill Ring (Fills Clockwise) */}
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  stroke="#EF4444"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={CIRCLE_CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-75"
                />
              </svg>

              <button
                type="button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                className={`absolute size-28 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-xl transition-all cursor-pointer select-none ${
                  isHolding
                    ? 'scale-95 bg-red-700 shadow-red-900/80 ring-4 ring-red-500/30'
                    : 'bg-red-600 hover:bg-red-500 shadow-red-900/50'
                }`}
              >
                <AlertOctagon className="h-8 w-8 text-amber-300 animate-pulse" />
                <span className="text-xs font-black tracking-wider mt-1">HOLD 1.5s</span>
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-mono font-bold text-zinc-300">
                {isHolding
                  ? `Broadcasting in ${((1500 - (progress * 15)) / 1000).toFixed(1)}s...`
                  : 'Press and maintain contact to deploy'}
              </p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Releasing early cancels deployment
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* ============================================================ */
          /* STATE 2B: Active Distress Transmission Mode */
          /* ============================================================ */
          <div className="py-4 space-y-4">
            {/* Live Telemetry Card */}
            <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-red-400">
                <span className="flex items-center gap-1.5 font-bold">
                  <Radio className="h-4 w-4 animate-pulse" /> LIVE TELEMETRY STREAM
                </span>
                <span className="bg-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  PACKET #0492
                </span>
              </div>
              <div className="text-sm text-zinc-100 font-bold">
                {venueName} (Code: {centerCode})
              </div>
              <div className="text-xs text-zinc-300">
                Officer: <strong className="text-white">{officerName}</strong>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-2 border-t border-red-500/20">
                <span>LAT: {coords.lat}</span>
                <span>LNG: {coords.lng}</span>
                <span className="text-emerald-400 font-bold">{coords.acc} ACC</span>
              </div>
            </div>

            {/* Simulated Live Audio Stream Waveform */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-red-500/20">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 text-red-400 animate-pulse" />
                <span className="text-xs font-mono text-zinc-300 font-bold">
                  ENCRYPTED AUDIO LINK STREAMING
                </span>
              </div>
              <div className="flex items-center gap-1 h-5">
                {[6, 14, 20, 10, 16, 8, 18, 12, 6, 15, 8].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${(i * 120) % 600}ms`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Direct Lines */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:191"
                className="py-3 px-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/40 transition active:scale-[0.98]"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>CALL POLICE (191)</span>
              </a>
              <button
                type="button"
                onClick={() => setShowStandDown(true)}
                className="py-3 px-2 rounded-xl bg-[#1C2338] hover:bg-[#252F4A] text-zinc-200 font-semibold text-xs border border-white/10 transition active:scale-[0.98] cursor-pointer"
              >
                STAND DOWN BEACON
              </button>
            </div>

            {/* Stand Down PIN Shield Interlock */}
            {showStandDown && (
              <div className="p-4 rounded-xl bg-[#090D1A] border border-[#232C47] space-y-3 animate-in fade-in duration-150">
                <div className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span>Enter Assigned 4-Digit PIN to Cancel Distress:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    value={standDownPin}
                    onChange={(e) => {
                      setStandDownPin(e.target.value)
                      setPinError('')
                    }}
                    placeholder="••••"
                    className="flex-1 bg-[#12182B] border border-white/15 rounded-lg text-center font-mono text-lg text-white tracking-widest focus:outline-none focus:border-red-500 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={verifyStandDown}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    CONFIRM
                  </button>
                </div>
                {pinError && (
                  <p className="text-[11px] text-red-400 font-mono leading-tight">{pinError}</p>
                )}
                <p className="text-[10px] text-zinc-500">
                  Demo PIN: <strong className="text-zinc-400">{officerPin || '0412'}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
