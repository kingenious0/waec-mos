'use client'

import React from 'react'
import { Navigation, Battery, User, LogOut } from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'

interface FieldHeaderProps {
  session: SessionData | null
  batteryLevel?: number
  isGpsActive?: boolean
  onOpenProfile: () => void
  onLogout: () => void
}

export function FieldHeader({
  session,
  batteryLevel = 84,
  isGpsActive = true,
  onOpenProfile,
  onLogout,
}: FieldHeaderProps) {
  const officerName = session?.name || 'Kofi Mensah'
  const groupLabel = session?.group ? `${session.group} leader` : 'Group 1 leader'
  const staffId = session?.staffId || 'WAEC-GH-0412'

  const initials = officerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="w-full shrink-0 z-30 px-4 py-3 bg-[#0A0D18]/95 border-b border-[#1A2035] flex items-center justify-between font-sans select-none">
      {/* --- MOBILE HEADER (< 1024px) --- */}
      <div className="flex lg:hidden items-center justify-between w-full">
        {/* Left: Yellow "M" brand mark + Name + Group */}
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

        {/* Right: GPS Pill + Avatar */}
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs tabular-nums border ${
            batteryLevel < 20
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-[#12192A] border-[#1E2942] text-slate-200'
          }`}>
            <span className={`size-2 rounded-full ${isGpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="font-medium">GPS · {batteryLevel}%</span>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`View profile for ${officerName}`}
            aria-label="Officer Profile"
            className="size-10 rounded-full bg-[#1E294B] text-sky-300 font-bold text-xs flex items-center justify-center border border-sky-400/25 hover:border-sky-400 transition cursor-pointer"
          >
            {initials || 'KM'}
          </button>
        </div>
      </div>

      {/* --- DESKTOP HEADER (>= 1024px) --- */}
      <div className="hidden lg:flex items-center justify-between w-full">
        {/* Left: Brand mark + Suite Name + Zone */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#F6D300] flex items-center justify-center font-bold text-black text-base shadow-sm shrink-0">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-tight">
              WAEC MOS Field
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Kumasi Central Zone
            </span>
          </div>
        </div>

        {/* Right: GPS active pill + Battery pill + Name info + Avatar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12192A] border border-[#1E2942] text-xs text-slate-200">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">GPS active</span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs tabular-nums border ${
            batteryLevel < 20
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-[#12192A] border-[#1E2942] text-slate-200'
          }`}>
            <span className="font-medium">Battery {batteryLevel}%</span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-white">
              {officerName}
            </span>
            <span className="text-[11px] text-slate-400">
              {staffId} · {groupLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            title={`View profile for ${officerName}`}
            aria-label="Officer Profile"
            className="size-10 rounded-full bg-[#1E294B] text-sky-300 font-bold text-xs flex items-center justify-center border border-sky-400/25 hover:border-sky-400 transition cursor-pointer"
          >
            {initials || 'KM'}
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
