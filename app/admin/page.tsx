'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getClientSession, signOutEverywhere, SessionData } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { PreProvisionOfficerModal, PreProvisionData } from '@/components/admin/modals/PreProvisionOfficerModal'
import { ResetPinModal } from '@/components/admin/modals/ResetPinModal'
import {
  ExamCenterModal,
  type DistrictOption,
  type ExamCenterFormPayload,
} from '@/components/admin/modals/ExamCenterModal'
import { LogIncidentModal, type LogIncidentPayload } from '@/components/admin/modals/LogIncidentModal'
import { ConfirmDialog } from '@/components/admin/modals/ConfirmDialog'
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  CheckCircle2,
  X,
  Building2,
  ShieldAlert,
  Star,
  MapPin,
  Phone,
  AlertTriangle,
  Battery,
  Compass,
  Shield,
  Siren,
  KeyRound,
  User,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Filter,
  RefreshCw,
  MoreVertical,
  ChevronDown,
} from 'lucide-react'
import type { UserAccount } from '@/lib/db'
import type { FleetOfficer, ExamCenter } from '@/components/admin/FleetMap'
import { AdminSidebar } from '@/components/admin/sidebar/AdminSidebar'
import { AdminTopNav } from '@/components/admin/header/AdminTopNav'
import { OfficerTelematicsDrawer } from '@/components/admin/inspector/OfficerTelematicsDrawer'
import { MobileBottomNav } from '@/components/admin/mobile/MobileBottomNav'
import { MobileTopBar } from '@/components/admin/mobile/MobileTopBar'
import { MobileOfficerCard } from '@/components/admin/directory/MobileOfficerCard'
import { RequestsPanel } from '@/components/admin/directory/RequestsPanel'
import { MobileOfficerSheet } from '@/components/admin/inspector/MobileOfficerSheet'
import { MobileCenterCard } from '@/components/admin/centers/MobileCenterCard'
import { formatGhanaPhone } from '@/lib/phone'
import { isOfficerAtCentre, effectiveRadius } from '@/lib/presence'
import { displayName } from '@/lib/name-utils'
import {
  formatDayTime,
  formatTimeOnly,
  dayGroupLabel,
  formatDurationBetween,
  formatWaitingSince,
} from '@/lib/day-time'
import { SystemSettingsTab } from '@/components/admin/settings/SystemSettingsTab'
import { SafetyCenter } from '@/components/admin/safety/SafetyCenter'
import { TimetablePanel } from '@/components/admin/timetable/TimetablePanel'
import type { NotificationItem } from '@/components/admin/notifications/NotificationsPopover'
import {
  DEFAULT_SYSTEM_SETTINGS,
  parseGeofenceRadiusMeters,
  parseRefreshIntervalMs,
  parseSessionTimeoutMs,
  type SystemSettingsConfig,
} from '@/lib/settings-utils'

const FleetMap = dynamic(() => import('@/components/admin/FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#090A0F] text-slate-400">
      <div className="size-8 animate-spin rounded-full border-2 border-[#1E2B7B] border-t-[#F6D300] mb-3" />
      <span className="text-xs font-mono font-semibold tracking-wider text-slate-400">
        INITIALIZING ASHANTI REGIONAL TELEMATICS GRID...
      </span>
    </div>
  ),
})

interface LiveIncidentRecord {
  id: string
  incidentNumber: string
  title: string
  category: string
  severity: string
  status: string
  description: string
  resolutionNotes: string
  reportedAt: string | null
  reportedTimeFormatted: string
  resolvedAt: string | null
  reportedBy: string
  reporterName: string
  reporterPhone: string
  reporterStaffId: string
  reporterBattery: number | null
  reporterLat: number | null
  reporterLng: number | null
  reporterDistance: number | null
  centerId: string | null
  centerName: string
  centerCode: string
}

interface LiveAuditLogRecord {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, any>
  createdAt: string | null
  timeFormatted: string
  isRead?: boolean
}

/** Tag colour means something: red = act, amber = look, green = good, grey = routine. */
type AuditTone = 'crit' | 'warn' | 'ok' | 'muted'
const AUDIT_ACTION_META: Record<string, { label: string; tone: AuditTone }> = {
  SOS_TRIGGERED: { label: 'SOS', tone: 'crit' },
  GEOFENCE_BREACH: { label: 'Breach', tone: 'crit' },
  USER_REVOKED: { label: 'Access blocked', tone: 'crit' },
  NEW_DEVICE_SIGNIN: { label: 'New device sign-in', tone: 'warn' },
  LOW_BATTERY_ALERT: { label: 'Low battery', tone: 'warn' },
  CHECK_IN_LOGGED: { label: 'Check-in', tone: 'ok' },
  CHECK_OUT_LOGGED: { label: 'Check-out', tone: 'muted' },
  SOS_STAND_DOWN: { label: 'SOS stood down', tone: 'ok' },
  INCIDENT_RESOLVED: { label: 'Incident fixed', tone: 'ok' },
  INCIDENT_UPDATED: { label: 'Incident updated', tone: 'muted' },
  USER_RESTORED: { label: 'Access restored', tone: 'ok' },
  ADMIN_LOGIN: { label: 'Dashboard sign-in', tone: 'muted' },
  OFFICER_LOGIN: { label: 'Field app sign-in', tone: 'muted' },
  PASSWORD_ROTATED: { label: 'PIN changed', tone: 'muted' },
  PROFILE_UPDATED: { label: 'Profile updated', tone: 'muted' },
}
function auditActionMeta(action: string): { label: string; tone: AuditTone } {
  if (AUDIT_ACTION_META[action]) return AUDIT_ACTION_META[action]
  const label = action.toLowerCase().replace(/_/g, ' ')
  return { label: label.charAt(0).toUpperCase() + label.slice(1), tone: 'muted' }
}
const ATTENTION_ACTIONS = new Set(['SOS_TRIGGERED', 'GEOFENCE_BREACH', 'USER_REVOKED', 'NEW_DEVICE_SIGNIN', 'LOW_BATTERY_ALERT'])
const CHECKIN_ACTIONS = new Set(['CHECK_IN_LOGGED', 'CHECK_OUT_LOGGED'])
const SIGNIN_ACTIONS = new Set(['ADMIN_LOGIN', 'OFFICER_LOGIN', 'NEW_DEVICE_SIGNIN'])
type ActivityFilter = 'attention' | 'all' | 'checkins' | 'signins'

