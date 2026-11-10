'use client'

import React from 'react'
import {
  Compass,
  Laptop,
  Building2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
} from 'lucide-react'

interface AdminSidebarProps {
  activeTab: 'map' | 'directory' | 'centers' | 'incidents' | 'settings'
  onSelectTab: (tab: 'map' | 'directory' | 'centers' | 'incidents' | 'settings') => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  sosCount: number
  adminName?: string
  adminPhoto?: string
  onOpenProfile?: () => void
  onSignOut?: () => void
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  sosCount,
  adminName = 'Regional Command',
  adminPhoto,
  onOpenProfile,
  onSignOut,
}: AdminSidebarProps) {
  const initials =
    adminName
      .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HQ'

  const navItems = [
    {
      id: 'map' as const,
      label: 'Live Fleet Map',
      icon: Compass,
    },
    {
      id: 'directory' as const,
      label: 'Monitor Directory',
      icon: Laptop,
    },
    {
      id: 'centers' as const,
      label: 'Exam Centers',
      icon: Building2,
    },
    {
      id: 'incidents' as const,
      label: 'Incident Logs',
      icon: AlertTriangle,
      badge: sosCount > 0 ? sosCount : undefined,
    },
  ]

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-border bg-[#0B0D14] select-none transition-all duration-200 z-20 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-14 border-b border-border/80 px-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="size-7 rounded-full bg-brand flex items-center justify-center text-background font-bold shrink-0 shadow-xs">
            <span className="text-xs tracking-tighter">M</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-wider text-foreground truncate">
                M.O.S ADMIN
              </span>
              <span className="text-[10px] font-sans tracking-wider text-muted-foreground truncate uppercase">
                MONITORING SYSTEM
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 py-4 px-2.5 space-y-4">
        {!isCollapsed && (
          <div className="px-2 text-[10px] font-sans font-semibold tracking-wider text-muted-foreground uppercase">
            MAIN NAVIGATION
          </div>
        )}

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer relative ${
                  isActive
                    ? 'bg-brand/10 text-brand border border-brand/25 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? 'text-brand' : ''}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}

                {item.badge !== undefined && (
                  <span
                    className={`size-2 rounded-full bg-status-sos shrink-0 ${
                      isCollapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-border/80 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-90 transition cursor-pointer"
          >
            <div className="size-8 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
              {adminPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={adminPhoto} alt={adminName} className="size-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground truncate">
                  {adminName}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-status-ok font-medium">
                  <span className="size-1.5 rounded-full bg-status-ok" />
                  <span>Online</span>
                </div>
              </div>
            )}
          </button>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              title="System Settings"
              aria-label="Settings"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-brand/20 text-brand ring-1 ring-brand/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Settings className="size-3.5" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            title="System Settings"
            aria-label="Settings"
            className={`w-full flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-brand/20 text-brand ring-1 ring-brand/40'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Settings className="size-4" />
          </button>
        )}

        {onSignOut &&
          (isCollapsed ? (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="w-full flex items-center justify-center p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out / Switch Account"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          ))}
      </div>
    </aside>
  )
}
