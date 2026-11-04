'use client'

import React, { useState } from 'react'
import { ArrowRight, Check, AlertCircle } from 'lucide-react'

interface CheckInButtonProps {
  isInside: boolean
  distanceMeters: number
  geofenceRadius?: number
  isCheckedIn: boolean
  onCheckIn: () => void
  onCheckOut?: () => void
}

export function CheckInButton({
  isInside,
  distanceMeters,
  geofenceRadius = 150,
  isCheckedIn,
  onCheckIn,
  onCheckOut,
}: CheckInButtonProps) {
  const [confirmingCheckout, setConfirmingCheckout] = useState(false)
  const excessDistance = Math.max(0, distanceMeters - geofenceRadius)

  if (isCheckedIn) {
    if (confirmingCheckout) {
      return (
        <div className="w-full flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmingCheckout(false)
              onCheckOut?.()
            }}
            className="flex-1 h-[60px] rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-lg transition cursor-pointer select-none"
          >
            <AlertCircle className="size-4" />
            <span>Confirm End Shift</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingCheckout(false)}
            className="px-4 h-[60px] rounded-xl font-semibold text-xs tracking-wide bg-[#12192A] hover:bg-[#1C2640] border border-[#23335A] text-slate-300 transition cursor-pointer select-none"
          >
            Cancel
          </button>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => setConfirmingCheckout(true)}
        className="w-full h-[60px] rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 bg-[#12192A] hover:bg-[#18223B] border border-emerald-500/30 text-emerald-400 transition cursor-pointer select-none shadow-md"
      >
        <Check className="size-5 text-emerald-400" />
        <span>Duty active · Tap to conclude shift</span>
      </button>
    )
  }

  if (!isInside) {
    return (
      <button
        type="button"
        aria-disabled="true"
        onClick={() => {}}
        className="w-full h-[60px] rounded-xl font-semibold text-sm tracking-wide flex items-center justify-center gap-2 border border-dashed border-[#283556] bg-[#0D111D]/80 text-slate-400 cursor-not-allowed select-none transition"
      >
        <span>Check in opens {excessDistance} m closer</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onCheckIn}
      className="w-full h-[60px] rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 bg-[#3B57F0] hover:bg-[#314BD6] active:scale-[0.99] text-white shadow-lg shadow-[#3B57F0]/30 transition cursor-pointer select-none"
    >
      <span>Check in</span>
      <ArrowRight className="size-4" />
    </button>
  )
}
