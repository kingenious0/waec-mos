'use client'

import React from 'react'
import { Phone, Flag, ChevronDown, Clock } from 'lucide-react'
import { relativeTime } from '@/components/admin/inspector/OfficerTelematicsDrawer'
import { getOfficerUnitCode, type FleetOfficer } from '@/components/admin/FleetMap'

export type SheetSnap = 'peek' | 'half' | 'full'

interface MobileOfficerSheetProps {
  officer: FleetOfficer
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  onCallOfficer: (phone: string) => void
  onViewLogs: (officerId: string) => void
}

/**
 * Mobile bottom sheet for officer details with three snap points —
 * peek (name, chips, Call/Details), half (+ telemetry tiles + distance card),
 * full (+ activity feed + actions). Content never clips: the panel scrolls.
 */
export function MobileOfficerSheet({
  officer,
  snap,
  onSnapChange,
  onCallOfficer,
  onViewLogs,
}: MobileOfficerSheetProps) {
  const isSos = officer.status === 'SOS'
  const isOnSite = officer.status === 'ON_SITE'

  const batteryVal = officer.battery
  const batteryDisplay = typeof batteryVal === 'number' ? `${batteryVal}%` : '--'
  const batteryTone =
    typeof batteryVal !== 'number'
      ? 'text-slate-400 border-[#22263C] bg-[#11131F]'
      : batteryVal <= 20
      ? 'text-status-sos border-status-sos/40 bg-status-sos/10'
      : batteryVal <= 40
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  const batteryDot =
    typeof batteryVal === 'number' && batteryVal <= 20
      ? 'bg-status-sos'
      : typeof batteryVal === 'number' && batteryVal <= 40
      ? 'bg-amber-400'
      : 'bg-emerald-400'

  const dist = officer.distanceFromDatum
  const radiusMeters = officer.centerRadius || 150
  const distLabel =
    dist === null || dist === undefined
      ? 'No ping'
      : dist >= 1000
      ? `${(dist / 1000).toFixed(1)} km away`
      : `${dist} m away`
  const withinPerimeter = typeof dist === 'number' && dist <= radiusMeters

  const lastPingIso = officer.lastPingAt
  const isStale = (() => {
    if (!lastPingIso) return false
    const ts = Date.parse(lastPingIso)
    return !Number.isNaN(ts) && Date.now() - ts > 5 * 60 * 1000
  })()
  const lastPingGmt = lastPingIso
    ? new Date(lastPingIso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
    : null
  const lastSeen = lastPingIso ? `${relativeTime(lastPingIso)} · ${lastPingGmt}` : 'Never pinged'

  const unitCode = getOfficerUnitCode(officer)
  const checkpoints = officer.checkpoints || []

  const cycleSnap = () =>
    onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')

  const stepDown = () =>
    onSnapChange(snap === 'full' ? 'half' : 'peek')

  const snapHeight =
    snap === 'peek' ? 'h-[248px]' : snap === 'half' ? 'h-[54vh]' : 'h-[88vh]'

  const statusNode = isSos
    ? { label: 'CRITICAL', cls: 'border-status-sos/40 bg-status-sos/10 text-status-sos', dot: 'bg-status-sos' }
    : isOnSite
    ? { label: 'On site', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' }
    : { label: 'Standby', cls: 'border-slate-600/50 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' }

  const identityHeader = (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`size-12 shrink-0 rounded-full border flex items-center justify-center text-sm font-bold ${
          isSos
            ? 'bg-status-sos/15 border-status-sos/40 text-status-sos'
            : 'bg-[#1E2B7B] border-white/10 text-white'
        }`}
      >
        {unitCode.slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {officer.name}
          </span>
          {isStale && (
            <span className="shrink-0 inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-400">
              STALE
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
          {officer.assignedCenter}
        </div>
      </div>
    </div>
  )

  const chipsRow = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusNode.cls}`}
      >
        <span className={`size-1.5 rounded-full ${statusNode.dot}`} />
        {statusNode.label}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${batteryTone}`}
      >
        <span className={`size-1.5 rounded-full ${batteryDot}`} />
        Battery {batteryDisplay}
      </span>
      <span className="inline-flex items-center rounded-full border border-[#22263C] bg-[#11131F] px-2.5 py-1 text-[11px] font-semibold text-slate-300 tabular-nums">
        {distLabel}
      </span>
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${
          isStale
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-[#22263C] bg-[#11131F] text-slate-500'
        }`}
      >
        Last seen {relativeTime(lastPingIso)}
      </span>
    </div>
  )

  const telemetryTiles = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#11131F] border border-[#22263C] px-3 py-2.5 flex flex-col">
          <span className="text-[9px] font-sans text-slate-500 tracking-wider uppercase">Speed</span>
          <span className="text-lg font-semibold text-white tabular-nums leading-tight mt-0.5">
            {typeof officer.speedKmh === 'number' ? officer.speedKmh : '--'}
            <span className="text-[10px] font-medium text-slate-500 ml-1">km/h</span>
          </span>
        </div>
        <div className="rounded-xl bg-[#11131F] border border-[#22263C] px-3 py-2.5 flex flex-col">
          <span className="text-[9px] font-sans text-slate-500 tracking-wider uppercase">Range</span>
          <span className="text-lg font-semibold text-amber-400 tabular-nums leading-tight mt-0.5">
            {distLabel.replace(' away', '')}
          </span>
        </div>
        <div className="rounded-xl bg-[#11131F] border border-[#22263C] px-3 py-2.5 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-sans text-slate-500 tracking-wider uppercase">Telemetry</span>
            {isStale && (
              <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1 py-px text-[8px] font-extrabold tracking-wider text-amber-400">
                STALE
              </span>
            )}
          </div>
          <span
            className={`text-sm font-semibold leading-tight mt-1 ${
              officer.isOnline ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {officer.isOnline ? 'Online' : 'Offline'}
          </span>
          <span className="text-[10px] text-slate-500 truncate tabular-nums">{lastSeen}</span>
        </div>
        <div className="rounded-xl bg-[#11131F] border border-[#22263C] px-3 py-2.5 flex flex-col">
          <span className="text-[9px] font-sans text-slate-500 tracking-wider uppercase">Battery</span>
          <span
            className={`text-lg font-semibold tabular-nums leading-tight mt-0.5 ${
              typeof batteryVal === 'number' && batteryVal <= 20
                ? 'text-status-sos'
                : typeof batteryVal === 'number' && batteryVal <= 40
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {batteryDisplay}
            {typeof batteryVal === 'number' && (
              <span className="text-[10px] font-medium text-slate-500 ml-1">%</span>
            )}
          </span>
        </div>
      </div>

      {/* Distance card */}
      <div className="rounded-xl bg-[#11131F] border border-[#22263C] p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300 min-w-0">
          <Flag className="size-3.5 text-sky-400 shrink-0" />
          <span className="truncate">{officer.assignedCenter}</span>
        </div>
        <div className="flex items-end justify-between gap-3 mt-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-sans text-slate-500 tracking-wider uppercase">
              Distance from centre
            </span>
            <span className="text-xl font-bold text-white tabular-nums leading-tight">
              {distLabel.replace(' away', '')}
            </span>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-wide whitespace-nowrap ${
              typeof dist !== 'number'
                ? 'border-slate-600/50 bg-slate-500/10 text-slate-400'
                : withinPerimeter
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            }`}
          >
            {typeof dist !== 'number'
              ? 'NO TELEMETRY'
              : withinPerimeter
              ? `WITHIN ${radiusMeters}M`
              : 'OUTSIDE'}
          </span>
        </div>
      </div>
    </>
  )

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border-t border-[#22263C] bg-[#0C0F17]/97 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.55)] transition-[height] duration-300 ${snapHeight}`}
      role="dialog"
      aria-label={`Details for ${officer.name}`}
    >
      {/* Grabber — tap to cycle peek → half → full */}
      <div className="relative pt-2 pb-1.5 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={cycleSnap}
          aria-label="Resize details panel"
          className="py-1 px-8 cursor-pointer"
        >
          <span className="block h-1 w-12 rounded-full bg-slate-600" />
        </button>
        {snap !== 'peek' && (
          <button
            type="button"
            onClick={stepDown}
            aria-label="Collapse panel"
            className="absolute right-3 top-1/2 -translate-y-1/2 size-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <ChevronDown className="size-5" />
          </button>
        )}
      </div>

      {snap === 'peek' && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 shrink-0">
          {identityHeader}
          {chipsRow}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onCallOfficer(officer.phone)}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold transition cursor-pointer"
            >
              <Phone className="size-4" />
              Call officer
            </button>
            <button
              type="button"
              onClick={() => onSnapChange('full')}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-[#161B2E] hover:bg-[#1D2440] border border-[#22263C] text-slate-200 hover:text-white text-sm font-semibold transition cursor-pointer"
            >
              Details
            </button>
          </div>
        </div>
      )}

      {snap === 'half' && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 flex-1 overflow-y-auto">
          {identityHeader}
          {chipsRow}
          {telemetryTiles}
        </div>
      )}

      {snap === 'full' && (
        <>
          <div className="px-4 pb-3 flex flex-col gap-2.5 flex-1 overflow-y-auto">
            {identityHeader}
            {chipsRow}
            {telemetryTiles}

            {/* Recent activity — flat list */}
            <div className="space-y-0">
              <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 block pt-1">
                Recent activity
              </span>
              {checkpoints.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#22263C] p-4 text-center text-xs text-slate-500 mt-2">
                  No duty activity logged yet for this officer.
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-[#22263C] bg-[#11131F] overflow-hidden">
                  {checkpoints.map((cp, i) => (
                    <div
                      key={cp.id}
                      className={`flex items-start justify-between gap-3 px-3 py-3 ${
                        i > 0 ? 'border-t border-[#1E243A]' : ''
                      }`}
                    >
                      <span className="text-[11px] text-slate-200 leading-snug">
                        {cp.label}
                      </span>
                      <span className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                        {cp.iso ? `${relativeTime(cp.iso)} · ` : ''}
                        {cp.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="shrink-0 p-3 border-t border-[#22263C] bg-[#0B0D14] grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCallOfficer(officer.phone)}
              className="h-12 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold transition cursor-pointer"
            >
              <Phone className="size-4" />
              Call officer
            </button>
            <button
              type="button"
              onClick={() => onViewLogs(officer.id)}
              className="h-12 flex items-center justify-center gap-2 rounded-2xl bg-[#161B2E] hover:bg-[#1D2440] border border-[#22263C] text-slate-200 hover:text-white text-sm font-semibold transition cursor-pointer"
            >
              <Clock className="size-4" />
              View logs
            </button>
          </div>
        </>
      )}
    </div>
  )
}
