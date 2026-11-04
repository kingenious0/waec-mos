'use client'

import React from 'react'

interface VenueCardProps {
  venueName: string
  venueCode?: string
  zoneName?: string
  regionName?: string
}

export function VenueCard({
  venueName,
  venueCode = '050102',
  zoneName = 'Kumasi Central Examination Zone',
  regionName = 'Ashanti Region',
}: VenueCardProps) {
  return (
    <div className="w-full rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 text-zinc-100 shadow-md select-none font-sans">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Assigned Venue
        </span>
        {venueCode && (
          <span className="text-[10px] font-semibold text-[#F6D300] bg-[#1A2035] px-2 py-0.5 rounded-md border border-[#27324E] tabular-nums">
            {venueCode}
          </span>
        )}
      </div>

      <h3 className="text-sm font-bold text-white mt-1 leading-snug">
        {venueName}
      </h3>

      <p className="text-xs text-slate-400 mt-0.5 leading-normal">
        {zoneName} · {regionName}
      </p>
    </div>
  )
}
