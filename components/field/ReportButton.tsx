'use client'

import React from 'react'
import { ClipboardList } from 'lucide-react'

interface ReportButtonProps {
  onOpenReport: () => void
  /**
   * Height class. Defaults to the desktop dock size; the mobile dock passes a
   * taller value so it lines up with the primary action. Passed explicitly
   * (not appended) because two conflicting Tailwind height utilities are
   * resolved by stylesheet order, not class order.
   */
  heightClass?: string
}

export function ReportButton({ onOpenReport, heightClass = 'h-[52px]' }: ReportButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpenReport}
      aria-label="Report an incident or irregularity"
      className={`flex-1 ${heightClass} rounded-xl border border-[#1E273F] bg-[#101422] hover:bg-[#171E32] text-slate-200 font-semibold text-xs sm:text-sm px-4 flex items-center justify-center gap-2 transition cursor-pointer select-none shadow-sm active:scale-[0.99]`}
    >
      <ClipboardList className="size-4 text-slate-300" />
      <span>Report</span>
    </button>
  )
}
