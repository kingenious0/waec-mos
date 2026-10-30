'use client'

import React from 'react'
import {
  Compass,
  Contact,
  Building2,
  AlertTriangle,
} from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: 'map' | 'directory' | 'centers' | 'incidents'
  onSelectTab: (tab: 'map' | 'directory' | 'centers' | 'incidents') => void
  sosCount: number
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  sosCount,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'map' as const,
      label: 'Live Map',
      icon: Compass,
    },
    {
      id: 'directory' as const,
      label: 'Directory',
      icon: Contact,
    },
    {
      id: 'centers' as const,
      label: 'Centers',
      icon: Building2,
    },
    {
      id: 'incidents' as const,
      label: 'Incidents',
      icon: AlertTriangle,
      badge: sosCount > 0 ? sosCount : undefined,
    },
  ]

  return (
    <nav className="lg:hidden h-14 border-t border-border bg-[#0B0D14] flex items-center justify-around px-2 z-30 shrink-0 select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors relative cursor-pointer ${
              isActive
                ? 'text-sky-400 font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="relative">
              <Icon className="size-5" />
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
              )}
            </div>
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
