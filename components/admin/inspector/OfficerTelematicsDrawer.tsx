'use client'

import React from 'react'
import {
  Radio,
  Clock,
  Flag,
  Phone,
  Shield,
  Battery,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import type { FleetOfficer } from '@/components/admin/FleetMap'

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
  isMobileDrawerExpanded = false,
  onToggleMobileDrawer,
  onClose,
}: OfficerTelematicsDrawerProps) {
  if (!officer) return null

  // Extract short unit code, e.g. "off-1" -> "01", "off-4" -> "04"
  const unitNumber = officer.id.replace('off-', '').padStart(2, '0')
  const isSos = officer.status === 'SOS'
  const isOnSite = officer.status === 'ON_SITE'

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
        {/* --- Top Officer Header Card --- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Unit Badge (04 / U-04) */}
            <div className="relative">
              <div
                className={`size-12 rounded-xl flex items-center justify-center font-sans font-bold text-base border ${
                  isSos
                    ? 'bg-status-sos/15 text-status-sos border-status-sos/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                }`}
              >
                {unitNumber}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#0C0F17] ${
                  isSos
                    ? 'bg-status-sos animate-ping'
                    : isOnSite
                    ? 'bg-status-ok'
                    : 'bg-amber-400'
                }`}
              />
            </div>

            {/* Officer Name & Assigned Center */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  {officer.name}
                </span>
                {officer.isLeader && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    LEAD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="truncate max-w-[150px]">
                  {officer.assignedCenter.split(' School')[0].split(' College')[0]}
                </span>
                <span>•</span>
                <span
                  className={
                    isSos
                      ? 'text-status-sos font-semibold'
                      : isOnSite
                      ? 'text-status-ok'
                      : 'text-amber-400'
                  }
                >
                  {isSos ? 'SOS Alert' : isOnSite ? 'On Site' : 'In Transit'}
                </span>
              </div>
            </div>
          </div>

          {/* Priority / Status tag & Close Button */}
          <div className="flex items-start gap-2.5 shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block">
                STATUS
              </span>
              <span
                className={`text-xs font-sans font-bold ${
                  isSos ? 'text-status-sos' : 'text-sky-400'
                }`}
              >
                {isSos ? 'CRITICAL' : 'On Track'}
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

        {/* --- 4-Stat Telematics Grid --- */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
          {/* Speed */}
          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              SPEED
            </span>
            <span className="text-base font-semibold font-sans text-foreground mt-0.5">
              {isOnSite ? '0' : '42'}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans">km/h</span>
          </div>

          {/* ETA */}
          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              ETA
            </span>
            <span className="text-base font-semibold font-sans text-amber-400 mt-0.5">
              {isOnSite ? 'ARR' : '06'}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans">
              {isOnSite ? 'Site' : 'min'}
            </span>
          </div>

          {/* Payload Lock Status */}
          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              EXAM PAPERS
            </span>
            <span className="text-base font-semibold font-sans text-foreground mt-0.5">
              #{unitNumber}
            </span>
            <span className="text-[10px] text-status-ok font-medium">Secured</span>
          </div>

          {/* Power / Battery */}
          <div className="flex flex-col">
            <span className="text-[10px] font-sans text-muted-foreground tracking-wider uppercase">
              BATTERY
            </span>
            <span
              className={`text-base font-semibold font-sans mt-0.5 ${
                officer.battery <= 20
                  ? 'text-status-sos'
                  : officer.battery <= 50
                  ? 'text-amber-400'
                  : 'text-status-ok'
              }`}
            >
              {officer.battery}%
            </span>
            <span className="text-[10px] text-status-ok font-medium">Good</span>
          </div>
        </div>

        {/* --- Destination & Progress Bar Card --- */}
        <div className="rounded-xl bg-[#111522] border border-border/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Flag className="size-3.5 text-sky-400" />
              <span className="truncate">{officer.assignedCenter}</span>
            </div>
            <span className="font-sans font-semibold text-sky-400">
              {isOnSite ? '100%' : '72%'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-sky-500 rounded-full transition-all duration-300"
              style={{ width: isOnSite ? '100%' : '72%' }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground">
            <span>{isOnSite ? 'Stationed at Center' : 'Departed Depository'}</span>
            <span className="text-foreground">
              {isOnSite ? 'Within Perimeter' : '3.4 / 4.7 km'}
            </span>
          </div>
        </div>

        {/* --- Waypoints List (Visible on desktop or when expanded on mobile) --- */}
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground block">
            CHECKPOINTS
          </span>

          <div className="space-y-2.5 text-xs font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-status-ok" />
                <span>HQ Vault Departure</span>
              </div>
              <span className="text-muted-foreground">08:15 GMT</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <span className="size-1.5 rounded-full bg-amber-400" />
                <span>Sector B4 (In Transit)</span>
              </div>
              <span className="text-amber-400">08:48 GMT</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                <span>Exam Center 07 Arrival</span>
              </div>
              <span className="text-muted-foreground/60">08:54 GMT</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Action Buttons (Fixed at bottom of Drawer) --- */}
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
