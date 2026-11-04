'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface TimelineItem {
  time: string
  label: string
  isHighlight?: boolean
}

interface DayTimelineProps {
  items?: TimelineItem[]
  collapsible?: boolean
  defaultOpen?: boolean
}

const DEFAULT_TIMELINE: TimelineItem[] = [
  { time: '07:45', label: 'Collect papers', isHighlight: false },
  { time: '08:00', label: 'Check in deadline', isHighlight: true },
  { time: '08:30', label: 'Core Mathematics 1 and 2 begins', isHighlight: false },
  { time: '12:00', label: 'Paper ends', isHighlight: false },
]

export function DayTimeline({ items = DEFAULT_TIMELINE, collapsible = false, defaultOpen = false }: DayTimelineProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!items || items.length === 0) return null

  return (
    <div className="w-full rounded-2xl bg-[#0F121E] border border-[#1C2337] p-4 select-none font-sans shadow-md">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-400 tracking-wider uppercase cursor-pointer"
        >
          <span>Today&apos;s Schedule</span>
          {isOpen ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />}
        </button>
      ) : (
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block mb-3">
          Today
        </span>
      )}

      {(!collapsible || isOpen) && (
        <div className={`space-y-3 ${collapsible ? 'pt-3' : ''}`}>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 text-xs">
              {item.isHighlight ? (
                <span className="size-2 rounded-full bg-[#F6D300] shrink-0" />
              ) : (
                <span className="size-2 rounded-full border border-slate-500 shrink-0" />
              )}
              <span className={`font-semibold tabular-nums w-12 shrink-0 ${item.isHighlight ? 'text-[#F6D300]' : 'text-slate-300'}`}>
                {item.time}
              </span>
              <span className={`leading-tight truncate ${item.isHighlight ? 'text-white font-bold' : 'text-slate-300'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
