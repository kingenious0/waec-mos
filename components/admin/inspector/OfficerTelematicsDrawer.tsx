'use client'

import React from 'react'
import { Radio, Clock, Flag, X } from 'lucide-react'
import { getOfficerUnitCode, type FleetOfficer } from '@/components/admin/FleetMap'

interface OfficerTelematicsDrawerProps {
  officer: FleetOfficer | null
  onCallOfficer: (phone: string) => void
  onViewLogs: (officerId: string) => void
  isMobileDrawerExpanded?: boolean
  onToggleMobileDrawer?: () => void
  onClose?: () => void
}

export function OfficerTelematicsDrawer({
  officer,
  onCallOfficer,
  onViewLogs,
  onToggleMobileDrawer,
  onClose,
}: OfficerTelematicsDrawerProps) {
  if (!officer) return null

  const unitCode = getOfficerUnitCode(officer)
  const isSos = officer.status === 'SOS'
  const isOnSite = officer.status === 'ON_SITE'
  const radiusMeters = officer.centerRadius || 150
  const dist = officer.distanceFromDatum

  const distLabel =
    dist === null || dist === undefined
      ? '--'
      : dist >= 1000
      ? `${(dist / 1000).toFixed(1)}`
      : `${dist}`
  const distUnit =
    dist === null || dist === undefined ? 'No ping' : dist >= 1000 ? 'km' : 'm'

  const speedDisplay =
    typeof officer.speedKmh === 'number' ? String(officer.speedKmh) : '--'

  const batteryVal = officer.battery
  const batteryDisplay = typeof batteryVal === 'number' ? `${batteryVal}%` : '--%'
  const batteryHealth =
    typeof batteryVal !== 'number'
      ? 'No data'
      : batteryVal <= 20
      ? 'Critical'
      : batteryVal <= 40
      ? 'Low'
      : 'Good'

  const signalState = officer.isOnline
    ? 'Online'
    : officer.lastPingAt
    ? 'Stale'
    : 'Offline'
  const lastPingFormatted = officer.lastPingAt
    ? new Date(officer.lastPingAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' GMT'
    : 'Never'

  // Compute perimeter readiness percentage dynamically
  let perimeterPct = 0
  if (isOnSite) {
    perimeterPct = 100
  } else if (typeof dist === 'number') {
    if (dist <= radiusMeters) {
      perimeterPct = 100
    } else {
      perimeterPct = Math.max(8, Math.min(95, Math.round((radiusMeters / dist) * 100)))
    }
  }

  const checkpoints = officer.checkpoints || []

  return (
    <div className="flex flex-col h-full bg-[#0C0F17] select-none text-foreground">
      {/* Mobile Drawer Grab Handle */}
      <div
        onClick={onToggleMobileDrawer}
        className="lg:hidden w-full pt-3 pb-1 flex flex-col items-center cursor-pointer active:opacity-70"
      >
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      <div className="p-4 flex-1 flex flex-col overflow-y-auto space-y-4">
        {/* Top Officer Header Card */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className={`size-12 rounded-xl flex items-center justify-center font-sans font-bold text-sm border ${
                  isSos
                    ? 'bg-status-sos/15 text-status-sos border-status-sos/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}
              >
                {unitCode.slice(0, 4)}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#0C0F17] ${
                  isSos
                    ? 'bg-status-sos animate-ping'
                    : isOnSite
                    ? 'bg-status-ok'
                    : officer.isOnline
                    ? 'bg-sky-400'
                    : 'bg-slate-500'
                }`}
              />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">
                  {officer.name}
                </span>
                {officer.isLeader && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    LEAD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="truncate max-w-[150px]">
                  {officer.assignedCenter}
                </span>
                <span>•</span>
                <span
                  className={
                    isSos
                      ? 'text-status-sos font-semibold shrink-0'
                      : isOnSite
                      ? 'text-status-ok shrink-0'
                      : 'text-amber-400 shrink-0'
                  }
                >
                  {isSos ? 'SOS Alert' : isOnSite ? 'On Site' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block">
                STATUS
              </span>
              <span
                className={`text-xs font-sans font-bold ${
                  isSos
                    ? 'text-status-sos'
                    : isOnSite
                    ? 'text-emerald-400'
                    : 'text-sky-400'
                }`}
              >
                {isSos ? 'CRITICAL' : isOnSite ? 'Verified' : 'Standby'}
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close inspector"
                className="size-7 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4-Stat Live Telematics Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              SPEED
            </span>
            <span className="text-base font-semibold font-sans text-foreground mt-0.5 tabular-nums">
              {speedDisplay}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans">km/h</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              RANGE
            </span>
            <span className="text-base font-semibold font-sans text-amber-400 mt-0.5 tabular-nums">
              {distLabel}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans">{distUnit}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              TELEMETRY
            </span>
            <span
              className={`text-sm font-semibold font-sans mt-1 ${
                officer.isOnline
                  ? 'text-emerald-400'
                  : officer.lastPingAt
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {signalState}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans truncate">
              {lastPingFormatted}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              BATTERY
            </span>
            <span
              className={`text-base font-semibold font-sans mt-0.5 tabular-nums ${
                typeof batteryVal !== 'number'
                  ? 'text-slate-400'
                  : batteryVal <= 20
                  ? 'text-status-sos'
                  : batteryVal <= 40
                  ? 'text-amber-400'
                  : 'text-status-ok'
              }`}
            >
              {batteryDisplay}
            </span>
            <span
              className={`text-[10px] font-medium ${
                typeof batteryVal !== 'number'
                  ? 'text-slate-500'
                  : batteryVal <= 20
                  ? 'text-status-sos'
                  : 'text-status-ok'
              }`}
            >
              {batteryHealth}
            </span>
          </div>
        </div>

        {/* Venue & Live Perimeter Progress Card */}
        <div className="rounded-xl bg-[#111522] border border-border/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground min-w-0">
              <Flag className="size-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{officer.assignedCenter}</span>
            </div>
            <span className="font-sans font-semibold text-sky-400 shrink-0 tabular-nums">
              {perimeterPct}%
            </span>
          </div>

          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isSos
                  ? 'bg-red-500'
                  : isOnSite
                  ? 'bg-emerald-400'
                  : 'bg-gradient-to-r from-amber-400 via-sky-400 to-sky-500'
              }`}
              style={{ width: `${perimeterPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground">
            <span>
              {isOnSite
                ? officer.verifiedTime
                  ? `Checked in at ${officer.verifiedTime}`
                  : 'Stationed at Center'
                : officer.hasLiveTelemetry
                ? 'Live GPS Tracking'
                : 'Awaiting GPS ping'}
            </span>
            <span className="text-foreground tabular-nums">
              {typeof dist === 'number'
                ? dist <= radiusMeters
                  ? `Within ${radiusMeters}m perimeter`
                  : `${dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`} from center`
                : 'No telemetry fix'}
            </span>
          </div>
        </div>

        {/* Live Duty Checkpoints from Neon audit_logs */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block">
            RECENT ACTIVITY LOGS
          </span>

          {checkpoints.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-slate-500">
              No duty activity logged yet for this officer.
            </div>
          ) : (
            <div className="space-y-2 text-xs font-sans">
              {checkpoints.map((cp) => {
                const dotColor =
                  cp.tone === 'critical'
                    ? 'bg-status-sos'
                    : cp.tone === 'ok'
                    ? 'bg-status-ok'
                    : 'bg-sky-400'
                const textTone =
                  cp.tone === 'critical'
                    ? 'text-red-300 font-medium'
                    : 'text-slate-300'

                return (
                  <div key={cp.id} className="flex items-start justify-between gap-2">
                    <div className={`flex items-start gap-2 min-w-0 ${textTone}`}>
                      <span className={`size-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                      <span className="leading-snug">{cp.label}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{cp.time}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-border/80 bg-[#0B0D14] grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onCallOfficer(officer.phone)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-400 hover:bg-sky-300 active:bg-sky-500 text-slate-950 font-semibold text-xs transition-colors cursor-pointer shadow-xs"
        >
          <Radio className="size-4 shrink-0" />
          <span>Comms Link</span>
        </button>

        <button
          type="button"
          onClick={() => onViewLogs(officer.id)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#111420] hover:bg-[#181D2E] text-foreground border border-border text-xs font-medium transition-colors cursor-pointer shadow-xs"
        >
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span>View Logs</span>
        </button>
      </div>
    </div>
  )
}
