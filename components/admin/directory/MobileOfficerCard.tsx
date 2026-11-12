'use client'

import React, { useState } from 'react'
import {
  MoreVertical,
  Star,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'
import { formatGhanaPhone } from '@/lib/phone'

export interface MobileOfficerCardOfficer {
  id: string
  name: string
  phone: string
  group?: string
  isGroupLeader?: boolean
  status: string
  assignedCenter?: string
}

interface MobileOfficerCardProps {
  officer: MobileOfficerCardOfficer
  onViewProfile: (officer: MobileOfficerCardOfficer) => void
  onResetPin: (officer: MobileOfficerCardOfficer) => void
  onToggleStatus: (officer: MobileOfficerCardOfficer) => void
  onDelete: (officer: MobileOfficerCardOfficer) => void
}

/**
 * Compact officer card for the mobile Monitor Directory (< lg).
 * Avatar, two-line name, formatted phone + group, status/leader/no-centre
 * tags. PIN is never shown — controller resets it via the ⋯ menu.
 */
export function MobileOfficerCard({
  officer,
  onViewProfile,
  onResetPin,
  onToggleStatus,
  onDelete,
}: MobileOfficerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = officer.status === 'ACTIVE'
  const isLeader = Boolean(officer.isGroupLeader)
  const noCentre = !officer.assignedCenter || officer.assignedCenter === 'Unassigned'
  const initials =
    officer.name
      .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  return (
    <div className="relative rounded-2xl border border-[#22263C] bg-[#0E111D] p-4">
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-full bg-[#1E2B7B] border border-white/10 flex items-center justify-center text-sm font-bold text-white">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 min-w-0">
              {officer.name}
            </h3>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Officer actions"
              aria-expanded={menuOpen}
              className="size-11 -mr-2.5 -mt-2 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <MoreVertical className="size-5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-0.5 tabular-nums truncate">
            {formatGhanaPhone(officer.phone)} · {officer.group || 'Group 1'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                isActive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isActive ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              {isActive ? 'Active' : 'Revoked'}
            </span>
            {isLeader && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#22263C] bg-[#121629] px-2 py-0.5 text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                Leader
              </span>
            )}
            {noCentre && (
              <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400 whitespace-nowrap">
                No centre
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Overflow menu */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-3 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-[#22263C] bg-[#121629] shadow-2xl py-1.5">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onViewProfile(officer)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
            >
              <User className="size-4 shrink-0 text-slate-400" />
              Profile &amp; centre
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onResetPin(officer)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
            >
              <KeyRound className="size-4 shrink-0 text-slate-400" />
              Reset PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onToggleStatus(officer)
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {isActive ? (
                <>
                  <ShieldAlert className="size-4 shrink-0" />
                  Revoke access
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4 shrink-0" />
                  Restore access
                </>
              )}
            </button>
            <div className="my-1 border-t border-[#22263C]" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onDelete(officer)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="size-4 shrink-0" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
