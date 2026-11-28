'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Phone,
  Clock,
  Flag,
  X,
  Siren,
  Check,
  Camera,
  Maximize2,
  Download,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import {
  getOfficerUnitCode,
  officerArrivalConfirmed,
  type FleetOfficer,
} from '@/components/admin/FleetMap'
import { useOfficerPhotoProof } from './use-officer-photo-proof'

interface OfficerTelematicsDrawerProps {
  officer: FleetOfficer | null
  onCallOfficer: (phone: string) => void
  onViewLogs: (officerId: string) => void
  isMobileDrawerExpanded?: boolean
  onToggleMobileDrawer?: () => void
  onClose?: () => void
  onAcknowledgeSos?: (officer: FleetOfficer) => void
  onResolveSos?: (officer: FleetOfficer) => void
  /** Every centre HQ may move this officer to. Omit to hide the correction tool. */
  schoolOptions?: { id: string; name: string }[]
  /** Move this officer to a different school for today. */
  onChangeSchool?: (officer: FleetOfficer, centerId: string) => void | Promise<void>
  /** Rare on-request proof photo, with a fixed plain-language reason. */
  onRequestPhoto?: (officer: FleetOfficer, reason: string) => void | Promise<void>
}

import { formatRelativeTime } from '@/lib/relative-time'
import { PROOF_REQUEST_REASONS } from '@/lib/field/proof-reasons'

/** "07:58" — Ghana is GMT year-round. */
function timeOfDay(iso?: string | null): string {
  if (!iso) return '--:--'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return '--:--'
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Accra',
  })
}

