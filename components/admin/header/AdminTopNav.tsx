'use client'

import React, { useState } from 'react'
import { Menu, Bell, Search, User, LogOut } from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'
import {
  NotificationsPopover,
  type NotificationItem,
} from '@/components/admin/notifications/NotificationsPopover'

interface AdminTopNavProps {
  activeCount: number
  activeTabTitle: string
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleMobileMenu?: () => void
  onOpenProfile?: () => void
  onSignOut?: () => void
  onFocusOfficer?: (officerId?: string) => void
  onFocusSos?: () => void
  onCallEmergency?: () => void
  onOpenIncidents?: () => void
  onOpenSettings?: () => void
  session?: SessionData | null
  notifications?: NotificationItem[]
  notificationsLoading?: boolean
  onMarkAllRead?: () => Promise<void> | void
  unreadAlertsCount?: number
}

export function AdminTopNav({
  activeCount,
  activeTabTitle,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onOpenProfile,
  onSignOut,
  onFocusOfficer,
  onFocusSos,
  onCallEmergency,
  onOpenIncidents,
  onOpenSettings,
  session,
  notifications = [],
  notificationsLoading = false,
  onMarkAllRead,
  unreadAlertsCount = 0,
}: AdminTopNavProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const displayName = session?.name || 'Regional Command'
  const initials =
    displayName
      .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HQ'

  return (
    <header className="h-14 border-b border-border bg-[#0B0D14] px-4 flex items-center justify-between shrink-0 select-none z-20 relative">
      {/* MOBILE HEADER VIEW (< 1024px) */}
      <div className="flex lg:hidden items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Open navigation menu"
            className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 cursor-pointer"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-foreground">
              M.O.S ADMIN
            </span>
            <span className="text-[10px] font-sans font-medium tracking-wider text-sky-400 uppercase">
              {activeTabTitle.toUpperCase()}
            </span>
          </div>

          <div className="ml-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-ok/10 border border-status-ok/25 text-[11px] font-medium text-status-ok">
            <span className="size-1.5 rounded-full bg-status-ok animate-pulse" />
            <span>{activeCount} Active</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-bell-trigger="true"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Alerts"
            className={`relative p-2 rounded-full cursor-pointer transition-colors ${
              isNotificationsOpen
                ? 'bg-muted/80 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Bell className="size-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Profile"
            className="size-8 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs hover:border-sky-400 transition-colors cursor-pointer overflow-hidden"
          >
            {session?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photo} alt={displayName} className="size-full object-cover" />
            ) : (
              <User className="size-4" />
            )}
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign Out"
              title="Sign Out / Switch Account"
              className="p-2 text-red-400 hover:text-red-300 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* DESKTOP HEADER VIEW (>= 1024px) */}
      <div className="hidden lg:flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            {activeTabTitle}
          </h1>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-ok/10 border border-status-ok/25 text-xs font-medium text-status-ok">
            <span className="size-1.5 rounded-full bg-status-ok" />
            <span>{activeCount} active officers</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search fleet, zones..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#111420] border border-border/80 rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-brand/50 transition-colors"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground bg-muted/40 rounded border border-border/40 pointer-events-none">
              /
            </kbd>
          </div>

          <button
            type="button"
            data-bell-trigger="true"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Alerts"
            className={`relative p-2 rounded-lg cursor-pointer transition-colors ${
              isNotificationsOpen
                ? 'bg-muted/80 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Bell className="size-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            title={displayName}
            className="size-8 rounded-full bg-[#1A233A] text-sky-400 border border-sky-500/25 flex items-center justify-center font-bold text-xs hover:border-sky-400 transition-colors cursor-pointer overflow-hidden"
          >
            {session?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photo} alt={displayName} className="size-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out / Switch Account"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Notifications Popover */}
      <NotificationsPopover
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        loading={notificationsLoading}
        onMarkAllRead={onMarkAllRead}
        onFocusOfficer={onFocusOfficer}
        onFocusSos={onFocusSos}
        onCallEmergency={onCallEmergency}
        onOpenIncidents={onOpenIncidents}
        onOpenSettings={onOpenSettings}
      />
    </header>
  )
}
