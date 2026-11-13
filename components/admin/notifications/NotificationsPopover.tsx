'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Phone, Compass, Bell } from 'lucide-react'

export interface NotificationItem {
  id: string
  sourceType?: 'incident' | 'audit'
  sourceId?: string
  category: 'sos' | 'geofence' | 'device' | 'checkin'
  type: 'critical' | 'warning' | 'success'
  title: string
  subtitle: string
  time: string
  read: boolean
  officerId?: string
  officerName?: string
  centerName?: string
  battery?: string
  actionLabel?: string
}

interface NotificationsPopoverProps {
  isOpen: boolean
  onClose: () => void
  notifications: NotificationItem[]
  loading?: boolean
  onMarkAllRead?: () => Promise<void> | void
  onFocusOfficer?: (officerId?: string) => void
  onFocusSos?: () => void
  onCallEmergency?: () => void
  onOpenIncidents?: () => void
  onOpenSettings?: () => void
}

export function NotificationsPopover({
  isOpen,
  onClose,
  notifications,
  loading = false,
  onMarkAllRead,
  onFocusOfficer,
  onFocusSos,
  onCallEmergency,
  onOpenIncidents,
  onOpenSettings,
}: NotificationsPopoverProps) {
  const [filter, setFilter] = useState<'all' | 'sos' | 'geofence' | 'device' | 'checkin'>('all')
  const [markingRead, setMarkingRead] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null
        if (target && target.closest('[data-bell-trigger]')) {
          return
        }
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleMarkAllAsRead = async () => {
    if (!onMarkAllRead) return
    setMarkingRead(true)
    try {
      await onMarkAllRead()
    } finally {
      setMarkingRead(false)
    }
  }

  const totalCount = notifications.length
  const sosCount = notifications.filter((n) => n.category === 'sos').length
  const geofenceCount = notifications.filter((n) => n.category === 'geofence').length
  const devicesCount = notifications.filter((n) => n.category === 'device').length
  const checkinsCount = notifications.filter((n) => n.category === 'checkin').length
  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true
    return item.category === filter
  })

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute right-2 sm:right-4 top-13 z-50 w-[calc(100vw-1rem)] sm:w-[410px] max-w-[420px] rounded-2xl border border-[#22263C] bg-[#0E1019] text-zinc-100 shadow-2xl shadow-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden font-sans select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-[#1A1F33]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white tracking-tight">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-status-sos/20 text-status-sos text-[10px] font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={markingRead || unreadCount === 0}
          onClick={handleMarkAllAsRead}
          className="text-[11px] font-medium text-slate-300 hover:text-white disabled:opacity-40 px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-800/40 hover:bg-slate-800 transition cursor-pointer"
        >
          {markingRead ? 'Updating...' : 'Mark all as read'}
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1A1F33]/80 overflow-x-auto text-[11px] scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer shrink-0 ${
            filter === 'all'
              ? 'bg-[#1E2B7B] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151928]'
          }`}
        >
          All {totalCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter('sos')}
          className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer shrink-0 ${
            filter === 'sos'
              ? 'bg-status-sos/20 text-status-sos font-semibold border border-status-sos/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151928]'
          }`}
        >
          SOS {sosCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter('geofence')}
          className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer shrink-0 ${
            filter === 'geofence'
              ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151928]'
          }`}
        >
          Check-in area {geofenceCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter('device')}
          className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer shrink-0 ${
            filter === 'device'
              ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151928]'
          }`}
        >
          Devices {devicesCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter('checkin')}
          className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer shrink-0 ${
            filter === 'checkin'
              ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151928]'
          }`}
        >
          Check-ins {checkinsCount}
        </button>
      </div>

      {/* Live Notification List Items */}
      <div className="max-h-[360px] overflow-y-auto p-3 space-y-2.5">
        {loading && notifications.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Loading live notifications from database...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
            <Bell className="size-5 text-slate-600" />
            <span>No events in this category yet</span>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            if (notif.category === 'sos') {
              return (
                <div
                  key={notif.id}
                  className={`rounded-xl border border-red-500/30 bg-[#1A121A] p-3 border-l-4 border-l-red-500 shadow-md relative group ${
                    notif.read ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold tracking-wide">
                      Critical SOS
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{notif.time}</span>
                  </div>

                  <div className="mt-2">
                    <div className="text-xs font-bold text-white tracking-tight leading-snug">
                      {notif.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{notif.subtitle}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (notif.officerId && onFocusOfficer) {
                          onFocusOfficer(notif.officerId)
                        } else {
                          onFocusSos?.()
                        }
                        onClose()
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#2E41B6] hover:bg-[#394FD6] text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Compass className="size-3.5" />
                      <span>Focus on map</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCallEmergency?.()}
                      className="px-3 py-1.5 rounded-lg bg-[#151928] hover:bg-[#1D2236] border border-slate-700/80 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Phone className="size-3.5 text-red-400" />
                      <span>Call emergency 191</span>
                    </button>
                  </div>
                </div>
              )
            }

            const dotColor =
              notif.type === 'success' ? 'bg-emerald-400' : 'bg-amber-400'

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.officerId && onFocusOfficer) {
                    onFocusOfficer(notif.officerId)
                    onClose()
                  }
                }}
                className={`flex items-start justify-between py-2 px-2.5 rounded-lg hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-none ${
                  notif.officerId ? 'cursor-pointer' : ''
                } ${notif.read ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`size-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 tracking-tight">
                      {notif.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {notif.subtitle}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2 mt-0.5">
                  {notif.time}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Links */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1A1F33] bg-[#0A0D15]/80 text-xs">
        <button
          type="button"
          onClick={() => {
            onOpenIncidents?.()
            onClose()
          }}
          className="text-sky-400 hover:text-sky-300 font-medium transition cursor-pointer"
        >
          Open incident logs
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenSettings?.()
            onClose()
          }}
          className="text-slate-400 hover:text-white font-medium transition cursor-pointer"
        >
          Notification settings
        </button>
      </div>
    </div>
  )
}
