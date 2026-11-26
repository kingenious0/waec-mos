'use client'

import React, { useEffect, useState } from 'react'
import { Phone, Flag, ChevronDown, Clock, X, AlertTriangle, Pencil, Camera } from 'lucide-react'
import { formatRelativeTime } from '@/lib/relative-time'
import {
  getOfficerUnitCode,
  officerArrivalConfirmed,
  type FleetOfficer,
} from '@/components/admin/FleetMap'
import { PROOF_REQUEST_REASONS } from '@/lib/field/proof-reasons'
import { useOfficerPhotoProof } from './use-officer-photo-proof'

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

export type SheetSnap = 'peek' | 'half' | 'full'

interface MobileOfficerSheetProps {
  officer: FleetOfficer
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  onCallOfficer: (phone: string) => void
  onViewLogs: (officerId: string) => void
  onClose: () => void
  /** Centre correction — same rule as the desktop inspector. */
  schoolOptions?: { id: string; name: string }[]
  onChangeSchool?: (officer: FleetOfficer, centerId: string) => void | Promise<void>
  /** Rare on-request proof photo. */
  onRequestPhoto?: (officer: FleetOfficer, reason: string) => void | Promise<void>
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
  onClose,
  schoolOptions = [],
  onChangeSchool,
  onRequestPhoto,
}: MobileOfficerSheetProps) {
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false)
  const [pickerCenterId, setPickerCenterId] = useState('')
  const [proofReason, setProofReason] = useState<string>(PROOF_REQUEST_REASONS[0])
  const [busy, setBusy] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const proofPhoto = useOfficerPhotoProof(officer.id)

  useEffect(() => {
    setSchoolPickerOpen(false)
    setPickerCenterId('')
    setProofReason(PROOF_REQUEST_REASONS[0])
    setBusy(false)
    setPhotoFailed(false)
  }, [officer.id])

  const isSos = officer.status === 'SOS'
  const isOnSite = officer.status === 'ON_SITE'
  const arrivalConfirmed = officerArrivalConfirmed(officer)
  const photoUrl = proofPhoto.url || ''
  const photoTimeLabel = proofPhoto.meta?.createdAt
    ? new Date(proofPhoto.meta.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Accra',
      }) + ' GMT'
    : null

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

  const normSchool = (v?: string | null) => (v || '').trim().toLowerCase()
  const plannedMismatch = Boolean(
    officer.plannedSchool &&
      officer.arrivalSchool &&
      normSchool(officer.plannedSchool) !== normSchool(officer.arrivalSchool)
  )

  const lastPingIso = officer.lastPingAt
  const isStale = (() => {
    if (!lastPingIso) return false
    const ts = Date.parse(lastPingIso)
    return !Number.isNaN(ts) && Date.now() - ts > 5 * 60 * 1000
  })()
  const lastPingGmt = lastPingIso
    ? new Date(lastPingIso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
    : null
  const lastSeen = lastPingIso ? `${formatRelativeTime(lastPingIso)} · ${lastPingGmt}` : 'Never pinged'

  const unitCode = getOfficerUnitCode(officer)
  const checkpoints = officer.checkpoints || []

  const cycleSnap = () =>
    onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')

  const stepDown = () =>
    onSnapChange(snap === 'full' ? 'half' : 'peek')

  // Height as a share of the container (never the viewport) — on short
  // screens the grabber + close buttons must never be clipped off-screen.
  const snapHeight =
    snap === 'peek' ? 'h-[248px] max-h-full' : snap === 'half' ? 'h-[54%] max-h-full' : 'h-[88%] max-h-full'

  const statusNode = isSos
    ? { label: 'CRITICAL', cls: 'border-status-sos/40 bg-status-sos/10 text-status-sos', dot: 'bg-status-sos' }
    : isOnSite
    ? { label: 'On site', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' }
    : { label: 'Waiting', cls: 'border-slate-600/50 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' }

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
        Last seen {formatRelativeTime(lastPingIso)}
      </span>
    </div>
  )

  const lifecycleLine = (officer.todayArrival || officer.todayDeparture) ? (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-snug text-slate-400 px-0.5 -mt-1">
      {officer.todayArrival && (
        <span className={`inline-flex items-center gap-1.5 font-semibold ${
          arrivalConfirmed ? 'text-emerald-400' : 'text-amber-300'
        }`}>
          <span className={`size-1.5 rounded-full ${
            arrivalConfirmed ? 'bg-emerald-400' : 'bg-amber-400'
          }`} />
          {arrivalConfirmed
            ? `Arrived ${timeOfDay(officer.todayArrival.at)} · confirmed`
            : `Arrived ${timeOfDay(officer.todayArrival.at)} (not signed in)`}
        </span>
      )}
      {officer.todayDeparture && (
        <span className={`inline-flex items-center gap-1.5 font-semibold ${
          officer.todayDeparture.duringPaper ? 'text-rose-400' : 'text-slate-400'
        }`}>
          <span className={`size-1.5 rounded-full ${
            officer.todayDeparture.duringPaper ? 'bg-rose-400' : 'bg-slate-500'
          }`} />
          Left {timeOfDay(officer.todayDeparture.at)}{officer.todayDeparture.duringPaper ? ' (early)' : ''}
        </span>
      )}
    </div>
  ) : null

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
          <span className="truncate">Planned: {officer.plannedSchool || officer.assignedCenter}</span>
        </div>
        {plannedMismatch && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold leading-snug text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0 mt-px" />
            <span>
              Arrived at {officer.arrivalSchool} instead of {officer.plannedSchool}
            </span>
          </p>
        )}
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
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col lg:hidden rounded-t-3xl border-t border-[#22263C] bg-[#0C0F17] shadow-[0_-10px_40px_rgba(0,0,0,0.55)] transition-[height] duration-300 ${snapHeight}`}
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
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {snap !== 'peek' && (
            <button
              type="button"
              onClick={stepDown}
              aria-label="Collapse panel"
              className="size-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <ChevronDown className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="size-9 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {snap === 'peek' && (
        <div className="px-4 pb-4 flex flex-col gap-2.5 shrink-0">
          {identityHeader}
          {chipsRow}
          {lifecycleLine}
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
          {lifecycleLine}
          {telemetryTiles}
        </div>
      )}

      {snap === 'full' && (
        <>
          <div className="px-4 pb-3 flex flex-col gap-2.5 flex-1 overflow-y-auto">
            {identityHeader}
            {chipsRow}
            {lifecycleLine}
            {telemetryTiles}

            {/* Watermarked proof — pinned to the photo that answered an ask */}
            {onRequestPhoto || photoUrl || proofPhoto.meta ? (
              <div className="rounded-xl border border-[#22263C] bg-[#11131F] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-wider text-slate-500">
                    <Camera className="size-3.5 text-slate-500" />
                    Photo proof
                  </span>
                  {photoTimeLabel && (
                    <span className="text-[10px] text-slate-500 tabular-nums">{photoTimeLabel}</span>
                  )}
                </div>
                {photoUrl && !photoFailed ? (
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block overflow-hidden rounded-xl border border-[#22263C] bg-[#0A0D17]"
                  >
                    <img
                      src={photoUrl}
                      alt={`Watermarked evidence from ${officer.name}`}
                      loading="lazy"
                      onError={() => setPhotoFailed(true)}
                      className="h-32 w-full object-cover"
                    />
                    <span className="block px-3 py-2 text-center text-[11px] font-semibold text-sky-300">
                      Open full photo
                    </span>
                  </a>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-[#2A3048] bg-[#0A0D17]/60 px-4 py-4 text-center">
                    <Camera className="size-5 text-slate-600 mx-auto mb-1" />
                    <p className="text-[11px] font-medium text-slate-400">No photo proof yet</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                      Appears after the officer takes one at the school
                    </p>
                  </div>
                )}
                {proofPhoto.meta?.watermark && (
                  <p className="mt-1.5 text-[10px] leading-snug text-slate-500 line-clamp-2">
                    {proofPhoto.meta.watermark}
                  </p>
                )}
              </div>
            ) : null}

            {/* Centre correction + rare proof request */}
            {(schoolOptions.length > 0 && onChangeSchool) || onRequestPhoto ? (
              <div className="rounded-xl border border-[#22263C] bg-[#11131F] p-3 space-y-2.5">
                <span className="block text-[10px] font-sans uppercase tracking-wider text-slate-500">
                  Fix today&apos;s duty
                </span>
                {schoolOptions.length > 0 && onChangeSchool && (
                  <>
                    {!schoolPickerOpen ? (
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
                        className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#2A3048] bg-[#0A0D17] text-[11px] font-bold text-slate-200 hover:text-white hover:border-slate-600 transition cursor-pointer"
                      >
                        <Pencil className="size-3.5" />
                        Change today&apos;s school
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={pickerCenterId}
                          onChange={(e) => setPickerCenterId(e.target.value)}
                          aria-label="Choose today's school"
                          className="flex-1 min-w-0 h-11 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2.5 text-xs text-slate-200"
                        >
                          {schoolOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy || !pickerCenterId}
                          onClick={async () => {
                            if (!pickerCenterId || !onChangeSchool) return
                            setBusy(true)
                            try {
                              await onChangeSchool(officer, pickerCenterId)
                              setSchoolPickerOpen(false)
                            } finally {
                              setBusy(false)
                            }
                          }}
                          className="h-11 shrink-0 rounded-lg bg-[#1E2B7B] px-3 text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchoolPickerOpen(false)}
                          className="h-11 shrink-0 rounded-lg border border-[#2A3048] px-3 text-[11px] font-bold text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
                {onRequestPhoto && (
                  <div className="flex items-center gap-2 border-t border-[#1E2438] pt-2.5">
                    <select
                      value={proofReason}
                      onChange={(e) => setProofReason(e.target.value)}
                      aria-label="Why a photo is needed"
                      className="flex-1 min-w-0 h-11 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2.5 text-[11px] text-slate-300 cursor-pointer"
                    >
                      {PROOF_REQUEST_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await onRequestPhoto(officer, proofReason)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="h-11 shrink-0 flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-[11px] font-bold text-sky-200 cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="size-3.5" />
                      Ask
                    </button>
                  </div>
                )}
              </div>
            ) : null}

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
                        {cp.iso ? `${formatRelativeTime(cp.iso)} · ` : ''}
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