export function OfficerTelematicsDrawer({
  officer,
  onCallOfficer,
  onViewLogs,
  onToggleMobileDrawer,
  onClose,
  onAcknowledgeSos,
  onResolveSos,
  schoolOptions,
  onChangeSchool,
  onRequestPhoto,
}: OfficerTelematicsDrawerProps) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [proofReason, setProofReason] = useState<string>(PROOF_REQUEST_REASONS[0])
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false)
  const [pickerCenterId, setPickerCenterId] = useState('')
  const [savingSchool, setSavingSchool] = useState(false)

  const officerId = officer?.id
  // Pinned to the exact photo that fulfilled the latest request, when one exists.
  const proofPhoto = useOfficerPhotoProof(officerId)
  const photoMeta = proofPhoto.meta

  useEffect(() => {
    setPhotoFailed(false)
    setLightboxOpen(false)
    setSchoolPickerOpen(false)
    setSavingSchool(false)
  }, [officerId])

  // Escape closes the lightbox
  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxOpen])

  const handlePhotoError = useCallback(() => setPhotoFailed(true), [])

  if (!officer) return null

  const unitCode = getOfficerUnitCode(officer)
  const isSos = officer.status === 'SOS'
  const isOnSite = officer.status === 'ON_SITE'
  const arrivalConfirmed = officerArrivalConfirmed(officer)
  const radiusMeters = officer.centerRadius || 150
  const dist = officer.distanceFromDatum

  const distLabel =
    dist === null || dist === undefined
      ? '--'
      : dist >= 1000
      ? `${(dist / 1000).toFixed(1)}`
      : `${dist}`
  const distUnit = dist === null || dist === undefined ? 'No ping' : dist >= 1000 ? 'km' : 'm'

  const speedDisplay = typeof officer.speedKmh === 'number' ? String(officer.speedKmh) : '--'

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
    ? `${formatRelativeTime(officer.lastPingAt)} · ${lastPingGmt}`
    : 'Never pinged'

  const withinPerimeter = typeof dist === 'number' && dist <= radiusMeters

  // Planned vs actual — an officer who turned up at the wrong school is an
  // exception HQ must see, not a rendering detail.
  const normSchool = (v?: string | null) => (v || '').trim().toLowerCase()
  const plannedMismatch = Boolean(
    officer.plannedSchool &&
      officer.arrivalSchool &&
      normSchool(officer.plannedSchool) !== normSchool(officer.arrivalSchool),
  )
  const checkpoints = officer.checkpoints || []
  const sosAcknowledged = (officer.sosStatus || '').toUpperCase() === 'ACKNOWLEDGED'

  const photoUrl = proofPhoto.url || ''
  const showNoPhoto = photoFailed || !photoUrl
  const photoTimeLabel = photoMeta?.createdAt
    ? new Date(photoMeta.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Accra',
      }) + ' GMT'
    : null

  const proofAskControl = onRequestPhoto ? (
    <div className="mt-2 flex gap-2 border-t border-[#1E2438] pt-2">
      <select
        value={proofReason}
        onChange={(e) => setProofReason(e.target.value)}
        aria-label="Why a photo is needed"
        className="flex-1 min-w-0 h-9 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2 text-xs text-slate-300 cursor-pointer"
      >
        {PROOF_REQUEST_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onRequestPhoto(officer, proofReason)}
        className="h-9 shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 transition cursor-pointer"
      >
        Ask for photo
      </button>
    </div>
  ) : null

  return (
    <div className="relative flex flex-col h-full bg-[#0C0F17] select-none text-foreground">
      {/* Mobile Drawer Grab Handle */}
      <div
        onClick={onToggleMobileDrawer}
        className="lg:hidden w-full pt-3 pb-1 flex flex-col items-center cursor-pointer active:opacity-70"
      >
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      <div className="p-4 flex-1 flex flex-col overflow-y-auto space-y-3">
        {/* Unresolved SOS Banner */}
        {isSos && officer.sosIncidentId && (
          <div className="rounded-xl border border-status-sos/50 bg-status-sos/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 text-status-sos font-sans font-semibold text-xs tracking-wide">
                <Siren className="size-4 shrink-0 " />
                <span className="truncate">
                  ACTIVE SOS · {officer.sosIncidentNumber || 'DISTRESS'}
                </span>
              </div>
              {sosAcknowledged && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-300">
                  <Check className="size-3" />
                  ACKNOWLEDGED
                </span>
              )}
            </div>
            <p className="text-xs leading-snug text-red-100/80">
              {officer.sosDetails || 'Officer triggered the emergency distress beacon.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sosAcknowledged || !onAcknowledgeSos}
                onClick={() => onAcknowledgeSos?.(officer)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="size-3.5" />
                {sosAcknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
              <button
                type="button"
                onClick={() => onResolveSos?.(officer)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Check className="size-3.5" />
                Resolve
              </button>
            </div>
          </div>
        )}

        {/* Top Officer Header — single row, name + status chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-11 rounded-xl flex items-center justify-center font-sans font-semibold text-[13px] border shrink-0 ${
                isSos
                  ? 'bg-status-sos/15 text-status-sos border-status-sos/30'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-400/25'
              }`}
            >
              {unitCode.slice(0, 4)}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                  {officer.name}
                </span>
                {officer.isLeader && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-sans font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    LEAD
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                <span className="font-mono text-slate-400">{officer.staffId || 'No ID'}</span>
                {officer.group && <span> · {officer.group}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-sans font-semibold tracking-wide whitespace-nowrap ${
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-xl bg-[#111522] border border-[#22263C] px-2.5 py-2 flex flex-col">
            <span className="text-xs font-sans text-muted-foreground ">Speed</span>
            <span className="text-base font-semibold font-sans text-foreground mt-0.5 tabular-nums leading-none">
              {speedDisplay}
            </span>
            <span className="text-xs text-muted-foreground font-sans mt-0.5">km/h</span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-[#22263C] px-2.5 py-2 flex flex-col">
            <span className="text-xs font-sans text-muted-foreground ">Range</span>
            <span className="text-base font-semibold font-sans text-amber-400 mt-0.5 tabular-nums leading-none">
              {distLabel}
            </span>
            <span className="text-xs text-muted-foreground font-sans mt-0.5">{distUnit}</span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-[#22263C] px-2.5 py-2 flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-sans text-muted-foreground ">Telemetry</span>
              {isTelemetryStale && (
                <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1 py-px text-[8px] font-semibold text-amber-400">
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
            <span className="text-xs text-muted-foreground font-sans mt-0.5 truncate">
              {lastPingLine}
            </span>
          </div>

          <div className="rounded-xl bg-[#111522] border border-[#22263C] px-2.5 py-2 flex flex-col">
            <span className="text-xs font-sans text-muted-foreground ">Battery</span>
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
              className={`text-xs font-medium mt-0.5 ${
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

        {/* Assigned venue — where he should be, how far, in/out */}
        <div className="rounded-xl bg-[#111522] border border-[#22263C] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-xs text-foreground min-w-0">
              <Flag className="size-3.5 text-sky-400 shrink-0" />
              <span className="truncate">
                Planned: {officer.plannedSchool || officer.assignedCenter}
              </span>
            </div>
            {schoolOptions && schoolOptions.length > 0 && onChangeSchool && !schoolPickerOpen && (
              <button
                type="button"
                onClick={() => {
                  const current =
                    schoolOptions.find((o) => o.id === officer.plannedCenterId) ||
                    schoolOptions.find((o) => o.name === officer.plannedSchool) ||
                    schoolOptions[0]
                  setPickerCenterId(current?.id || '')
                  setSchoolPickerOpen(true)
                }}
                className="shrink-0 inline-flex items-center gap-1 h-7 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition cursor-pointer"
                title="Move this officer to another school today"
              >
                <Pencil className="size-3" />
                Change
              </button>
            )}
          </div>

          {schoolPickerOpen && (
            <div className="mt-2 flex items-center gap-2">
              <select
                value={pickerCenterId}
                onChange={(e) => setPickerCenterId(e.target.value)}
                aria-label="Choose today's school"
                className="flex-1 min-w-0 h-11 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-400"
              >
                {schoolOptions!.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={savingSchool || !pickerCenterId}
                onClick={async () => {
                  if (!pickerCenterId || !onChangeSchool) return
                  setSavingSchool(true)
                  try {
                    await onChangeSchool(officer, pickerCenterId)
                    setSchoolPickerOpen(false)
                  } finally {
                    setSavingSchool(false)
                  }
                }}
                className="h-11 shrink-0 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] border border-white/10 px-3.5 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
              >
                {savingSchool ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setSchoolPickerOpen(false)}
                className="h-11 shrink-0 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-3 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {plannedMismatch && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold leading-snug text-amber-300">
              <AlertTriangle className="size-3.5 shrink-0 mt-px" />
              <span>
                Arrived at {officer.arrivalSchool} instead of {officer.plannedSchool}
              </span>
            </p>
          )}

          <div className="flex items-end justify-between gap-3 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-sans text-muted-foreground ">Distance from centre</span>
              <span className="text-2xl font-semibold font-sans text-foreground tabular-nums leading-tight">
                {distLabel}
                <span className="text-xs font-semibold text-muted-foreground ml-1">
                  {dist === null || dist === undefined ? '' : distUnit}
                </span>
              </span>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide whitespace-nowrap ${
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

          <div className="flex items-center justify-between text-xs font-sans text-muted-foreground mt-2 pt-2 border-t border-white/5">
            <span className="truncate">
              {isOnSite
                ? officer.verifiedTime
                  ? `Checked in at ${officer.verifiedTime}`
                  : 'At the centre'
                : officer.hasLiveTelemetry
                ? 'Live GPS Tracking'
                : 'Awaiting GPS ping'}
            </span>
            <span className="text-slate-400 tabular-nums shrink-0 pl-2">
              Radius {radiusMeters}m
            </span>
          </div>

          {/* Today's lifecycle — arrival → confirmed → departure */}
          {(officer.todayArrival || officer.todayDeparture) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs leading-snug border-t border-white/5 pt-2">
              {officer.todayArrival && (
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    arrivalConfirmed ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      arrivalConfirmed ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {arrivalConfirmed
                    ? `Arrived ${timeOfDay(officer.todayArrival.at)} · confirmed`
                    : `Arrived ${timeOfDay(officer.todayArrival.at)} (not signed in)`}
                </span>
              )}
              {officer.todayDeparture && (
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    officer.todayDeparture.duringPaper ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      officer.todayDeparture.duringPaper ? 'bg-rose-400' : 'bg-slate-500'
                    }`}
                  />
                  Left {timeOfDay(officer.todayDeparture.at)}
                  {officer.todayDeparture.duringPaper ? ' (early)' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Photo proof — the officer's watermarked shot from the school gate */}
        <div className="rounded-xl bg-[#111522] border border-[#22263C] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
              <Camera className="size-3.5 text-slate-500" />
              Photo proof
            </span>
            {photoTimeLabel && (
              <span className="text-xs text-slate-500 tabular-nums">{photoTimeLabel}</span>
            )}
          </div>

          {showNoPhoto ? (
            <>
              <div className="mt-2 rounded-xl border border-dashed border-[#2A3048] bg-[#0A0D17]/60 px-4 py-5 text-center">
                <Camera className="size-5 text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-400">No photo proof yet</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  Appears after the officer takes one at the school
                </p>
              </div>
              {proofAskControl}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative mt-2 block w-full overflow-hidden rounded-xl border border-[#22263C] bg-[#0A0D17] cursor-zoom-in"
                aria-label="View photo proof full screen"
                title="View full screen"
              >
                <img
                  src={photoUrl}
                  alt={`Watermarked evidence from ${officer.name}`}
                  loading="lazy"
                  onError={handlePhotoError}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 border border-white/10 px-1.5 py-1 text-xs font-semibold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="size-3" />
                  Enlarge
                </span>
              </button>

              {photoMeta?.watermark && (
                <p className="mt-1.5 text-xs leading-snug text-slate-500 line-clamp-2">
                  {photoMeta.watermark}
                </p>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  <Maximize2 className="size-3.5" />
                  Enlarge
                </button>
                <a
                  href={photoUrl}
                  download={`photo-proof-${officer.staffId || 'officer'}.jpg`}
                  className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition"
                >
                  <Download className="size-3.5" />
                  Download
                </a>
              </div>
              {proofAskControl}
            </>
          )}
        </div>

        {/* Recent activity */}
        <div className="space-y-2 pt-0.5 flex-1">
          <span className="text-xs font-sans text-muted-foreground block">Recent Activity</span>

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
                      ? 'bg-status-sos '
                      : cp.tone === 'ok'
                      ? 'bg-status-ok '
                      : 'bg-sky-400 '
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
                        {cp.iso ? `${formatRelativeTime(cp.iso)} · ` : ''}
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
      <div className="p-3 border-t border-[#22263C] bg-[#0B0D14] grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCallOfficer(officer.phone)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Phone className="size-4 shrink-0" />
          <span>Call Officer</span>
        </button>

        <button
          type="button"
          onClick={() => onViewLogs(officer.id)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#111420] hover:bg-[#181D2E] text-foreground border border-[#22263C] text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span>View Logs</span>
        </button>
      </div>

      {/* Full-screen photo proof lightbox */}
      {lightboxOpen && !photoFailed && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Photo proof full screen"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 size-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
          <img
            src={photoUrl}
            alt={`Watermarked evidence from ${officer.name}`}
            className="max-w-full max-h-[74vh] object-contain rounded-xl border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {photoMeta?.watermark && (
            <p
              className="mt-3 max-w-xl text-center text-xs leading-snug text-slate-300"
              onClick={(e) => e.stopPropagation()}
            >
              {photoMeta.watermark}
            </p>
          )}
          <a
            href={photoUrl}
            download={`photo-proof-${officer.staffId || 'officer'}.jpg`}
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-white/10 px-5 h-11 text-xs font-semibold text-white transition cursor-pointer"
          >
            <Download className="size-4" />
            Download photo proof
          </a>
        </div>
      )}
    </div>
  )
}
