'use client'

import React from 'react'

export interface PaperAssignment {
  title: string
  timeRange: string
  arriveBy: string
  collectBy: string
}

interface PaperTilesProps {
  assignment?: PaperAssignment | null
}

const DEFAULT_PAPER: PaperAssignment = {
  title: 'Core Mathematics 1 and 2',
  timeRange: '08:30 to 12:00 GMT',
  arriveBy: '08:00',
  collectBy: 'Collect at 07:45',
}

export function PaperTiles({ assignment = DEFAULT_PAPER }: PaperTilesProps) {
  if (!assignment) {
    return (
      <div className="w-full rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 text-center text-xs text-slate-400 select-none">
        No active exam papers assigned for today.
      </div>
    )
  }

  return (
    <div className="w-full grid grid-cols-2 gap-3 select-none font-sans">
      {/* Tile 1: Today's Paper */}
      <div className="rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          Today's Paper
        </span>
        <div className="mt-1.5">
          <h4 className="text-xs font-bold text-white leading-snug">
            {assignment.title}
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            {assignment.timeRange}
          </p>
        </div>
      </div>

      {/* Tile 2: Arrive By */}
      <div className="rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 flex flex-col justify-between shadow-sm">
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          Arrive By
        </span>
        <div className="mt-1.5">
          <div className="text-base font-bold text-emerald-400 tabular-nums leading-none">
            {assignment.arriveBy}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            {assignment.collectBy}
          </p>
        </div>
      </div>
    </div>
  )
}
