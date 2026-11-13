'use client'

import React from 'react'
import { Phone, Clock, Flag, X, Siren, Check } from 'lucide-react'
import { getOfficerUnitCode, type FleetOfficer } from '@/components/admin/FleetMap'

interface OfficerTelematicsDrawerProps {
  officer: FleetOfficer | null
  onCallOfficer: (phone: string) => void
  onViewLogs: (officerId: string) => void
  isMobileDrawerExpanded?: boolean
  onToggleMobileDrawer?: () => void
  onClose?: () => void
  onAcknowledgeSos?: (officer: FleetOfficer) => void
  onResolveSos?: (officer: FleetOfficer) => void
}

/** "just now" / "3m ago" / "2h ago" from an ISO timestamp. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return 'Never'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'Never'
  const diff = Date.now() - ts
  if (diff < 45_000) return 'just now'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function OfficerTelematicsDrawer({
  officer,
  onCallOfficer,
  onViewLogs,
  onToggleMobileDrawer,
  onClose,
  onAcknowledgeSos,
  onResolveSos,
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

  // Telemetry tile: Online/Offline + an explicit NO UPDATE tag when the last
  // ping is older than 5 minutes.
  const isTelemetryStale = (() => {
    if (!officer.lastPingAt) return false
    const ts = Date.parse(officer.lastPingAt)
    if (Number.isNaN(ts)) return false
    return Date.now() - ts > 5 * 60 * 1000
  })()
  const teleState = officer.isOnline ? 'Online' : 'Offline'
  const lastPingGmt = officer.lastPingAt
    ? new Date(officer.lastPingAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' GMT'
    : null
  const lastPingLine = officer.lastPingAt
    ? `${relativeTime(officer.lastPingAt)} · ${lastPingGmt}`
    : 'Never pinged'

  const withinPerimeter = typeof dist === 'number' && dist <= radiusMeters
  const checkpoints = officer.checkpoints || []
  const sosAcknowledged = (officer.sosStatus || '').toUpperCase() === 'ACKNOWLEDGED'

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
        {/* Unresolved SOS Banner */}
        {isSos && officer.sosIncidentId && (
          <div className="rounded-xl border border-status-sos/50 bg-status-sos/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 text-status-sos font-sans font-bold text-[11px] tracking-wide">
                <Siren className="size-4 shrink-0 animate-pulse" />
                <span className="truncate">
                  ACTIVE SOS · {officer.sosIncidentNumber || 'DISTRESS'}
                </span>
              </div>
              {sosAcknowledged && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-bold tracking-wider text-slate-300">
                  <Check className="size-3" />
                  ACKNOWLEDGED
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-red-100/80">
              {officer.sosDetails || 'Officer triggered the emergency distress beacon.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sosAcknowledged || !onAcknowledgeSos}
                onClick={() => onAcknowledgeSos?.(officer)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="size-3.5" />
                {sosAcknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
              <button
                type="button"
                onClick={() => onResolveSos?.(officer)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-white text-[11px] font-semibold transition cursor-pointer"
              >
                <Check className="size-3.5" />
                Resolve
              </button>
            </div>
          </div>
        )}

        {/* Top Officer Header Card — single status chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <div
                className={`size-12 rounded-xl flex items-center justify-center font-sans font-bold text-sm border ${
                  isSos
                    ? 'bg-status-sos/15 text-status-sos border-status-sos/30'
                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-400/25'
                }`}
              >
                {unitCode.slice(0, 4)}
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                  {officer.name}
                </span>
                {officer.isLeader && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    LEAD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 min-w-0">
                <span className="truncate">{officer.assignedCenter}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-sans font-bold tracking-wide whitespace-nowrap ${
                isSos
                  ? 'bg-status-sos/10 border-status-sos/40 text-status-sos'
                  : isOnSite
                  ? 'bg-status-ok/10 border-status-ok/35 text-status-ok'
                  : 'bg-sky-500/10 border-sky-400/30 text-sky-400'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isSos ? 'bg-status-sos' : isOnSite ? 'bg-status-ok' : 'bg-sky-400'
                }`}
              />
              {isSos ? 'CRITICAL' : isOnSite ? 'ON SITE' : 'STANDBY'}
            </span>

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

        {/* Live stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <div className="rounded-xl bg-[#111522] border border-border/70 px-2.5 py-2 flex flex-col">
            <span className="text-[9px] font-sans text-muted-foreground tracking-wider uppercase">
              Speed
            </span>
            <span className="text-base font-semibold font-sans text-foreground mt-0.5 tabular-nums leading-none">
              {speedDisplay}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans mt-0.5">km/h</span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-border/70 px-2.5 py-2 flex flex-col">
            <span className="text-[9px] font-sans text-muted-foreground tracking-wider uppercase">
              Range
            </span>
            <span className="text-base font-semibold font-sans text-amber-400 mt-0.5 tabular-nums leading-none">
              {distLabel}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans mt-0.5">{distUnit}</span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-border/70 px-2.5 py-2 flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-sans text-muted-foreground tracking-wider uppercase">
                Telemetry
              </span>
              {isTelemetryStale && (
                <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1 py-px text-[8px] font-extrabold tracking-wider text-amber-400">
                  NO UPDATE
                </span>
              )}
            </div>
            <span
              className={`text-sm font-semibold font-sans mt-1 leading-none ${
                officer.isOnline ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {teleState}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans mt-0.5 truncate">
              {lastPingLine}
            </span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-border/70 px-2.5 py-2 flex flex-col">
            <span className="text-[9px] font-sans text-muted-foreground tracking-wider uppercase">
              Battery
            </span>
            <span
              className={`text-base font-semibold font-sans mt-0.5 tabular-nums leading-none ${
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
              className={`text-[10px] font-medium mt-0.5 ${
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

        {/* Assigned Venue & Distance Card (distance row, no progress bar) */}
        <div className="rounded-xl bg-[#111522] border border-border/80 p-3.5">
          <div className="flex items-center gap-2 font-medium text-xs text-foreground min-w-0">
            <Flag className="size-3.5 text-sky-400 shrink-0" />
            <span className="truncate">{officer.assignedCenter}</span>
          </div>

          <div className="flex items-end justify-between gap-3 mt-2.5">
            <div className="flex flex-col">
              <span className="text-[9px] font-sans text-muted-foreground tracking-wider uppercase">
                Distance from center
              </span>
              <span className="text-2xl font-bold font-sans text-foreground tabular-nums leading-tight">
                {distLabel}
                <span className="text-xs font-semibold text-muted-foreground ml-1">
                  {dist === null || dist === undefined ? '' : distUnit}
                </span>
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
                ? 'NO LOCATION'
                : withinPerimeter
                ? `WITHIN ${radiusMeters}M`
                : 'OUTSIDE PERIMETER'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <span>
              {isOnSite
                ? officer.verifiedTime
                  ? `Checked in at ${officer.verifiedTime}`
                  : 'Stationed at Center'
                : officer.hasLiveTelemetry
                ? 'Live GPS Tracking'
                : 'Awaiting GPS ping'}
            </span>
            <span className="text-foreground tabular-nums">Radius {radiusMeters}m</span>
          </div>
        </div>

        {/* Live duty checkpoints (audit log) */}
        <div className="space-y-2 pt-1 flex-1">
          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block">
            Recent Activity
          </span>

          {checkpoints.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-slate-500">
              No duty activity logged yet for this officer.
            </div>
          ) : (
            <div className="relative pl-1">
              <span className="absolute left-[6px] top-1.5 bottom-1.5 w-px bg-border/70" />
              <div className="space-y-3 text-xs font-sans">
                {checkpoints.map((cp) => {
                  const dotColor =
                    cp.tone === 'critical'
                      ? 'bg-status-sos shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                      : cp.tone === 'ok'
                      ? 'bg-status-ok shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                      : 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]'
                  const textTone =
                    cp.tone === 'critical' ? 'text-red-300 font-medium' : 'text-slate-300'

                  return (
                    <div key={cp.id} className="relative flex items-start justify-between gap-2">
                      <div className={`flex items-start gap-2.5 min-w-0 ${textTone}`}>
                        <span
                          className={`absolute -left-1 top-1 size-2 rounded-full ${dotColor} ring-2 ring-[#0C0F17]`}
                        />
                        <span className="pl-3 leading-snug">{cp.label}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 tabular-nums whitespace-nowrap">
                        {cp.iso ? `${relativeTime(cp.iso)} · ` : ''}
                        {cp.time}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-border/80 bg-[#0B0D14] grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onCallOfficer(officer.phone)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Phone className="size-4 shrink-0" />
          <span>Call Officer</span>
        </button>

        <button
          type="button"
          onClick={() => onViewLogs(officer.id)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#111420] hover:bg-[#181D2E] text-foreground border border-border text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span>View Logs</span>
        </button>
      </div>
    </div>
  )
}
