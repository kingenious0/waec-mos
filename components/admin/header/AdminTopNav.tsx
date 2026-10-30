'use client'

import React from 'react'
import {
  Menu,
  Bell,
  Search,
  User,
  SlidersHorizontal,
} from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'

interface AdminTopNavProps {
  activeCount: number
  activeTabTitle: string
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleMobileMenu?: () => void
  onOpenProfile?: () => void
  session?: SessionData | null
  unreadAlertsCount?: number
}

export function AdminTopNav({
  activeCount,
  activeTabTitle,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  onOpenProfile,
  session,
  unreadAlertsCount = 1,
}: AdminTopNavProps) {
  return (
    <header className="h-14 border-b border-border bg-[#0B0D14] px-4 flex items-center justify-between shrink-0 select-none z-20">
      {/* --- MOBILE HEADER VIEW (< 1024px) --- */}
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

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Alerts"
            className="relative p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/40 cursor-pointer"
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
            className="size-8 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs hover:border-sky-400 transition-colors cursor-pointer"
          >
            <User className="size-4" />
          </button>
        </div>
      </div>

      {/* --- DESKTOP HEADER VIEW (>= 1024px) --- */}
      <div className="hidden lg:flex items-center justify-between w-full">
        {/* Left: Section Title & Active Units Pill */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            {activeTabTitle}
          </h1>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-ok/10 border border-status-ok/25 text-xs font-medium text-status-ok">
            <span className="size-1.5 rounded-full bg-status-ok" />
            <span>{activeCount} active officers</span>
          </div>
        </div>

        {/* Right: Search Bar, Notifications & User Avatar */}
        <div className="flex items-center gap-3">
          {/* Quick Search */}
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
              ⌘K
            </kbd>
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            aria-label="Alerts"
            className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
          >
            <Bell className="size-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
            )}
          </button>

          {/* User Avatar */}
          <button
            type="button"
            onClick={onOpenProfile}
            title={session?.name || 'Dr. Mensah Osei'}
            className="size-8 rounded-full bg-[#1A233A] text-sky-400 border border-sky-500/25 flex items-center justify-center font-bold text-xs hover:border-sky-400 transition-colors cursor-pointer"
          >
            OP
          </button>
        </div>
      </div>
    </header>
  )
}
