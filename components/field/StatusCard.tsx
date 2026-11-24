'use client'

import React from 'react'
import { CheckCircle2, MapPin, AlertCircle, Loader2 } from 'lucide-react'

export type StatusCardState =
  | 'inside'
  | 'outside'
  | 'checked-in'
  | 'gps-denied'
  | 'gps-off'
  | 'gps-searching'
  | 'offline'
  | 'unassigned'

interface StatusCardProps {
  state: StatusCardState
  distanceMeters: number
  geofenceRadius?: number
  checkInTime?: string
  elapsedFormatted?: string
  onRetryGps?: () => void
  onOpenLocationSettings?: () => void
  onOpenAppSettings?: () => void
}

export function StatusCard({
  state,
  distanceMeters,
  geofenceRadius = 150,
  checkInTime = 'Just now',
  elapsedFormatted = '00:00:00',
  onRetryGps,
  onOpenLocationSettings,
  onOpenAppSettings,
}: StatusCardProps) {
  // 1. Checked-in state
  if (state === 'checked-in') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full rounded-2xl bg-[#0C1524] border border-[#1E3A5F] p-4 flex items-center justify-between text-zinc-100 shadow-md select-none"
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-emerald-400 leading-snug">
              Checked in at {checkInTime}
            </div>
            <div className="text-[13px] text-slate-400 mt-0.5">
              Verified on duty · Inside {geofenceRadius} m check-in area
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white tabular-nums">
            {elapsedFormatted}
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">
            Shift elapsed
          </div>
        </div>
      </div>
    )
  }

  // 2. GPS permission denied
  if (state === 'gps-denied') {
    return (
      <div
        role="alert"
        className="w-full rounded-2xl bg-[#1C1215] border border-red-500/30 p-4 flex items-start gap-3.5 text-zinc-100 shadow-md select-none"
      >
        <div className="size-11 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="size-6 text-red-400" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-red-400">
            Allow location to check in
          </div>
          <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">
            WAEC needs your phone&apos;s location to confirm you reached the centre. Choose
            &ldquo;Precise location&rdquo; for WAEC Field, then try again.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetryGps && (
              <button
                type="button"
                onClick={onRetryGps}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold border border-red-500/40 transition cursor-pointer"
              >
                Allow and try again
              </button>
            )}
            {onOpenAppSettings && (
              <button
                type="button"
                onClick={onOpenAppSettings}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 text-slate-300 text-xs font-semibold border border-slate-600 transition cursor-pointer"
              >
                Open app settings
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 2b. Phone location services switched off
  if (state === 'gps-off') {
    return (
      <div
        role="alert"
        className="w-full rounded-2xl bg-[#1C1612] border border-amber-500/30 p-4 flex items-start gap-3.5 text-zinc-100 shadow-md select-none"
      >
        <div className="size-11 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="size-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-amber-300">
            Location is switched off
          </div>
          <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">
            Turn on Location on this phone, then come back. WAEC cannot confirm where you are
            while it is off.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onOpenLocationSettings && (
              <button
                type="button"
                onClick={onOpenLocationSettings}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold border border-amber-500/40 transition cursor-pointer"
              >
                Open phone settings
              </button>
            )}
            {onRetryGps && (
              <button
                type="button"
                onClick={onRetryGps}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 text-slate-300 text-xs font-semibold border border-slate-600 transition cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 3. GPS Searching
  if (state === 'gps-searching') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full rounded-2xl bg-[#0F1320] border border-[#1E253A] p-4 flex items-center gap-3 text-zinc-100 shadow-md select-none"
      >
        <div className="size-11 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
          <Loader2 className="size-6 text-sky-400 animate-spin" />
        </div>
        <div>
          <div className="text-[15px] font-bold text-sky-400">
            Acquiring satellite signal...
          </div>
          <div className="text-[13px] text-slate-400 mt-0.5">
            Hold device near open sky for optimal accuracy
          </div>
        </div>
      </div>
    )
  }

  // 3b. Unassigned Center
  if (state === 'unassigned') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full rounded-2xl bg-[#0F1320] border border-[#1E253A] p-4 flex items-center gap-3 text-zinc-100 shadow-md select-none"
      >
        <div className="size-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <MapPin className="size-5 text-slate-400" />
        </div>
        <div>
          <div className="text-[15px] font-bold text-slate-200">
            No Examination Centre Assigned
          </div>
          <div className="text-[13px] text-slate-400 mt-0.5">
            Contact Regional Command to assign a center before check-in
          </div>
        </div>
      </div>
    )
  }

  // 4. Inside vs Outside Check-in area (Primary Operational States)
  const isInside = state === 'inside'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full rounded-2xl p-4 flex items-center justify-between text-zinc-100 shadow-md select-none transition-colors ${
        isInside
          ? 'bg-[#0E1522] border border-[#16293E]'
          : 'bg-[#151216] border border-[#2D211F]'
      }`}
    >
      {/* Left Icon + Text */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`size-12 rounded-full flex items-center justify-center shrink-0 border ${
            isInside
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-[#312316] border-amber-500/30 text-[#F6D300]'
          }`}
        >
          {isInside ? (
            <CheckCircle2 className="size-6" />
          ) : (
            <MapPin className="size-6 text-[#F6D300]" />
          )}
        </div>

        <div className="min-w-0">
          <h2
            className={`text-[15px] font-bold leading-snug tracking-tight ${
              isInside ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isInside ? "You're at the centre" : "You're outside the check-in area"}
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5 truncate">
            {isInside
              ? `Inside the ${geofenceRadius} m check-in area`
              : `Move within ${geofenceRadius} m to check in`}
          </p>
        </div>
      </div>

      {/* Right Distance Stat */}
      <div className="text-right shrink-0 ml-3">
        <div
          className={`text-2xl font-bold tabular-nums leading-none ${
            isInside ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {distanceMeters >= 1000
            ? `${(distanceMeters / 1000).toFixed(1)} km`
            : `${distanceMeters} m`}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-medium">
          from centre
        </div>
      </div>
    </div>
  )
}
