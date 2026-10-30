'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AlertTriangle, LogOut, User, Shield } from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'

interface CommandHeaderProps {
  activeSosOfficer?: {
    name: string
    assignedCenter: string
  } | null
  onSosClick?: () => void
  session?: SessionData | null
  onSignOut?: () => void
  onOpenProfile?: () => void
}

export function CommandHeader({
  activeSosOfficer,
  onSosClick,
  session,
  onSignOut,
  onOpenProfile,
}: CommandHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Extract center short name, e.g. "Opoku Ware School Center A" -> "Opoku Ware"
  const centerShortName = activeSosOfficer?.assignedCenter
    ? activeSosOfficer.assignedCenter.replace(/(School|College|Center|\b[A-Z0-9]\b).*$/i, '').trim() ||
      activeSosOfficer.assignedCenter
    : ''

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card/60 backdrop-blur-xs px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Brand mark, Title & Region Hub */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-md bg-brand flex items-center justify-center text-background shadow-xs shrink-0">
          <Shield className="size-4.5 fill-background stroke-background" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            MOS Command
          </span>
          <span className="text-sm text-muted-foreground font-normal">
            Ashanti regional hub
          </span>
        </div>
      </div>

      {/* Centre: Active SOS emergency pill (only when active distress exists) */}
      <div className="flex items-center">
        {activeSosOfficer && (
          <button
            type="button"
            onClick={onSosClick}
            aria-label={`Active SOS alert for ${activeSosOfficer.name}`}
            className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-status-sos/12 border border-status-sos/30 text-status-sos text-xs font-medium hover:bg-status-sos/20 transition-colors cursor-pointer motion-safe:animate-pulse"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>
              SOS · {activeSosOfficer.name} · {centerShortName}
            </span>
          </button>
        )}
      </div>

      {/* Right: Gateway Online status + User Menu */}
      <div className="flex items-center gap-4">
        {/* Gateway Online status */}
        <div className="flex items-center gap-2 text-xs font-medium text-status-ok">
          <span className="size-2 rounded-full bg-status-ok motion-safe:animate-pulse" />
          <span>Online</span>
        </div>

        {/* User avatar menu dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            className="size-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-medium text-xs hover:border-primary transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            title={session?.name || 'User Profile'}
          >
            MO
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-10 w-56 rounded-lg border border-border bg-popover text-foreground p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2.5 py-2 border-b border-border/50 mb-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {session?.name || 'Dr. Mensah Osei'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.email || 'm.osei@waec.org'}
                </p>
                <span className="inline-block mt-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Regional Controller
                </span>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false)
                  onOpenProfile?.()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
              >
                <User className="size-3.5" />
                <span>Officer Profile</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false)
                  onSignOut?.()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-status-sos hover:bg-status-sos/10 transition-colors cursor-pointer text-left mt-0.5"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
