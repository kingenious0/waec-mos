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

export function PaperTiles({ assignment }: PaperTilesProps) {
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
        <span className="text-xs font-medium text-slate-400">Today's Paper</span>
        <div className="mt-1.5">
          <h4 className="text-sm font-semibold text-white leading-snug">{assignment.title}</h4>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">{assignment.timeRange}</p>
        </div>
      </div>

      {/* Tile 2: Arrive By */}
      <div className="rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 flex flex-col justify-between shadow-sm">
        <span className="text-xs font-medium text-slate-400">Arrive By</span>
        <div className="mt-1.5">
          <div className="text-base font-semibold text-emerald-400 tabular-nums leading-none">
            {assignment.arriveBy}
          </div>
          <p className="text-xs text-slate-400 mt-1 tabular-nums">{assignment.collectBy}</p>
        </div>
      </div>
    </div>
  )
}
