'use client'

import React from 'react'
import { LogOut } from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'

interface FieldHeaderProps {
  session: SessionData | null
  zoneName?: string
  batteryLevel?: number | null
  isGpsActive?: boolean
  onOpenProfile: () => void
  onLogout: () => void
}

export function FieldHeader({
  session,
  zoneName = 'Ashanti Examination Zone',
  batteryLevel = null,
  isGpsActive = true,
  onOpenProfile,
  onLogout,
}: FieldHeaderProps) {
  const officerName = session?.name || 'Field Officer'
  const groupLabel = session?.group
    ? session.isGroupLeader
      ? `${session.group} Leader`
      : session.group
    : 'Field Officer'
  const staffId = session?.staffId || ''

  const initials = officerName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const batteryDisplay = typeof batteryLevel === 'number' ? `${batteryLevel}%` : '--%'
  const isLowBattery = typeof batteryLevel === 'number' && batteryLevel < 25

  return (
    <header className="w-full shrink-0 z-30 px-4 py-3 bg-[#0A0D18]/95 border-b border-[#1A2035] flex items-center justify-between font-sans select-none">
      {/* --- MOBILE HEADER (< 1024px) --- */}
      <div className="flex lg:hidden items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#F6D300] flex items-center justify-center font-bold text-black text-base shadow-sm shrink-0">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight leading-snug">
              {officerName}
            </span>
            <span className="text-xs text-slate-400 font-medium leading-none mt-0.5">
              {groupLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs tabular-nums border ${
              isLowBattery
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-[#12192A] border-[#1E2942] text-slate-200'
            }`}
          >
            <span className={`size-2 rounded-full ${isGpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="font-medium">
              GPS · {batteryDisplay}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`View profile for ${officerName}`}
            aria-label="Officer Profile"
            className="size-10 rounded-full bg-[#1E294B] text-sky-300 font-bold text-xs flex items-center justify-center border border-sky-400/25 hover:border-sky-400 transition cursor-pointer overflow-hidden"
          >
            {session?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photo} alt={officerName} className="size-full object-cover" />
            ) : (
              initials || 'FO'
            )}
          </button>
        </div>
      </div>

      {/* --- DESKTOP HEADER (>= 1024px) --- */}
      <div className="hidden lg:flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#F6D300] flex items-center justify-center font-bold text-black text-base shadow-sm shrink-0">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight">
              WAEC MOS Field
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {zoneName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12192A] border border-[#1E2942] text-xs text-slate-200">
            <span className={`size-2 rounded-full ${isGpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="font-medium">{isGpsActive ? 'GPS active' : 'GPS offline'}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs tabular-nums border ${
              isLowBattery
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-[#12192A] border-[#1E2942] text-slate-200'
            }`}
          >
            <span className="font-medium">Battery {batteryDisplay}</span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-white">
              {officerName}
            </span>
            <span className="text-[11px] text-slate-400">
              {staffId ? `${staffId} · ` : ''}{groupLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`View profile for ${officerName}`}
            aria-label="Officer Profile"
            className="size-10 rounded-full bg-[#1E294B] text-sky-300 font-bold text-xs flex items-center justify-center border border-sky-400/25 hover:border-sky-400 transition cursor-pointer overflow-hidden"
          >
            {session?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photo} alt={officerName} className="size-full object-cover" />
            ) : (
              initials || 'FO'
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Sign out of field session"
            aria-label="Sign Out"
            className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition cursor-pointer ml-1"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
