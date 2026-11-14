'use client'

import React from 'react'
import {
  Map,
  Users,
  Building2,
  AlertTriangle,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: 'map' | 'directory' | 'centers' | 'incidents' | 'settings' | 'safety' | 'timetable'
  onSelectTab: (tab: 'map' | 'directory' | 'centers' | 'incidents' | 'settings' | 'safety' | 'timetable') => void
  sosCount: number
}

/**
 * Shared 76px bottom tab bar — same on every admin screen (< lg).
 * Four tabs; active tab gets a soft primary pill behind the icon.
 * Includes the iOS safe-area inset.
 */
export function MobileBottomNav({
  activeTab,
  onSelectTab,
  sosCount,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'map' as const,
      label: 'Live map',
      icon: Map,
    },
    {
      id: 'directory' as const,
      label: 'Directory',
      icon: Users,
    },
    {
      id: 'centers' as const,
      label: 'Centres',
      icon: Building2,
    },
    {
      id: 'incidents' as const,
      label: 'Incidents',
      icon: AlertTriangle,
      badge: sosCount > 0 ? sosCount : undefined,
    },
    {
      id: 'timetable' as const,
      label: 'Timetable',
      icon: CalendarDays,
    },
    {
      id: 'safety' as const,
      label: 'Safety',
      icon: ShieldCheck,
    },
  ]

  return (
    <nav
      aria-label="Admin sections"
      className="lg:hidden shrink-0 z-30 border-t border-[#22263C] bg-[#0B0D14] grid grid-cols-6 select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] min-h-[76px] transition-colors cursor-pointer"
          >
            <span
              className={`relative flex items-center justify-center rounded-full px-5 py-1 transition-colors ${
                isActive ? 'bg-indigo-500/15' : ''
              }`}
            >
              <Icon
                className={`size-5.5 ${isActive ? 'text-indigo-300' : 'text-slate-500'}`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              {tab.badge !== undefined && (
                <span className="absolute top-0 right-1 size-2.5 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
              )}
            </span>
            <span
              className={`text-[11px] tracking-tight ${
                isActive ? 'text-indigo-300 font-semibold' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