/** Renders the one-line summary for an audit row. */
function auditMessage(log: LiveAuditLogRecord): string {
  const actor = displayName(log.actorName)
  if (log.action === 'CHECK_IN_LOGGED' && typeof log.details?.distanceMeters === 'number') {
    const center = log.details?.centerName || 'the assigned centre'
    return `${actor} checked in at ${center} · ${Math.round(log.details.distanceMeters)} m`
  }
  const raw = typeof log.details?.message === 'string' ? (log.details.message as string) : ''
  if (raw) {
    let msg = raw
      .replace(/Command Console/g, 'the dashboard')
      .replace(/field portal/gi, 'the field app')
    if (log.actorName && msg.startsWith(log.actorName)) {
      msg = actor + msg.slice(log.actorName.length)
    }
    return msg
  }
  return `${actor} — ${auditActionMeta(log.action).label}`
}

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  const [activeTab, setActiveTab] = useState<
    'map' | 'directory' | 'centers' | 'incidents' | 'settings' | 'safety' | 'timetable'
  >('map')

  // Live dashboard state
  const [examCenters, setExamCenters] = useState<ExamCenter[]>([])
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [fleetOfficers, setFleetOfficers] = useState<FleetOfficer[]>([])
  const [selectedOfficer, setSelectedOfficer] = useState<FleetOfficer | null>(null)
  const [officers, setOfficers] = useState<UserAccount[]>([])
  const [incidents, setIncidents] = useState<LiveIncidentRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<LiveAuditLogRecord[]>([])
  const [incidentSummary, setIncidentSummary] = useState({
    activeSosCount: 0,
    openIncidentsCount: 0,
    totalIncidents: 0,
    breachCount: 0,
  })
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0)
  const [systemSettings, setSystemSettings] = useState<SystemSettingsConfig>(
    DEFAULT_SYSTEM_SETTINGS
  )
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true)

  // Map, Search & Filter States
  const [focusTarget, setFocusTarget] = useState<{
    lat: number
    lng: number
    zoom?: number
  } | null>(null)
  const [rosterSearch, setRosterSearch] = useState('')
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryFilter, setDirectoryFilter] = useState<
    'all' | 'active' | 'revoked' | 'nocentre'
  >('all')
  const [incidentFilter, setIncidentFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('attention')
  const [incidentsExpanded, setIncidentsExpanded] = useState(false)
  const [auditOfficerFilterId, setAuditOfficerFilterId] = useState<string | null>(null)

  // Responsive Layout & Feedback
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | 'onsite' | 'enroute' | 'sos'>('all')
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('peek')
  const [feedback, setFeedback] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetPinModal, setShowResetPinModal] = useState<UserAccount | null>(null)
  const [inspectedOfficer, setInspectedOfficer] = useState<UserAccount | null>(null)
  const [centerModalState, setCenterModalState] = useState<{
    mode: 'create' | 'edit'
    center?: ExamCenter
  } | null>(null)
  const [showLogIncidentModal, setShowLogIncidentModal] = useState(false)
  const [centerToDelete, setCenterToDelete] = useState<ExamCenter | null>(null)
  const [officerToDelete, setOfficerToDelete] = useState<UserAccount | null>(null)
  const [openActionsOfficerId, setOpenActionsOfficerId] = useState<string | null>(null)
  const [openCentreMenuId, setOpenCentreMenuId] = useState<string | null>(null)
  const [revokingOfficer, setRevokingOfficer] = useState<UserAccount | null>(null)
  const [undoBlock, setUndoBlock] = useState<UserAccount | null>(null)
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)
  const [centerSearchQuery, setCenterSearchQuery] = useState('')
  const [centerDistrictFilter, setCenterDistrictFilter] = useState('ALL')


  const prevSosCountRef = useRef(0)

  const activeTabTitle = useMemo(() => {
    switch (activeTab) {
      case 'map':
        return 'Live map'
      case 'directory':
        return 'Officers'
      case 'centers':
        return 'Exam Centres'
      case 'incidents':
        return 'Incidents'
      case 'settings':
        return 'Settings'
      case 'safety':
        return 'Safety centre'
      case 'timetable':
        return 'Examination timetable'
      default:
        return 'Live map'
    }
  }, [activeTab])

  const playCommandSosTone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(780, ctx.currentTime)
      osc.frequency.setValueAtTime(540, ctx.currentTime + 0.18)
      osc.frequency.setValueAtTime(780, ctx.currentTime + 0.36)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    } catch {
      // Autoplay blocked until user gesture
    }
  }, [])

  const loadDashboardData = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoadingLive(true)
      try {
        const [centersRes, fleetRes, officersRes, incidentsRes, notifRes, settingsRes] =
          await Promise.all([
            fetch('/api/centers'),
            fetch('/api/fleet'),
            fetch('/api/officers'),
            fetch('/api/incidents'),
            fetch('/api/notifications'),
            fetch('/api/settings'),
          ])

        const [
          centersData,
          fleetData,
          officersData,
          incidentsData,
          notifData,
          settingsData,
        ] = await Promise.all([
          centersRes.json(),
          fleetRes.json(),
          officersRes.json(),
          incidentsRes.json(),
          notifRes.json(),
          settingsRes.json(),
        ])

        if (centersData.centers) {
          setExamCenters(centersData.centers)
        }
        if (centersData.districts) {
          setDistricts(centersData.districts)
        }

        if (fleetData.officers) {
          const nextFleet: FleetOfficer[] = fleetData.officers
          setFleetOfficers(nextFleet)
          setSelectedOfficer((prev) => {
            if (prev) {
              return nextFleet.find((o) => o.id === prev.id) || null
            }
            // Do NOT auto-open the officer card — the map is the primary surface.
            // It opens only when the user taps an officer marker or picks one from a list.
            return null
          })
        }

        if (officersData.officers) {
          setOfficers(officersData.officers)
        }

        if (incidentsData.incidents) {
          setIncidents(incidentsData.incidents)
        }
        if (incidentsData.auditLogs) {
          setAuditLogs(incidentsData.auditLogs)
        }
        if (incidentsData.summary) {
          setIncidentSummary(incidentsData.summary)
          const nextSos = incidentsData.summary.activeSosCount || 0
          if (
            nextSos > prevSosCountRef.current &&
            (settingsData.settings?.sosAlarmSound ?? true)
          ) {
            playCommandSosTone()
          }
          prevSosCountRef.current = nextSos
        }

        if (notifData.notifications) {
          setNotifications(notifData.notifications)
          setNotificationsUnreadCount(notifData.unreadCount || 0)
        }

        if (settingsData.settings) {
          setSystemSettings(settingsData.settings)
        }
      } catch (err) {
        console.error('Failed to load live dashboard data from Neon:', err)
      } finally {
        if (!silent) setIsLoadingLive(false)
      }
    },
    [playCommandSosTone]
  )

  // Check auth session & perform initial fetch
  useEffect(() => {
    getClientSession().then((s) => {
      if (!s) {
        router.push('/login')
        return
      }
      if (!['ADMIN', 'SUPER_ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(String(s.role || '').toUpperCase())) {
        router.push('/field')
        return
      }
      if ((s as any).mustChangePassword) {
        router.replace('/choose-pin')
        return
      }
      setSession(s)
      loadDashboardData(false)
    })
  }, [router, loadDashboardData])

  // Background polling interval driven by DB locationRefreshInterval
  const pollIntervalMs = useMemo(
    () => parseRefreshIntervalMs(systemSettings.locationRefreshInterval),
    [systemSettings.locationRefreshInterval]
  )

  useEffect(() => {
    if (!session) return
    const timer = setInterval(() => {
      loadDashboardData(true)
    }, pollIntervalMs)
    return () => clearInterval(timer)
  }, [session, pollIntervalMs, loadDashboardData])

  // Auto-dismiss feedback toast after 5s
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(''), 5000)
    return () => clearTimeout(t)
  }, [feedback])

  const handleSignOut = useCallback(() => {
    signOutEverywhere().finally(() => {
      router.push('/login')
    })
  }, [router])

  // Inactivity timeout enforcement from DB sessionTimeout setting
  useEffect(() => {
    if (!session) return
    const timeoutMs = parseSessionTimeoutMs(systemSettings.sessionTimeout)
    if (!timeoutMs) return

    let timeoutId: NodeJS.Timeout
    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        signOutEverywhere().finally(() => {
          router.push('/login')
        })
      }, timeoutMs)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach((ev) => window.removeEventListener(ev, resetTimer))
    }
  }, [session, systemSettings.sessionTimeout, router])

  // Computed live metrics
  const deployedMonitorsCount = fleetOfficers.length
  const activeSosCount = fleetOfficers.filter((o) => o.status === 'SOS').length
  const centresNeedingAttention = useMemo(
    () => examCenters.filter((c) => (c.openIncidentsCount || 0) > 0).length,
    [examCenters]
  )
  const assignedOfficerCount = useMemo(
    () => examCenters.reduce((acc, c) => acc + (c.totalMonitors || 0), 0),
    [examCenters]
  )
  const officersAtCentreByCode = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of fleetOfficers) {
      if (!isOfficerAtCentre(o)) continue
      const code = o.centerCode || ''
      if (!code) continue
      counts[code] = (counts[code] || 0) + 1
    }
    return counts
  }, [fleetOfficers])
  // "At the centre" counts only officers with a fresh update (<5 min) inside
  // the check-in area — the same rule the map and Officers page use.
  const verifiedOnSiteCount = fleetOfficers.filter(isOfficerAtCentre).length

  const unresolvedIncidents = useMemo(
    () => incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status)),
    [incidents]
  )
  const criticalSosIncidents = useMemo(
    () =>
      unresolvedIncidents.filter(
        (i) => i.severity === 'CRITICAL' || i.category === 'SOS'
      ),
    [unresolvedIncidents]
  )
  const safeCentersCount = useMemo(
    () => examCenters.filter((c) => (c.openIncidentsCount || 0) === 0).length,
    [examCenters]
  )

  const filteredCenters = useMemo(() => {
    let list = examCenters
    if (centerDistrictFilter !== 'ALL') {
      list = list.filter((c) => c.districtId === centerDistrictFilter)
    }
    const q = centerSearchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.districtName && c.districtName.toLowerCase().includes(q))
      )
    }
    return list
  }, [examCenters, centerDistrictFilter, centerSearchQuery])

  const totalCriticalSosCount = Math.max(activeSosCount, criticalSosIncidents.length)
  const defaultRadiusMeters = parseGeofenceRadiusMeters(systemSettings.geofenceRadius)

  // Interactive Handlers
  const handleCallOfficer = (phone: string) => {
    if (!phone) {
      setFeedback('Unable to initiate call: no phone number registered for officer.')
      return
    }
    window.open(`tel:${phone}`)
    setFeedback(`Initiating voice communication line with ${phone}...`)
  }

  const handleNavigate = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    setFeedback(`Opened tactical route navigation to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }

  const handleFocusOfficer = (officerId?: string) => {
    const target = officerId
      ? fleetOfficers.find((o) => o.id === officerId)
      : fleetOfficers.find((o) => o.status === 'SOS') || fleetOfficers[0]

    setActiveTab('map')
    if (target) {
      setSelectedOfficer(target)
      setFocusTarget({ lat: target.lat, lng: target.lng, zoom: 16 })
      setFeedback(`Focused telematics map on ${target.name} (${target.assignedCenter})`)
    }
  }

  const handleFocusIncidentLocation = (inc: LiveIncidentRecord) => {
    const matchedOfficer = fleetOfficers.find((o) => o.id === inc.reportedBy)
    const matchedCenter = examCenters.find(
      (c) => c.code === inc.centerCode || c.name === inc.centerName
    )
    setActiveTab('map')
    if (matchedOfficer) {
      setSelectedOfficer(matchedOfficer)
      setFocusTarget({ lat: matchedOfficer.lat, lng: matchedOfficer.lng, zoom: 16 })
      setFeedback(`Focused map on ${matchedOfficer.name} (${inc.incidentNumber})`)
    } else if (inc.reporterLat && inc.reporterLng) {
      setFocusTarget({ lat: inc.reporterLat, lng: inc.reporterLng, zoom: 16 })
      setFeedback(`Focused map on incident ${inc.incidentNumber}`)
    } else if (matchedCenter) {
      setFocusTarget({ lat: matchedCenter.lat, lng: matchedCenter.lng, zoom: 16 })
      setFeedback(`Focused map on ${matchedCenter.name}`)
    }
  }

  const handleCenterFocus = (center: ExamCenter) => {
    setActiveTab('map')
    setFocusTarget({ lat: center.lat, lng: center.lng, zoom: 16 })
    setFeedback(`Showing ${center.name} on the live map`)
  }

  const [blockAccountTarget, setBlockAccountTarget] = useState<{
    actorId: string
    name: string
    logId: string
  } | null>(null)
  const [blockAccountBusy, setBlockAccountBusy] = useState(false)

  const runSecurityReview = async (input: {
    action: 'it_was_me' | 'block'
    targetUserId: string
    name: string
    logId: string
  }) => {
    try {
      const res = await fetch('/api/security/oddities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: input.action, targetUserId: input.targetUserId }),
      })
      if (!res.ok) throw new Error()
      // The row is now resolved — mark it read so it leaves "Needs attention".
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceType: 'audit', sourceId: input.logId }),
      }).catch(() => {})
      setFeedback(
        input.action === 'block'
          ? `${input.name}'s account blocked. Restore anytime from the Officers page.`
          : `${input.name} confirmed — removed from Needs attention.`
      )
      loadDashboardData(true)
      return true
    } catch {
      setFeedback('Could not update. Try again.')
      return false
    }
  }

  /** The new-device sign-in row action. "It was them" is safe and runs directly;
   *  blocking goes through the in-app ConfirmDialog (never a native popup). */
  const handleSecurityReview = async (log: LiveAuditLogRecord, action: 'it_was_me' | 'block') => {
    const name = displayName(log.actorName)
    if (!log.actorId) {
      setFeedback('No account is linked to this sign-in.')
      return
    }
    if (action === 'block') {
      setBlockAccountTarget({ actorId: log.actorId, name, logId: log.id })
      return
    }
    await runSecurityReview({ action: 'it_was_me', targetUserId: log.actorId, name, logId: log.id })
  }

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ' }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setNotificationsUnreadCount(0)
      }
    } catch {
      setFeedback('Failed to update notification read status.')
    }
  }

  // Personnel Mutations
  const handlePreProvisionOfficer = async (data: PreProvisionData) => {
    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          staffId: data.staffId || `WAEC-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: data.phone,
          pin: data.pin,
          region: data.region,
          group: data.group,
          isGroupLeader: data.isGroupLeader,
          assignedCenter: data.centerName,
          assignedCenterCode: data.centerCode,
          actorId: session?.userId,
          actorName: session?.name,
        }),
      })

      if (res.ok) {
        setFeedback(`Officer ${data.name} registered in ${data.group}`)
        setShowCreateModal(false)
        loadDashboardData(true)
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback(`Error: ${err.error || 'Failed to create officer account'}`)
      }
    } catch {
      setFeedback('Error registering officer account.')
    }
  }

  const handleToggleStatus = async (officer: UserAccount) => {
    const newStatus = officer.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE'
    try {
      const res = await fetch('/api/officers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: officer.id,
          status: newStatus,
          actorId: session?.userId,
          actorName: session?.name,
        }),
      })

      if (res.ok) {
        setFeedback(`Security status for ${officer.name} updated to ${newStatus}`)
        loadDashboardData(true)
        if (newStatus === 'REVOKED') setUndoBlock(officer)
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback(`Failed to update status: ${err.error || 'Server error'}`)
      }
    } catch {
      setFeedback('Failed to update officer status.')
    }
  }

  // Auto-dismiss the Block undo toast after 6 seconds
  useEffect(() => {
    if (!undoBlock) return
    const t = setTimeout(() => setUndoBlock(null), 6000)
    return () => clearTimeout(t)
  }, [undoBlock])

  // Block is destructive (it locks the officer out) → requires a confirm.
  // Restoring access is not destructive, so it happens immediately.
  const handleToggleStatusGuarded = (officer: UserAccount) => {
    if (officer.status === 'ACTIVE') {
      setRevokingOfficer(officer)
    } else {
      handleToggleStatus(officer)
    }
  }

  const handleSaveResetPin = async (officerId: string, newPin: string) => {
    try {
      const res = await fetch('/api/officers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: officerId,
          pin: newPin,
          actorId: session?.userId,
          actorName: session?.name,
        }),
      })

      if (res.ok) {
        setFeedback(`PIN reset successfully to ${newPin}`)
        setShowResetPinModal(null)
        loadDashboardData(true)
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback(`Failed to reset officer PIN: ${err.error || 'Server error'}`)
      }
    } catch {
      setFeedback('Failed to reset officer PIN.')
    }
  }

  const handleSaveOfficerProfile = async (
    updated: Partial<SessionData>
  ): Promise<boolean> => {
    if (!inspectedOfficer) return false
    const res = await fetch('/api/officers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: inspectedOfficer.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        pin: updated.pin,
        photo: updated.photo,
        bio: updated.bio,
        assignedCenter: updated.assignedCenter,
        assignedCenterCode: updated.assignedCenterCode,
        actorId: session?.userId,
        actorName: session?.name,
      }),
    })

    const errData = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(errData.error || 'Failed to save officer profile')
    }

    setFeedback(`Profile & assignment for ${updated.name || inspectedOfficer.name} saved to database`)
    setInspectedOfficer(null)
    loadDashboardData(true)
    return true
  }

  const handleDeleteCenterConfirm = async () => {
    if (!centerToDelete) return
    setIsDeletingRecord(true)
    try {
      const res = await fetch(
        `/api/centers?id=${encodeURIComponent(centerToDelete.id || '')}&actorId=${encodeURIComponent(
          session?.userId || ''
        )}&actorName=${encodeURIComponent(session?.name || '')}`,
        {
          method: 'DELETE',
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFeedback(`Failed to delete centre: ${data.error || 'Server error'}`)
        return
      }
      setFeedback(`Centre ${centerToDelete.name} deleted`)
      setCenterToDelete(null)
      loadDashboardData(true)
    } catch {
      setFeedback('Failed to connect to central registry.')
    } finally {
      setIsDeletingRecord(false)
    }
  }

  const handleDeleteOfficerConfirm = async () => {
    if (!officerToDelete) return
    setIsDeletingRecord(true)
    try {
      const res = await fetch(
        `/api/officers?id=${encodeURIComponent(officerToDelete.id)}&actorId=${encodeURIComponent(
          session?.userId || ''
        )}&actorName=${encodeURIComponent(session?.name || '')}`,
        {
          method: 'DELETE',
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFeedback(`Failed to delete officer: ${data.error || 'Server error'}`)
        return
      }
      setFeedback(`Officer ${officerToDelete.name} deleted`)
      setOfficerToDelete(null)
      loadDashboardData(true)
    } catch {
      setFeedback('Failed to connect to central registry.')
    } finally {
      setIsDeletingRecord(false)
    }
  }

  // Center Create / Edit
  const handleSaveExamCenter = async (payload: ExamCenterFormPayload) => {
    const isEdit = Boolean(payload.id)
    const res = await fetch('/api/centers', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        actorId: session?.userId,
        actorName: session?.name,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save examination centre')
    }

    setFeedback(
      isEdit
        ? `Updated check-in area and centre configuration for ${payload.name}`
        : `Registered new examination centre ${payload.name} (${payload.code})`
    )
    loadDashboardData(true)
  }

  // Incident Create / Update Workflow
  const handleCreateIncident = async (payload: LogIncidentPayload) => {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to log incident')
    }

    setFeedback(`Incident logged successfully (${data.incident?.incidentNumber || 'Saved'})`)
    loadDashboardData(true)
  }

  const handleUpdateIncidentStatus = async (
    incidentId: string,
    nextStatus: 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED'
  ) => {
    try {
      const res = await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: incidentId,
          status: nextStatus,
          resolutionNotes:
            nextStatus === 'RESOLVED' || nextStatus === 'CLOSED'
              ? `Cleared by ${session?.name || 'HQ Command'}`
              : `Status transitioned to ${nextStatus} by ${session?.name || 'HQ Command'}`,
          actorId: session?.userId,
          actorName: session?.name,
        }),
      })

      if (res.ok) {
        setFeedback(`Incident status updated to ${nextStatus}`)
        loadDashboardData(true)
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback(`Failed to update incident: ${err.error || 'Server error'}`)
      }
    } catch {
      setFeedback('Failed to update incident status.')
    }
  }

  // Filters
  const filteredFleetOfficers = useMemo(() => {
    const query = rosterSearch.toLowerCase()
    if (!query) return fleetOfficers
    return fleetOfficers.filter(
      (off) =>
        off.name.toLowerCase().includes(query) ||
        off.assignedCenter.toLowerCase().includes(query) ||
        off.group.toLowerCase().includes(query) ||
        off.staffId.toLowerCase().includes(query)
    )
  }, [fleetOfficers, rosterSearch])

  const mapSosOfficer = useMemo(
    () => fleetOfficers.find((o) => o.status === 'SOS' && o.sosIncidentId) ?? null,
    [fleetOfficers]
  )

  // Reset the mobile officer sheet to peek whenever a different officer is selected
  useEffect(() => {
    setSheetSnap('peek')
  }, [selectedOfficer?.id])

  const filteredDirectoryOfficers = useMemo(() => {
    const q = directorySearch.toLowerCase()
    if (!q) return officers
    return officers.filter(
      (off) =>
        off.name.toLowerCase().includes(q) ||
        off.phone.toLowerCase().includes(q) ||
        (off.staffId && off.staffId.toLowerCase().includes(q)) ||
        (off.assignedCenter && off.assignedCenter.toLowerCase().includes(q)) ||
        (off.group && off.group.toLowerCase().includes(q))
    )
  }, [officers, directorySearch])

  const isOfficerUnassigned = (off: UserAccount) =>
    !off.assignedCenter || off.assignedCenter === 'Unassigned' || !off.assignedCenter.trim()

  const directoryCounts = useMemo(
    () => ({
      all: officers.length,
      active: officers.filter((o) => o.status === 'ACTIVE').length,
      revoked: officers.filter((o) => o.status !== 'ACTIVE').length,
      nocentre: officers.filter(isOfficerUnassigned).length,
    }),
    [officers]
  )

  const mobileDirectoryList = useMemo(() => {
    let list = filteredDirectoryOfficers
    if (directoryFilter === 'active') list = list.filter((o) => o.status === 'ACTIVE')
    else if (directoryFilter === 'revoked') list = list.filter((o) => o.status !== 'ACTIVE')
    else if (directoryFilter === 'nocentre') list = list.filter(isOfficerUnassigned)
    return list
  }, [filteredDirectoryOfficers, directoryFilter])

  const isIncidentOpen = (inc: LiveIncidentRecord) =>
    !['RESOLVED', 'CLOSED'].includes(inc.status)

  const filteredIncidents = useMemo(() => {
    const list = incidents.filter((inc) => {
      if (incidentFilter === 'OPEN') return isIncidentOpen(inc)
      if (incidentFilter === 'RESOLVED') return !isIncidentOpen(inc)
      return true
    })
    // Open first, then resolved — newest first within each group.
    const open = list
      .filter(isIncidentOpen)
      .sort((a, b) => (Date.parse(b.reportedAt || '') || 0) - (Date.parse(a.reportedAt || '') || 0))
    const done = list
      .filter((inc) => !isIncidentOpen(inc))
      .sort((a, b) => (Date.parse(b.reportedAt || '') || 0) - (Date.parse(a.reportedAt || '') || 0))
    return [...open, ...done]
  }, [incidents, incidentFilter])

  const filteredAuditLogs = useMemo(() => {
    if (!auditOfficerFilterId) return auditLogs
    return auditLogs.filter(
      (log) => log.actorId === auditOfficerFilterId || log.entityId === auditOfficerFilterId
    )
  }, [auditLogs, auditOfficerFilterId])

  const activityFiltered = useMemo(() => {
    switch (activityFilter) {
      case 'attention':
        // A review ("It was them" / block) resolves the row — it leaves the tab.
        return filteredAuditLogs.filter(
          (l) => ATTENTION_ACTIONS.has(l.action) && !l.isRead
        )
      case 'checkins':
        return filteredAuditLogs.filter((l) => CHECKIN_ACTIONS.has(l.action))
      case 'signins':
        return filteredAuditLogs.filter((l) => SIGNIN_ACTIONS.has(l.action))
      default:
        return filteredAuditLogs
    }
  }, [filteredAuditLogs, activityFilter])

  /** Activity rows grouped by day, capped at 8 unless "Show full history" is on. */
  const groupedAuditLogs = useMemo(() => {
    const rows = showAllActivity ? activityFiltered : activityFiltered.slice(0, 8)
    const groups: Array<{ label: string; rows: LiveAuditLogRecord[] }> = []
    for (const log of rows) {
      const label = dayGroupLabel(log.createdAt)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.rows.push(log)
      else groups.push({ label, rows: [log] })
    }
    return groups
  }, [activityFiltered, showAllActivity])

  const adminDisplayName = session?.name || 'Regional Command'

  const filteredAuditOfficerName = useMemo(() => {
    if (!auditOfficerFilterId) return ''
    return (
      officers.find((o) => o.id === auditOfficerFilterId)?.name ||
      fleetOfficers.find((o) => o.id === auditOfficerFilterId)?.name ||
      auditOfficerFilterId
    )
  }, [auditOfficerFilterId, officers, fleetOfficers])


  // --- Incident list shared by the mobile + desktop layouts (defined once) ---
  // Collapsed by default. A LIVE incident opens the panel automatically and
  // can never be hidden behind the toggle — resolving it collapses the panel again.
  const liveCount = unresolvedIncidents.length
  const resolvedCount = incidents.length - liveCount
  const incidentsPanelOpen = liveCount > 0 || incidentsExpanded

  const recordedIncidentsBlock = (
    <div
      className={`rounded-2xl border bg-[#11131F] shadow-md overflow-hidden transition-colors ${
        liveCount > 0 ? 'border-rose-500/50' : 'border-[#22263C]'
      }`}
    >
      {/* Collapsed row — one line of state, always visible */}
      <button
        type="button"
        onClick={() => {
          if (liveCount === 0) setIncidentsExpanded((v) => !v)
        }}
        aria-expanded={incidentsPanelOpen}
        aria-controls="incidents-panel-body"
        className={`w-full flex items-center gap-3 p-4 sm:p-5 text-left ${
          liveCount > 0 ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.03] transition-colors'
        }`}
      >
        {liveCount > 0 ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/35">
            <Siren className="size-4.5 text-rose-400 animate-pulse" aria-hidden />
          </span>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <ShieldCheck className="size-4 text-emerald-400/80" aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <h3 className="font-bold text-xs text-slate-200 tracking-wider">
            Incidents{' '}
            <span className="text-slate-500 font-semibold">({incidents.length})</span>
            {liveCount > 0 && (
              <span className="ml-2 text-rose-400 font-sans normal-case tracking-normal">
                · {liveCount} live — needs you
              </span>
            )}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {liveCount > 0
              ? 'Showing open incidents — resolve to close them'
              : incidentsExpanded
              ? 'All clear — showing resolved history'
              : `All clear — ${resolvedCount} resolved hidden`}
          </p>
        </span>
        {liveCount === 0 && (
          <ChevronDown
            className={`ml-auto size-5 shrink-0 text-slate-400 transition-transform duration-200 ${
              incidentsPanelOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        )}
      </button>

      {incidentsPanelOpen && (
        <div id="incidents-panel-body" className="border-t border-[#1E243A] p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="font-bold text-xs text-slate-300 tracking-wider">
          Showing <span className="text-slate-500 font-semibold">({filteredIncidents.length})</span>
        </h3>

        <div className="flex items-center gap-1.5 text-[11px]">
          {(['ALL', 'OPEN', 'RESOLVED'] as const).map((tab) => {
            const openCount = unresolvedIncidents.length
            const resolvedCount = incidents.length - unresolvedIncidents.length
            const active = incidentFilter === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setIncidentFilter(tab)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#1E2B7B] text-white border border-indigo-400/40'
                    : 'text-slate-400 hover:text-white bg-[#0A0D17]'
                }`}
              >
                {tab === 'ALL'
                  ? `All (${incidents.length})`
                  : tab === 'OPEN'
                  ? `Open (${openCount})`
                  : `Resolved (${resolvedCount})`}
                {tab === 'OPEN' && openCount > 0 && (
                  <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#22263C] p-6 text-center text-xs text-slate-500">
          {incidentFilter === 'OPEN' ? 'No open incidents right now.' : 'Nothing recorded in this view yet.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredIncidents.map((inc) => {
            const isClosed = !isIncidentOpen(inc)
            const isSos = inc.severity === 'CRITICAL' || inc.category === 'SOS'
            const isAck = inc.status === 'ACKNOWLEDGED'
            const reporter = displayName(inc.reporterName)
            const fixedLog = auditLogs.find(
              (l) => l.action === 'INCIDENT_RESOLVED' && l.entityId === inc.id
            )
            // Auto-written status notes ("Cleared by X" / "Status transitioned to …")
            // duplicate the footer — only surface notes a person actually wrote.
            const noteRaw = (inc.resolutionNotes || '').trim()
            const note = noteRaw && !/^(Status transitioned to|Cleared by)/i.test(noteRaw) ? noteRaw : null
            const fixedBy = fixedLog ? displayName(fixedLog.actorName) : null
            const fixedIn = formatDurationBetween(inc.reportedAt, inc.resolvedAt)
            const waiting = formatWaitingSince(inc.reportedAt)
            const distanceKm =
              typeof inc.reporterDistance === 'number' ? inc.reporterDistance : null
            const distanceText =
              distanceKm === null
                ? null
                : distanceKm >= 1000
                ? `${(distanceKm / 1000).toFixed(1)} km`
                : `${Math.round(distanceKm)} m`

            return (
              <div
                key={inc.id}
                className={`rounded-xl bg-[#0C0F1D] border border-l-4 p-4 space-y-2 ${
                  isClosed
                    ? 'border-[#22263C] border-l-[#22263C]'
                    : isSos
                    ? 'border-rose-500/40 border-l-rose-500'
                    : 'border-amber-500/30 border-l-amber-500/70'
                }`}
              >
                {/* Tag + reference + when */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isSos
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : inc.severity === 'HIGH'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-[#22263C]'
                    }`}
                  >
                    {isSos ? 'SOS' : inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1).toLowerCase()}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Reference {inc.incidentNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {formatDayTime(inc.reportedAt)}
                  </span>
                </div>

                {/* Title + centre */}
                <h4 className="text-sm font-bold text-white leading-snug">
                  {isSos
                    ? `SOS from ${reporter}`
                    : inc.title?.trim() || `Incident at ${inc.centerName}`}
                </h4>
                <p className="text-xs text-slate-300">{inc.centerName}</p>

                {/* Footer line */}
                {isClosed ? (
                  <p className="text-[11px] text-slate-400">
                    {fixedBy ? (
                      <>
                        Fixed by <span className="text-slate-200">{fixedBy}</span> ·{' '}
                      </>
                    ) : null}
                    {formatDayTime(inc.resolvedAt)}
                    {fixedIn ? (
                      <>
                        {' '}
                        · <span className="text-emerald-400 font-semibold">Fixed in {fixedIn}</span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-rose-400">
                    {isAck ? 'On it' : 'Open'} · waiting for {waiting}
                  </p>
                )}

                {/* Note — only when a person actually wrote one */}
                {note ? (
                  <p className="text-[11px] text-slate-400 border-t border-[#1E243A] pt-2 leading-snug">
                    Note: {note}
                  </p>
                ) : null}

                {/* Actions — open cards only */}
                {!isClosed && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {inc.status === 'REPORTED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateIncidentStatus(inc.id, 'ACKNOWLEDGED')}
                        className="px-3 py-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 text-xs font-semibold transition cursor-pointer min-h-[40px]"
                      >
                        I&apos;m on it
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateIncidentStatus(inc.id, 'RESOLVED')}
                      className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 text-xs font-semibold transition cursor-pointer min-h-[40px]"
                    >
                      Problem fixed
                    </button>
                    {isSos && (
                      <>
                        <a
                          href="tel:191"
                          className="px-3 py-2 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                        >
                          <Phone className="size-3.5" />
                          <span>Call 191</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleFocusIncidentLocation(inc)}
                          className="px-3 py-2 rounded-xl bg-[#161B2E] hover:bg-[#202742] border border-[#22263C] text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer min-h-[40px]"
                        >
                          Show on map
                        </button>
                      </>
                    )}
                    {isSos && (
                      <span className="flex items-center gap-3 text-[10px] text-slate-500 sm:ml-auto">
                        {typeof inc.reporterBattery === 'number' && (
                          <span className="tabular-nums">Battery {inc.reporterBattery}%</span>
                        )}
                        {distanceText && <span className="tabular-nums">{distanceText}</span>}
                        {inc.reporterPhone && <span className="tabular-nums">{inc.reporterPhone}</span>}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </div>
      )}
    </div>
  )

  // --- Activity history: grouped by day, tagged by meaning, filterable ---
  const activityTabs = [
    { id: 'attention', label: 'Needs attention' },
    { id: 'all', label: 'All' },
    { id: 'checkins', label: 'Check-ins' },
    { id: 'signins', label: 'Sign-ins' },
  ] as const

  const activityHistoryBlock = (
    <div className="rounded-2xl border border-[#22263C] bg-[#11131F] p-4 sm:p-5 space-y-3 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-xs text-slate-300 tracking-wider">
          Activity history <span className="text-slate-500 font-semibold">({activityFiltered.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          {auditOfficerFilterId && (
            <button
              type="button"
              onClick={() => setAuditOfficerFilterId(null)}
              className="text-[11px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer"
            >
              <span>Officer: {displayName(filteredAuditOfficerName)}</span>
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filters: routine events (sign-ins, profile updates) only show under All or Sign-ins */}
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter activity">
        {activityTabs.map((tab) => {
          const active = activityFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActivityFilter(tab.id as ActivityFilter)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                active
                  ? 'bg-[#1E2B7B] text-white border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white bg-[#0A0D17] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activityFiltered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#22263C] p-6 text-center text-xs text-slate-500">
          {activityFilter === 'attention'
            ? 'Nothing needs attention right now.'
            : 'No events match this filter yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedAuditLogs.map((group) => (
            <div key={group.label}>
              <div className="px-1 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500">
                {group.label}
              </div>
              <div className="rounded-xl border border-[#22263C] bg-[#0C0F1D] overflow-hidden divide-y divide-[#1C2237]">
                {group.rows.map((log) => {
                  const meta = auditActionMeta(log.action)
                  const reviewed = Boolean(log.isRead) && log.action === 'NEW_DEVICE_SIGNIN'
                  const isSecurity = !reviewed && (meta.tone === 'warn' || meta.tone === 'crit')
                  const tagClass = reviewed
                    ? 'text-slate-400 bg-[#121626] border-[#22263C]'
                    : meta.tone === 'crit'
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                      : meta.tone === 'warn'
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                        : meta.tone === 'ok'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-slate-400 bg-[#121626] border-[#22263C]'
                  return (
                    <div
                      key={log.id}
                      className={`grid grid-cols-[2.5rem_1fr_auto] sm:flex sm:items-center gap-x-3 gap-y-1.5 px-3.5 py-3 sm:py-2.5 ${
                        isSecurity ? 'bg-amber-500/5 border-l-2 border-l-amber-500/60' : ''
                      }`}
                    >
                      {/* Time (+ tag pinned right on mobile) */}
                      <span className="text-[11px] tabular-nums text-slate-500 self-start pt-0.5 sm:pt-0 sm:w-9 sm:shrink-0">
                        {formatTimeOnly(log.createdAt)}
                      </span>
                      <span className="sm:hidden justify-self-end self-start">
                        <span
                          className={`inline-block font-semibold text-[10px] px-2 py-0.5 rounded-full border ${tagClass}`}
                        >
                          {reviewed ? 'Reviewed' : meta.label}
                        </span>
                      </span>
                      {/* Message — full width on mobile, flex-1 on desktop */}
                      <span className="col-span-3 sm:col-span-1 min-w-0 sm:flex-1 text-xs text-slate-200 leading-snug">
                        {auditMessage(log)}
                      </span>
                      {/* Actions */}
                      <span className="col-span-3 sm:col-span-1 flex items-center gap-2 sm:gap-1.5 sm:shrink-0 sm:ml-auto">
                        {log.action === 'NEW_DEVICE_SIGNIN' && !reviewed && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSecurityReview(log, 'it_was_me')}
                              className="h-9 sm:h-7 flex-1 sm:flex-none px-3 sm:px-2.5 rounded-lg border border-[#22263C] bg-[#121626] text-[11px] sm:text-[10px] font-semibold text-slate-200 hover:text-white hover:border-slate-500/50 transition cursor-pointer"
                            >
                              It was them
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSecurityReview(log, 'block')}
                              className="h-9 sm:h-7 flex-1 sm:flex-none px-3 sm:px-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-[11px] sm:text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              Block account
                            </button>
                          </>
                        )}
                        <span
                          className={`hidden sm:inline-block font-semibold shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${tagClass}`}
                        >
                          {reviewed ? 'Reviewed' : meta.label}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {activityFiltered.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllActivity((v) => !v)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#22263C] bg-[#0C0F17] hover:bg-[#151A28] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              {showAllActivity
                ? 'Show less'
                : `Show full history (${activityFiltered.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#090A0F] text-foreground font-sans select-none antialiased">
      {/* Desktop Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        sosCount={totalCriticalSosCount}
        adminName={adminDisplayName}
        adminPhoto={session?.photo}
        onOpenProfile={() => router.push('/profile')}
      />

      {/* Main Stage */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        {/* Desktop top bar (mobile gets the shared MobileTopBar below) */}
        <div className="hidden lg:block">
          <AdminTopNav
            activeTabTitle={activeTabTitle}
            searchQuery={activeTab === 'directory' ? directorySearch : rosterSearch}
            onSearchChange={(q) => {
              if (activeTab === 'directory') {
                setDirectorySearch(q)
              } else {
                setRosterSearch(q)
              }
            }}
            onOpenProfile={() => router.push('/profile')}
            session={session}
            notifications={notifications}
            notificationsLoading={isLoadingLive && notifications.length === 0}
            onMarkAllRead={handleMarkAllNotificationsRead}
            unreadAlertsCount={
              systemSettings.inAppNotifications ? notificationsUnreadCount : 0
            }
            onFocusOfficer={(officerId) => handleFocusOfficer(officerId)}
            onFocusSos={() => handleFocusOfficer()}
            onCallEmergency={() => {
              setFeedback('Emergency Call: Dialing Police Command 191...')
              if (typeof window !== 'undefined') {
                window.open('tel:191')
              }
            }}
            onOpenIncidents={() => setActiveTab('incidents')}
            onOpenSettings={() => setActiveTab('settings')}
          />
        </div>

        {/* Shared mobile chrome — same top bar on every tab */}
        <MobileTopBar
          title={
            activeTab === 'map'
              ? 'Live map'
              : activeTab === 'directory'
              ? 'Officers'
              : activeTab === 'centers'
              ? 'Centres'
              : activeTab === 'incidents'
              ? 'Incidents'
              : activeTab === 'safety'
              ? 'Safety centre'
              : activeTab === 'timetable'
              ? 'Timetable'
              : 'Settings'
          }
          badge={
            activeTab === 'map'
              ? { label: `${verifiedOnSiteCount} on duty`, tone: verifiedOnSiteCount > 0 ? ('ok' as const) : undefined }
              : activeTab === 'directory'
              ? {
                  label:
                    officers.length === 0
                      ? 'No officers yet'
                      : `${officers.length} registered · ${verifiedOnSiteCount} on duty`,
                }
              : activeTab === 'centers'
              ? {
                  label:
                    examCenters.length === 0
                      ? 'No centres'
                      : examCenters.length === 1
                      ? '1 centre'
                      : `${examCenters.length} centres`,
                }
              : activeTab === 'incidents'
              ? {
                  label:
                    unresolvedIncidents.length === 0
                      ? 'No open incidents'
                      : unresolvedIncidents.length === 1
                      ? '1 open'
                      : `${unresolvedIncidents.length} open`,
                }
              : undefined
          }
          session={session}
          notifications={notifications}
          notificationsLoading={isLoadingLive && notifications.length === 0}
          onMarkAllRead={handleMarkAllNotificationsRead}
          unreadAlertsCount={systemSettings.inAppNotifications ? notificationsUnreadCount : 0}
          onFocusOfficer={(officerId) => handleFocusOfficer(officerId)}
          onFocusSos={() => handleFocusOfficer()}
          onCallEmergency={() => {
            setFeedback('Emergency Call: Dialing Police Command 191...')
            if (typeof window !== 'undefined') {
              window.open('tel:191')
            }
          }}
          onOpenIncidents={() => setActiveTab('incidents')}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenProfile={() => router.push('/profile')}
          onSignOut={handleSignOut}
        />

        {/* Undo-block toast */}
        {undoBlock && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-[#1A150A]/95 px-4 py-2.5 text-xs text-amber-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 max-w-[90vw]">
            <ShieldAlert className="size-4 shrink-0 text-amber-400" />
            <span className="whitespace-nowrap truncate">{undoBlock.name} blocked</span>
            <button
              type="button"
              onClick={() => {
                handleToggleStatus(undoBlock)
                setUndoBlock(null)
              }}
              className="shrink-0 rounded-lg border border-amber-500/60 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-100 hover:bg-amber-500/25 transition cursor-pointer min-h-[36px]"
            >
              Undo
            </button>
          </div>
        )}

        {/* Floating Feedback Toast */}
        {feedback &&
          (() => {
            const isError = /fail|error|invalid|cannot|unable/i.test(feedback)
            return (
              <div
                className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-mono shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 max-w-[90vw] ${
                  isError
                    ? 'border-rose-500/40 bg-[#1A0D12]/95 text-rose-300'
                    : 'border-emerald-500/30 bg-[#11131F]/95 text-[#10B981]'
                }`}
              >
                {isError ? (
                  <AlertTriangle className="size-4 shrink-0 text-rose-400" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-[#10B981]" />
                )}
                <span className="truncate">{feedback}</span>
                <button
                  onClick={() => setFeedback('')}
                  className="ml-2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })()}

        <main className="flex-1 flex overflow-hidden relative min-w-0">
          {/* ========================================================= */}
          {/* TAB 1: LIVE FLEET MAP VIEW */}
          {/* ========================================================= */}
          {activeTab === 'map' && (
            <div className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden relative min-w-0 p-0 lg:p-4 gap-0 lg:gap-4">
              <div className="flex-1 h-full w-full relative min-w-0 rounded-none lg:rounded-2xl border-0 lg:border border-[#22263C] overflow-hidden bg-[#090A0F] shadow-2xl">
                <FleetMap
                  officers={filteredFleetOfficers}
                  centers={examCenters}
                  selectedOfficer={selectedOfficer}
                  onSelectOfficer={(off) => setSelectedOfficer(off)}
                  onCallOfficer={handleCallOfficer}
                  onNavigate={handleNavigate}
                  focusTarget={focusTarget}
                  activeSectorName={`${session?.region || 'Ashanti'} Regional Hub`}
                  statusFilter={mapStatusFilter}
                  onStatusFilterChange={setMapStatusFilter}
                />

                {/* Unresolved SOS banner — mobile only, above the map */}
                {mapSosOfficer && (
                  <div
                    role="alert"
                    className="lg:hidden absolute top-14 left-3 right-3 z-20 flex items-center gap-2.5 rounded-2xl border border-status-sos/50 bg-[#1A0D12]/95 backdrop-blur-md px-3 py-2.5 shadow-xl"
                  >
                    <Siren className="size-5 shrink-0 text-status-sos animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-extrabold tracking-[0.14em] text-status-sos">
                        ACTIVE SOS
                      </div>
                      <div className="text-[11px] text-red-100/85 truncate">
                        {mapSosOfficer.name} · {mapSosOfficer.sosIncidentNumber || 'DISTRESS'}
                      </div>
                    </div>
                    {mapSosOfficer.sosStatus === 'ACKNOWLEDGED' ? (
                      <span className="shrink-0 inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[10px] font-bold text-slate-300">
                        ACKED
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          mapSosOfficer.sosIncidentId &&
                          handleUpdateIncidentStatus(mapSosOfficer.sosIncidentId, 'ACKNOWLEDGED')
                        }
                        className="shrink-0 h-10 px-3.5 rounded-xl border border-white/15 bg-white/5 text-[11px] font-bold text-slate-100 hover:bg-white/10 cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                )}

                {/* Mobile officer bottom sheet — peek / half / full snap points */}
                {selectedOfficer && (
                  <MobileOfficerSheet
                    officer={selectedOfficer}
                    snap={sheetSnap}
                    onSnapChange={setSheetSnap}
                    onCallOfficer={handleCallOfficer}
                    onClose={() => setSelectedOfficer(null)}
                    onViewLogs={(officerId) => {
                      setAuditOfficerFilterId(officerId)
                      setActiveTab('incidents')
                    }}
                  />
                )}
              </div>

              {selectedOfficer && (
                <aside className="hidden lg:flex w-[380px] shrink-0 h-full rounded-2xl border border-[#22263C] bg-[#0C0F17] overflow-hidden flex-col shadow-2xl z-10 animate-in fade-in slide-in-from-right-4 duration-200">
                  <OfficerTelematicsDrawer
                    officer={selectedOfficer}
                    onCallOfficer={handleCallOfficer}
                    onViewLogs={(officerId) => {
                      setAuditOfficerFilterId(officerId)
                      setActiveTab('incidents')
                    }}
                    onAcknowledgeSos={(off) =>
                      off.sosIncidentId && handleUpdateIncidentStatus(off.sosIncidentId, 'ACKNOWLEDGED')
                    }
                    onResolveSos={(off) =>
                      off.sosIncidentId && handleUpdateIncidentStatus(off.sosIncidentId, 'RESOLVED')
                    }
                    onClose={() => setSelectedOfficer(null)}
                  />
                </aside>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MONITOR DIRECTORY & CREDENTIALS */}
          {/* ========================================================= */}
          {activeTab === 'directory' && (
            <>
            {/* ===== MOBILE (< lg) — compact cards, chip filters, FAB ===== */}
            <div className="lg:hidden relative flex-1 overflow-y-auto bg-[#090A0F] font-sans">
              <div className="p-4 space-y-3 pb-32">
                {/* Search */}
                <div className="relative">
                  <Search className="size-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    placeholder="Search name, phone or staff ID"
                    aria-label="Search officers"
                    className="w-full h-12 rounded-xl border border-[#22263C] bg-[#11131F] pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-400"
                  />
                </div>

                {/* Requests — access & PIN reset review */}
                <RequestsPanel onChanged={() => loadDashboardData(true)} />

                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      { id: 'all', label: `All ${directoryCounts.all}` },
                      { id: 'active', label: `Active ${directoryCounts.active}` },
                      { id: 'revoked', label: `Blockd ${directoryCounts.revoked}` },
                      { id: 'nocentre', label: `No centre ${directoryCounts.nocentre}` },
                    ] as const
                  ).map((chip) => {
                    const isActive = directoryFilter === chip.id
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setDirectoryFilter(chip.id)}
                        className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'border-indigo-400/70 bg-indigo-500/15 text-indigo-300'
                            : 'border-[#22263C] bg-[#11131F] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>

                {/* Officer list */}
                {mobileDirectoryList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-8 text-center space-y-2">
                    <Users className="size-7 text-slate-500 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                      {directorySearch
                        ? 'No officers matched your search'
                        : directoryFilter === 'revoked'
                        ? 'No revoked officers'
                        : directoryFilter === 'nocentre'
                        ? 'Every officer has a centre'
                        : 'No field officers registered yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mobileDirectoryList.map((officer) => (
                      <MobileOfficerCard
                        key={officer.id}
                        officer={officer}
                        onViewProfile={(o) => setInspectedOfficer(o as unknown as UserAccount)}
                        onResetPin={(o) =>
                          setShowResetPinModal(o as unknown as UserAccount)
                        }
                        onToggleStatus={(o) =>
                          handleToggleStatusGuarded(o as unknown as UserAccount)
                        }
                        onDelete={(o) => setOfficerToDelete(o as unknown as UserAccount)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Register button — above the tab bar */}
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <UserPlus className="size-5" />
                Register officer
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-5 pb-6 space-y-4 bg-[#090A0F] font-sans">
              <div className="flex flex-col gap-3 pb-3 border-b border-[#22263C]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-300 max-w-md">
                    Add officers, assign them to centres, and give new PINs.
                  </p>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white px-3.5 py-2 text-xs font-bold border border-white/10 transition shadow-md cursor-pointer shrink-0"
                  >
                    <UserPlus className="size-3.5 text-white" />
                    <span>Register officer</span>
                  </button>
                </div>

                {/* Requests — access & PIN reset review */}
                <RequestsPanel onChanged={() => loadDashboardData(true)} />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Search by name, phone, staff ID, or assigned centre..."
                      className="w-full rounded-xl border border-[#22263C] bg-[#11131F] py-2 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 font-sans"
                    />
                    {directorySearch && (
                      <button
                        onClick={() => setDirectorySearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="sm:hidden flex items-center justify-center gap-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white py-2.5 px-4 text-xs font-bold border border-white/10 transition shadow-md cursor-pointer w-full"
                  >
                    <UserPlus className="size-4 text-white" />
                    <span>+ Register Field Officer</span>
                  </button>
                </div>
              </div>

              {filteredDirectoryOfficers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-2">
                  <Users className="size-7 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    {directorySearch
                      ? 'No officers matched your search filter'
                      : 'No field officers registered yet'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Register a new field officer to assign an examination centre and PIN.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredDirectoryOfficers.map((officer) => {
                    return (
                      <div
                        key={officer.id}
                        className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#22263C] bg-[#0E111D] transition-all duration-200 hover:border-indigo-500/40"
                      >
                        <div className="space-y-3.5 p-4">
                          {/* Identity */}
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-[#2B355A] bg-gradient-to-br from-[#1E2B7B] to-[#12162B] text-sm font-bold text-white shadow-md">
                                {officer.photo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={officer.photo}
                                    alt={officer.name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  officer.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                )}
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="min-w-0 text-sm font-bold leading-snug break-words text-white">
                                  {officer.name}
                                </h3>
                                <span
                                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    officer.status === 'ACTIVE'
                                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                      : 'border border-rose-500/30 bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  <span
                                    className={`size-1.5 rounded-full ${
                                      officer.status === 'ACTIVE'
                                        ? 'animate-pulse bg-emerald-400'
                                        : 'bg-rose-400'
                                    }`}
                                  />
                                  <span>
                                    {officer.status === 'ACTIVE' ? 'Account active' : 'Blocked'}
                                  </span>
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {officer.isGroupLeader && (
                                  <span className="flex items-center gap-0.5 rounded-full border border-[#F6D300]/30 bg-[#F6D300]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#F6D300]">
                                    <Star className="size-2 fill-[#F6D300]" />
                                    <span>Leader</span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-xs text-slate-400 tabular-nums">
                                  <Phone className="size-3 shrink-0 text-slate-500" />
                                  <span>{formatGhanaPhone(officer.phone)}</span>
                                </span>
                                {officer.staffId && (
                                  <span className="flex items-center gap-1 rounded-md border border-[#22263C] bg-[#121626] px-1.5 py-0.5">
                                    <span className="text-[9px] font-sans uppercase tracking-wide text-slate-500">Staff ID</span>
                                    <span className="font-mono text-[10px] font-semibold text-slate-400">{officer.staffId}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                        {/* Assignment details */}
                        <div className="divide-y divide-[#1C2237] overflow-hidden rounded-xl border border-[#1E243A] bg-[#0A0D17] text-xs">
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#22263C] bg-[#121626]">
                              <Building2 className="size-3.5 text-sky-400" />
                            </span>
                            <span className="shrink-0 font-semibold text-slate-500">Centre</span>
                            <span
                              className={`ml-auto text-right font-medium leading-snug line-clamp-2 min-w-0 break-words ${
                                isOfficerUnassigned(officer) ? 'text-amber-400' : 'text-slate-200'
                              }`}
                              title={isOfficerUnassigned(officer) ? 'No centre yet' : officer.assignedCenter}
                            >
                              {isOfficerUnassigned(officer) ? 'No centre yet' : officer.assignedCenter}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#22263C] bg-[#121626]">
                              <Users className="size-3.5 text-indigo-400" />
                            </span>
                            <span className="shrink-0 font-semibold text-slate-500">Group</span>
                            <span className="ml-auto font-semibold text-slate-300">
                              {officer.group || 'Group 1'}
                            </span>
                          </div>
                        </div>

                        </div>

                        {/* Actions footer */}
                        <div className="mt-auto relative border-t border-[#1C2237] bg-[#0B0E18] p-2.5">
                          <div className="flex items-stretch gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectedOfficer(officer)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#22263C] bg-[#121626] py-2.5 px-2 text-[11px] font-semibold text-slate-300 transition cursor-pointer hover:border-slate-500/50 hover:bg-[#181D2E] hover:text-white"
                              title="View & edit officer profile & assignment"
                            >
                              <User className="size-3.5 text-slate-400 shrink-0" />
                              <span>Profile</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowResetPinModal(officer)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#22263C] bg-[#121626] py-2.5 px-2 text-[11px] font-semibold text-slate-300 transition cursor-pointer hover:border-slate-500/50 hover:bg-[#181D2E] hover:text-white"
                              title="Give the officer a new PIN"
                            >
                              <KeyRound className="size-3.5 text-[#F6D300] shrink-0" />
                              <span>Give new PIN</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenActionsOfficerId(openActionsOfficerId === officer.id ? null : officer.id)}
                              className="w-11 flex items-center justify-center rounded-lg border border-[#22263C] bg-[#121626] text-slate-300 transition cursor-pointer hover:border-slate-500/50 hover:bg-[#181D2E] hover:text-white"
                              aria-label="More actions"
                              aria-expanded={openActionsOfficerId === officer.id}
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </div>

                          {/* Overflow menu — Block and Delete live here */}
                          {openActionsOfficerId === officer.id && (
                            <>
                              <button
                                type="button"
                                aria-label="Close menu"
                                className="fixed inset-0 z-30 cursor-default"
                                onClick={() => setOpenActionsOfficerId(null)}
                              />
                              <div className="absolute right-2 bottom-full z-40 mb-1.5 w-52 overflow-hidden rounded-xl border border-[#22263C] bg-[#121629] shadow-2xl py-1 animate-in fade-in slide-in-from-bottom-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionsOfficerId(null)
                                    handleToggleStatusGuarded(officer)
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                                    officer.status === 'ACTIVE'
                                      ? 'text-rose-400 hover:bg-rose-500/10'
                                      : 'text-emerald-400 hover:bg-emerald-500/10'
                                  }`}
                                >
                                  {officer.status === 'ACTIVE' ? (
                                    <>
                                      <ShieldAlert className="size-4 shrink-0" />
                                      <span>Block access</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="size-4 shrink-0" />
                                      <span>Activate access</span>
                                    </>
                                  )}
                                </button>
                                <div className="my-1 border-t border-[#22263C]" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionsOfficerId(null)
                                    setOfficerToDelete(officer)
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  <Trash2 className="size-4 shrink-0" />
                                  <span>Delete officer…</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 3: EXAM CENTERS & GEOFENCES */}
          {/* ========================================================= */}
          {activeTab === 'centers' && (
            <>
            {/* ===== MOBILE (< lg) — compact cards, one FAB ===== */}
            <div className="lg:hidden relative flex-1 overflow-y-auto bg-[#090A0F] font-sans">
              <div className="p-4 space-y-3 pb-32">
                {/* Search */}
                <div className="relative">
                  <Search className="size-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={centerSearchQuery}
                    onChange={(e) => setCenterSearchQuery(e.target.value)}
                    placeholder="Search by centre name, code or district"
                    aria-label="Search centres"
                    className="w-full h-12 rounded-xl border border-[#22263C] bg-[#11131F] pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-400"
                  />
                </div>

                {/* Summary line + one status chip */}
                <div className="flex items-center gap-3 flex-wrap">
                  {centresNeedingAttention > 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300">
                      <span className="size-2 rounded-full bg-amber-400" />
                      {centresNeedingAttention} need{centresNeedingAttention === 1 ? 's' : ''} attention
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      All check-in areas clear
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    <span className="font-semibold text-white tabular-nums">{examCenters.length}</span>{' '}
                    {examCenters.length === 1 ? 'centre' : 'centres'} ·{' '}
                    <span className="font-semibold text-white tabular-nums">{assignedOfficerCount}</span>{' '}
                    assigned ·{' '}
                    <span className="font-semibold text-white tabular-nums">{verifiedOnSiteCount}</span>{' '}
                    at a centre
                  </span>
                </div>

                {/* Centre cards */}
                {filteredCenters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-8 text-center space-y-2">
                    <Building2 className="size-7 text-slate-500 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                      {centerSearchQuery
                        ? 'No centres matched your search'
                        : 'No examination centres registered yet'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Register a WAEC examination centre to monitor its check-in area.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredCenters.map((center, idx) => (
                      <MobileCenterCard
                        key={center.id || center.code}
                        index={idx + 1}
                        center={center}
                        atCentreCount={officersAtCentreByCode[center.code] || 0}
                        onFocus={handleCenterFocus}
                        onEdit={(c) => setCenterModalState({ mode: 'edit', center: c })}
                        onDelete={setCenterToDelete}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Register button — above the tab bar */}
              <button
                type="button"
                onClick={() => setCenterModalState({ mode: 'create' })}
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <Plus className="size-5" />
                Register centre
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-5 pb-6 space-y-4 sm:space-y-5 bg-[#090A0F] font-sans">
              <div className="flex flex-col gap-2 border-b border-[#22263C] pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="size-4.5 text-[#F6D300] shrink-0" />
                    <h2 className="text-base font-bold text-slate-100">Exam centres</h2>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {centresNeedingAttention > 0 ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs font-semibold text-amber-300">
                        <span className="size-2 rounded-full bg-amber-400" />
                        <span>
                          {centresNeedingAttention} need
                          {centresNeedingAttention === 1 ? 's' : ''} attention
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-400">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span>All check-in areas clear</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setCenterModalState({ mode: 'create' })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] text-white px-3.5 py-2 text-xs font-bold border border-white/10 transition shadow-md cursor-pointer shrink-0"
                    >
                      <Plus className="size-3.5 text-white" />
                      <span>Register centre</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-white tabular-nums">{examCenters.length}</span>{' '}
                  {examCenters.length === 1 ? 'centre' : 'centres'} ·{' '}
                  <span className="font-semibold text-white tabular-nums">{assignedOfficerCount}</span>{' '}
                  {assignedOfficerCount === 1 ? 'officer' : 'officers'} assigned ·{' '}
                  <span className="font-semibold text-white tabular-nums">{verifiedOnSiteCount}</span>{' '}
                  at a centre
                </p>
              </div>

              {/* Search & district filter — sits directly on the page, no card */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 relative">
                  <Search className="size-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={centerSearchQuery}
                    onChange={(e) => setCenterSearchQuery(e.target.value)}
                    placeholder="Search by centre name, code or district"
                    aria-label="Search centres"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0E111D] py-2.5 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-400 font-sans min-h-[44px]"
                  />
                  {centerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCenterSearchQuery('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="relative min-w-[170px]">
                  <Filter className="size-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <select
                    value={centerDistrictFilter}
                    onChange={(e) => setCenterDistrictFilter(e.target.value)}
                    aria-label="Filter by district"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0E111D] py-2.5 pl-8 pr-7 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-400 font-sans appearance-none cursor-pointer min-h-[44px]"
                  >
                    <option value="ALL">All districts</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Centers Cards Grid */}
              {examCenters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-2">
                  <Building2 className="size-7 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No examination centres yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Click &ldquo;Register centre&rdquo; to add a WAEC-approved spot and its check-in area.
                  </p>
                </div>
              ) : filteredCenters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-3">
                  <Building2 className="size-7 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No examination centres match your filters
                  </p>
                  <p className="text-xs text-slate-500">
                    Try adjusting your search query or reset the district filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCenterSearchQuery('')
                      setCenterDistrictFilter('ALL')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] text-xs font-semibold text-white transition cursor-pointer"
                  >
                    <span>Reset filters</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
                  {filteredCenters.map((center, index) => {
                    const hasOpenInc = (center.openIncidentsCount || 0) > 0
                    const atCentre = officersAtCentreByCode[center.code] || 0
                    const assigned = center.totalMonitors || 0
                    const radius = effectiveRadius(center.radius)
                    const isCustomRadius = radius !== defaultRadiusMeters
                    const menuId = center.id || center.code
                    return (
                      <div
                        key={center.code}
                        className="relative flex flex-col rounded-2xl border border-[#22263C] bg-[#11131F] hover:border-indigo-500/40 transition-all duration-200 p-4 sm:p-5 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="size-10 rounded-xl bg-[#1E2B7B]/60 border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] font-bold text-sm shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm sm:text-base text-white leading-snug break-words">
                                {center.name}
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Centre code{' '}
                                <span className="font-semibold text-slate-300 tabular-nums">
                                  {center.code}
                                </span>
                                {center.districtName ? (
                                  <>
                                    {' '}
                                    · {center.districtName}
                                  </>
                                ) : null}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold shrink-0 flex items-center gap-1.5 ${
                              hasOpenInc
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                hasOpenInc ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                            />
                            <span>{hasOpenInc ? 'Needs attention' : 'All clear'}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 pt-3 mt-3 border-t border-[#1E243A]">
                          <span className="font-semibold text-white tabular-nums">{assigned}</span>{' '}
                          {assigned === 1 ? 'officer' : 'officers'} assigned ·{' '}
                          <span className="font-semibold text-white tabular-nums">{atCentre}</span>{' '}
                          at the centre ·{' '}
                          <span className="font-semibold text-white tabular-nums">{radius}&nbsp;m</span>{' '}
                          check-in area{isCustomRadius ? ' (custom)' : ''}
                        </p>

                        {/* Actions: primary "Show on map" + ⋯ overflow menu */}
                        <div className="mt-auto relative flex items-stretch gap-2 pt-3">
                          <button
                            type="button"
                            onClick={() => handleCenterFocus(center)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[44px]"
                            title="Show this centre on the live map"
                          >
                            <MapPin className="size-3.5 text-white shrink-0" />
                            <span>Show on map</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setOpenCentreMenuId(openCentreMenuId === menuId ? null : menuId)}
                            className="w-11 flex items-center justify-center rounded-xl border border-[#22263C] bg-[#161B2E] text-slate-300 hover:text-white hover:border-slate-500/50 transition cursor-pointer"
                            aria-label="More actions"
                            aria-expanded={openCentreMenuId === menuId}
                          >
                            <MoreVertical className="size-4" />
                          </button>

                          {openCentreMenuId === menuId && (
                            <>
                              <button
                                type="button"
                                aria-label="Close menu"
                                className="fixed inset-0 z-30 cursor-default"
                                onClick={() => setOpenCentreMenuId(null)}
                              />
                              <div className="absolute right-0 bottom-full z-40 mb-1.5 w-56 overflow-hidden rounded-xl border border-[#22263C] bg-[#121629] shadow-2xl py-1 animate-in fade-in slide-in-from-bottom-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCentreMenuId(null)
                                    setCenterModalState({ mode: 'edit', center })
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
                                >
                                  <Pencil className="size-4 shrink-0 text-slate-400" />
                                  <span>Edit check-in area</span>
                                </button>
                                <div className="my-1 border-t border-[#22263C]" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCentreMenuId(null)
                                    setCenterToDelete(center)
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  <Trash2 className="size-4 shrink-0" />
                                  <span>Delete…</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 4: INCIDENT LOGS & AUDIT TRAIL */}
          {/* ========================================================= */}
          {activeTab === 'incidents' && (
            <>
            {/* ===== MOBILE (< lg) — strip, chips, flat activity, FAB ===== */}
            <div className="lg:hidden relative flex-1 overflow-y-auto bg-[#090A0F] font-sans">
              <div className="p-4 space-y-4 pb-32">
                {/* Subtitle + one status chip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">SOS alerts and what happened, in order.</p>
                  {unresolvedIncidents.length === 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      No open incidents
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-400">
                      <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {unresolvedIncidents.length} open
                    </span>
                  )}
                </div>

                {recordedIncidentsBlock}

                {activityHistoryBlock}
              </div>

              {/* Floating Log incident button — above the tab bar */}
              <button
                type="button"
                onClick={() => setShowLogIncidentModal(true)}
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <Plus className="size-5" />
                Log incident
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:block flex-1 overflow-y-auto p-5 pb-6 space-y-5 bg-[#090A0F] font-sans">
              <div className="border-b border-[#22263C] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-slate-400">SOS alerts and what happened, in order.</p>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {unresolvedIncidents.length > 0 ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-400">
                      <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>
                        {unresolvedIncidents.length} open
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span>No open incidents</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLogIncidentModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white px-3.5 py-2 text-xs font-bold shadow-md border border-white/10 transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Log incident</span>
                  </button>
                </div>
              </div>

              {recordedIncidentsBlock}

              {/* Activity history + safety summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                <div className="lg:col-span-2">{activityHistoryBlock}</div>
                {/* When an SOS comes in — the four things a controller actually does */}
                <div className="rounded-2xl border border-[#22263C] bg-[#111422] p-4 sm:p-5 space-y-3 shadow-md">
                  <h3 className="font-bold text-xs text-slate-300 tracking-wider">
                    Safety summary
                  </h3>
                  <div className="space-y-0 text-xs divide-y divide-[#1E243A] border-y border-[#1E243A]">
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Open incidents</span>
                      <span
                        className={`font-bold tabular-nums ${
                          incidentSummary.openIncidentsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {incidentSummary.openIncidentsCount}
                      </span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Check-in areas clear</span>
                      <span className="text-white font-bold tabular-nums">
                        {safeCentersCount} / {examCenters.length}
                      </span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-slate-400">Officers at centre</span>
                      <span className="text-white font-bold tabular-nums">
                        {verifiedOnSiteCount} of {deployedMonitorsCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0C0F17] border border-[#22263C] text-xs text-slate-400 space-y-1.5">
                    <p className="text-slate-100 font-semibold">When an SOS comes in</p>
                    <ol className="space-y-1 leading-snug">
                      <li><span className="text-slate-200 font-semibold">1.</span> Call the officer.</li>
                      <li><span className="text-slate-200 font-semibold">2.</span> Tap <span className="text-slate-200">I&apos;m on it</span>.</li>
                      <li><span className="text-slate-200 font-semibold">3.</span> Send help if needed.</li>
                      <li><span className="text-slate-200 font-semibold">4.</span> Mark <span className="text-slate-200">Problem fixed</span> and add a note.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 5: SAFETY CENTER */}
          {/* ========================================================= */}
          {activeTab === 'safety' && (
            <SafetyCenter
              session={session}
              onOpenHistory={() => setActiveTab('incidents')}
              onFeedback={setFeedback}
            />
          )}

          {/* ========================================================= */}
          {/* TAB 6: EXAMINATION TIMETABLE */}
          {/* ========================================================= */}
          {activeTab === 'timetable' && <TimetablePanel />}

          {/* ========================================================= */}
          {/* TAB 7: SYSTEM SETTINGS VIEW */}
          {/* ========================================================= */}
          {activeTab === 'settings' && (
            <SystemSettingsTab
              initialSettings={systemSettings}
              session={session}
              onSave={(saved) => {
                setSystemSettings(saved)
                loadDashboardData(true)
              }}
              onFeedback={setFeedback}
            />
          )}
        </main>

        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          sosCount={totalCriticalSosCount}
        />
      </div>

      {/* MODAL: REGISTER / PRE-PROVISION FIELD OFFICER */}
      <PreProvisionOfficerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handlePreProvisionOfficer}
        examCenters={examCenters}
      />

      {/* MODAL: RESET PIN */}
      <ResetPinModal
        officer={showResetPinModal}
        onClose={() => setShowResetPinModal(null)}
        onSave={handleSaveResetPin}
      />

      {/* MODAL: REGISTER / EDIT EXAM CENTER */}
      <ExamCenterModal
        isOpen={Boolean(centerModalState)}
        mode={centerModalState?.mode || 'create'}
        initialCenter={centerModalState?.center}
        districts={districts}
        defaultRadius={defaultRadiusMeters}
        onClose={() => setCenterModalState(null)}
        onSubmit={handleSaveExamCenter}
      />

      {/* MODAL: LOG NEW INCIDENT */}
      <LogIncidentModal
        isOpen={showLogIncidentModal}
        onClose={() => setShowLogIncidentModal(false)}
        onSubmit={handleCreateIncident}
        examCenters={examCenters}
        officers={officers}
        currentUserId={session?.userId || 'usr-admin-hq'}
      />

      {/* MODAL: BLOCK NEW-DEVICE ACCOUNT — in-app, never a native popup */}
      <ConfirmDialog
        open={blockAccountTarget !== null}
        title={`Block ${blockAccountTarget?.name ?? ''}?`}
        description={
          <>
            They will be signed out everywhere and will not be able to sign back in.
            You can restore access at any time from the Officers page.
          </>
        }
        confirmLabel="Block account"
        tone="danger"
        busy={blockAccountBusy}
        onConfirm={async () => {
          if (!blockAccountTarget) return
          setBlockAccountBusy(true)
          const ok = await runSecurityReview({
            action: 'block',
            targetUserId: blockAccountTarget.actorId,
            name: blockAccountTarget.name,
            logId: blockAccountTarget.logId,
          })
          setBlockAccountBusy(false)
          if (ok) setBlockAccountTarget(null)
        }}
        onCancel={() => setBlockAccountTarget(null)}
      />

      {/* MODAL: OFFICER DOSSIER (Inspected by Admin) */}
      {inspectedOfficer && (
        <ProfileModal
          isOpen={Boolean(inspectedOfficer)}
          onClose={() => setInspectedOfficer(null)}
          session={{
            userId: inspectedOfficer.id,
            staffId: inspectedOfficer.staffId,
            email: inspectedOfficer.email,
            name: inspectedOfficer.name,
            phone: inspectedOfficer.phone,
            role: inspectedOfficer.role,
            status: inspectedOfficer.status,
            region: inspectedOfficer.region,
            group: inspectedOfficer.group,
            isGroupLeader: inspectedOfficer.isGroupLeader,
            assignedCenter: inspectedOfficer.assignedCenter,
            assignedCenterCode: inspectedOfficer.assignedCenterCode,
            photo: inspectedOfficer.photo,
            bio: inspectedOfficer.bio,
            mustChangePassword: inspectedOfficer.mustChangePassword,
          }}
          onDutyStatus={inspectedOfficer.dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
          examCenters={examCenters.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          onSave={handleSaveOfficerProfile}
        />
      )}

      {/* MODAL: CONFIRM DELETE EXAMINATION CENTER */}
      {centerToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-center-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0F121E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="size-5.5" />
              </div>
              <div>
                <h3 id="delete-center-title" className="text-base font-bold text-white">
                  Delete {centerToDelete.name}? This can&apos;t be undone
                </h3>
                <p className="text-xs text-slate-400">
                  Permanently remove this centre and its check-in area
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <p className="font-semibold text-white">
                {centerToDelete.name} ({centerToDelete.code})
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed">
                This deletes the centre, unlinks all officer deployments and incidents from it, and removes the check-in area ({centerToDelete.radius} m). This can&apos;t be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCenterToDelete(null)}
                disabled={isDeletingRecord}
                className="px-4 py-2.5 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-300 hover:bg-[#202742] hover:text-white transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCenterConfirm}
                disabled={isDeletingRecord}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30 min-h-[44px]"
              >
                {isDeletingRecord ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Delete centre</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE FIELD OFFICER */}
      {officerToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-officer-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0F121E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="size-5.5" />
              </div>
              <div>
                <h3 id="delete-officer-title" className="text-base font-bold text-white">
                  Delete {officerToDelete.name.split(' ')[0]}? This can&apos;t be undone
                </h3>
                <p className="text-xs text-slate-400">
                  Permanently remove the officer and their records
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <p className="font-semibold text-white">
                {officerToDelete.name} ({formatGhanaPhone(officerToDelete.phone)})
              </p>
              <p className="text-[11px] text-slate-300">
                Staff ID: {officerToDelete.staffId || 'N/A'} • Assigned: {officerToDelete.assignedCenter || 'No centre yet'}
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed pt-1">
                This deletes the officer account, signs them out everywhere, removes their centre and shift assignments, and archives incident audit references. This can&apos;t be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOfficerToDelete(null)}
                disabled={isDeletingRecord}
                className="px-4 py-2.5 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-300 hover:bg-[#202742] hover:text-white transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOfficerConfirm}
                disabled={isDeletingRecord}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30 min-h-[44px]"
              >
                {isDeletingRecord ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Delete officer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: CONFIRM REVOKE ACCESS — destructive, locks the officer out */}
      {revokingOfficer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-officer-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0F121E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="size-5.5" />
              </div>
              <div>
                <h3 id="revoke-officer-title" className="text-base font-bold text-white">
                  Block officer access
                </h3>
                <p className="text-xs text-slate-400">
                  They will be unable to log in until access is restored
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <p className="font-semibold text-white">
                {revokingOfficer.name} ({formatGhanaPhone(revokingOfficer.phone)})
              </p>
              <p className="text-[11px] text-slate-300">
                Staff ID: {revokingOfficer.staffId || 'N/A'} • Assigned:{' '}
                {revokingOfficer.assignedCenter || 'No centre yet'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokingOfficer(null)}
                className="px-4 py-2.5 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-300 hover:bg-[#202742] hover:text-white transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const officer = revokingOfficer
                  setRevokingOfficer(null)
                  handleToggleStatus(officer)
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30 min-h-[44px]"
              >
                <ShieldAlert className="size-3.5" />
                <span>Block Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
