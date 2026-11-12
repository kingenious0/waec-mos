'use client'

import React, { useState } from 'react'
import { Bell, User, Settings, LogOut } from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'
import {
  NotificationsPopover,
  type NotificationItem,
} from '@/components/admin/notifications/NotificationsPopover'

export type TopBarBadge = { label: string; tone?: 'neutral' | 'ok' }

interface MobileTopBarProps {
  title: string
  badge?: TopBarBadge
  session?: SessionData | null
  notifications?: NotificationItem[]
  notificationsLoading?: boolean
  unreadAlertsCount?: number
  onMarkAllRead?: () => Promise<void> | void
  onFocusOfficer?: (officerId?: string) => void
  onFocusSos?: () => void
  onCallEmergency?: () => void
  onOpenIncidents?: () => void
  onOpenSettings?: () => void
  onOpenProfile?: () => void
  onSignOut?: () => void
}

/**
 * Shared 60px mobile top bar — same on every admin screen (< lg).
 * Title + optional count chip on the left; bell with unread dot and the
 * avatar (opens Profile / Settings / Sign out) on the right.
 */
export function MobileTopBar({
  title,
  badge,
  session,
  notifications = [],
  notificationsLoading = false,
  unreadAlertsCount = 0,
  onMarkAllRead,
  onFocusOfficer,
  onFocusSos,
  onCallEmergency,
  onOpenIncidents,
  onOpenSettings,
  onOpenProfile,
  onSignOut,
}: MobileTopBarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)

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
    <header className="lg:hidden h-[60px] shrink-0 border-b border-[#22263C] bg-[#0B0D14] px-4 flex items-center justify-between gap-3 select-none z-20 relative">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
          {title}
        </h1>
        {badge && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
              badge.tone === 'ok'
                ? 'border-status-ok/30 bg-status-ok/10 text-status-ok'
                : 'border-[#22263C] bg-[#11131F] text-slate-400'
            }`}
          >
            {badge.tone === 'ok' && <span className="size-1.5 rounded-full bg-status-ok" />}
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Bell with unread dot */}
        <button
          type="button"
          data-bell-trigger="true"
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          aria-label="Notifications"
          className="relative size-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Bell className="size-5" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-2 right-2.5 size-2 rounded-full bg-status-sos ring-2 ring-[#0B0D14]" />
          )}
        </button>

        {/* Avatar → profile menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAvatarMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={isAvatarMenuOpen}
            className="size-10 rounded-full bg-[#1E2B7B] text-white border border-white/10 flex items-center justify-center font-bold text-xs hover:border-indigo-400/60 transition cursor-pointer overflow-hidden"
          >
            {session?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photo} alt={displayName} className="size-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {isAvatarMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close account menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsAvatarMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-[#22263C] bg-[#0F121E] shadow-2xl overflow-hidden py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false)
                    onOpenProfile?.()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
                >
                  <User className="size-4 shrink-0 text-slate-400" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false)
                    onOpenSettings?.()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
                >
                  <Settings className="size-4 shrink-0 text-slate-400" />
                  Settings
                </button>
                <div className="my-1 border-t border-[#22263C]" />
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false)
                    onSignOut?.()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <LogOut className="size-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live Notifications Popover (shared with desktop) */}
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
