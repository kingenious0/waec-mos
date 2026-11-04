'use client'

import React from 'react'
import { WifiOff, AlertCircle } from 'lucide-react'

interface OfflineBannerProps {
  isOffline: boolean
  queuedCount?: number
}

export function OfflineBanner({ isOffline, queuedCount = 0 }: OfflineBannerProps) {
  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 select-none animate-in fade-in"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="size-4 text-amber-400 shrink-0" />
        <span className="font-medium">
          Offline Mode — Live updates paused.
        </span>
      </div>
      {queuedCount > 0 && (
        <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
          {queuedCount} queued action{queuedCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
