'use client'

import React, { useState } from 'react'
import { MoreVertical, MapPin, Pencil, Trash2 } from 'lucide-react'
import type { ExamCenter } from '@/components/admin/FleetMap'

interface MobileCenterCardProps {
  index: number
  center: ExamCenter
  onFocus: (center: ExamCenter) => void
  onEdit: (center: ExamCenter) => void
  onDelete: (center: ExamCenter) => void
}

/**
 * Compact examination-centre card for the mobile Centres tab:
 * index tile, name + code/district, active/alert tag, a three-stat
 * row (Officers / Perimeter / Alerts), one primary action and a ⋯ menu.
 */
export function MobileCenterCard({
  index,
  center,
  onFocus,
  onEdit,
  onDelete,
}: MobileCenterCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const openIncidents = center.openIncidentsCount || 0
  const district = center.districtName || ''
  const radius =
    typeof center.radius === 'number' && Number.isFinite(center.radius)
      ? Math.round(center.radius)
      : 150

  return (
    <div className="relative rounded-2xl border border-[#22263C] bg-[#0E111D] p-4 space-y-3.5">
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-xl bg-[#1E2B7B] border border-white/10 flex items-center justify-center text-lg font-extrabold tabular-nums text-white">
          {String(index).padStart(2, '0')}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 min-w-0">
              {center.name}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                openIncidents > 0
                  ? 'border-status-sos/40 bg-status-sos/10 text-status-sos'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  openIncidents > 0 ? 'bg-status-sos' : 'bg-emerald-400'
                }`}
              />
              {openIncidents > 0 ? 'Alert' : 'Active'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 tabular-nums truncate">
            {center.code}
            {district ? ` · ${district}` : ''}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[#1E243A] border-y border-[#1E243A] py-2.5">
        <div className="px-1 flex flex-col items-center">
          <span className="text-[9px] font-sans uppercase tracking-wider text-slate-500">
            Officers
          </span>
          <span className="text-sm font-bold text-white tabular-nums mt-0.5">
            {center.onSiteMonitors || 0}/{center.totalMonitors}
          </span>
        </div>
        <div className="px-1 flex flex-col items-center">
          <span className="text-[9px] font-sans uppercase tracking-wider text-slate-500">
            Perimeter
          </span>
          <span className="text-sm font-bold text-white tabular-nums mt-0.5">{radius} m</span>
        </div>
        <div className="px-1 flex flex-col items-center">
          <span className="text-[9px] font-sans uppercase tracking-wider text-slate-500">
            Alerts
          </span>
          <span
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              openIncidents > 0 ? 'text-status-sos' : 'text-emerald-400'
            }`}
          >
            {openIncidents > 0 ? openIncidents : 'None'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onFocus(center)}
          className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl border border-[#22263C] bg-[#11131F] hover:bg-[#181D2E] hover:text-white text-slate-200 text-xs font-bold transition cursor-pointer"
        >
          <MapPin className="size-4 shrink-0" />
          Focus on map
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Centre actions"
          aria-expanded={menuOpen}
          className="size-12 shrink-0 flex items-center justify-center rounded-2xl border border-[#22263C] bg-[#11131F] hover:bg-[#181D2E] text-slate-400 hover:text-white transition cursor-pointer"
        >
          <MoreVertical className="size-5" />
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-3 bottom-16 z-40 w-48 overflow-hidden rounded-2xl border border-[#22263C] bg-[#121629] shadow-2xl py-1.5">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onEdit(center)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
            >
              <Pencil className="size-4 shrink-0 text-slate-400" />
              Edit boundary
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onDelete(center)
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
