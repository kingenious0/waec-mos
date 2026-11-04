'use client'

import React from 'react'
import { Camera } from 'lucide-react'

interface ReportButtonProps {
  onOpenReport: () => void
}

export function ReportButton({ onOpenReport }: ReportButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpenReport}
      aria-label="Report an incident or irregularity"
      className="flex-1 h-[52px] rounded-xl border border-[#1E273F] bg-[#101422] hover:bg-[#171E32] text-slate-200 font-semibold text-xs sm:text-sm px-4 flex items-center justify-center gap-2 transition cursor-pointer select-none shadow-sm active:scale-[0.99]"
    >
      <Camera className="size-4 text-slate-300" />
      <span>Report</span>
    </button>
  )
}
