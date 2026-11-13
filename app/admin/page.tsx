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
  Radio,
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
} from 'lucide-react'
import type { UserAccount } from '@/lib/db'
import type { FleetOfficer, ExamCenter } from '@/components/admin/FleetMap'
import { AdminSidebar } from '@/components/admin/sidebar/AdminSidebar'
import { AdminTopNav } from '@/components/admin/header/AdminTopNav'
import { OfficerTelematicsDrawer } from '@/components/admin/inspector/OfficerTelematicsDrawer'
import { MobileBottomNav } from '@/components/admin/mobile/MobileBottomNav'
import { MobileTopBar } from '@/components/admin/mobile/MobileTopBar'
import { MobileOfficerCard } from '@/components/admin/directory/MobileOfficerCard'
import { MobileOfficerSheet } from '@/components/admin/inspector/MobileOfficerSheet'
import { MobileCenterCard } from '@/components/admin/centers/MobileCenterCard'
import { formatGhanaPhone } from '@/lib/phone'
import { SystemSettingsTab } from '@/components/admin/settings/SystemSettingsTab'
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
}

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  const [activeTab, setActiveTab] = useState<
    'map' | 'directory' | 'centers' | 'incidents' | 'settings'
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
  const [patrolDispatchedIds, setPatrolDispatchedIds] = useState<Record<string, boolean>>({})
  const [rosterSearch, setRosterSearch] = useState('')
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryFilter, setDirectoryFilter] = useState<
    'all' | 'active' | 'revoked' | 'nocentre'
  >('all')
  const [incidentFilter, setIncidentFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
  const [showAllActivity, setShowAllActivity] = useState(false)
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
  const [revokingOfficer, setRevokingOfficer] = useState<UserAccount | null>(null)
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)
  const [centerSearchQuery, setCenterSearchQuery] = useState('')
  const [centerDistrictFilter, setCenterDistrictFilter] = useState('ALL')

  const hasInitializedSelectionRef = useRef(false)
  const prevSosCountRef = useRef(0)

  const activeTabTitle = useMemo(() => {
    switch (activeTab) {
      case 'map':
        return 'Live Fleet Map'
      case 'directory':
        return 'Monitor Directory'
      case 'centers':
        return 'Exam Centers'
      case 'incidents':
        return 'Incident Logs'
      case 'settings':
        return 'Settings'
      default:
        return 'Live Fleet Map'
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
            if (!hasInitializedSelectionRef.current) {
              hasInitializedSelectionRef.current = true
              const sos = nextFleet.find((o) => o.status === 'SOS')
              return sos || nextFleet[0] || null
            }
            if (!prev) return null
            return nextFleet.find((o) => o.id === prev.id) || null
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
  const verifiedOnSiteCount = fleetOfficers.filter((o) => o.status === 'ON_SITE').length
  const onlineUnitsCount = fleetOfficers.filter((o) => o.isOnline).length

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
    setFeedback(`Surveillance grid locked onto ${center.name} (Code: ${center.code})`)
  }

  const handleDispatchPatrol = (incidentId: string) => {
    setPatrolDispatchedIds((prev) => ({ ...prev, [incidentId]: true }))
    setFeedback('EMERGENCY PATROL DISPATCHED! Dialing Police Command 191...')
    if (typeof window !== 'undefined') {
      window.open('tel:191')
    }
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
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback(`Failed to update status: ${err.error || 'Server error'}`)
      }
    } catch {
      setFeedback('Failed to update officer status.')
    }
  }

  // Revoke is destructive (it locks the officer out) → requires a confirm.
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
        paperName: updated.paperName,
        startTime: updated.startTime,
        endTime: updated.endTime,
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
        setFeedback(`Failed to delete center: ${data.error || 'Server error'}`)
        return
      }
      setFeedback(`Center ${centerToDelete.name} decommissioned successfully`)
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
      setFeedback(`Officer ${officerToDelete.name} decommissioned from roster`)
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
      throw new Error(data.error || 'Failed to save examination center')
    }

    setFeedback(
      isEdit
        ? `Updated geofence & center configuration for ${payload.name}`
        : `Registered new examination center ${payload.name} (${payload.code})`
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
    !off.assignedCenter || off.assignedCenter === 'Unassigned'

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

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (incidentFilter === 'OPEN') {
        return !['RESOLVED', 'CLOSED'].includes(inc.status)
      }
      if (incidentFilter === 'RESOLVED') {
        return ['RESOLVED', 'CLOSED'].includes(inc.status)
      }
      return true
    })
  }, [incidents, incidentFilter])

  const filteredAuditLogs = useMemo(() => {
    if (!auditOfficerFilterId) return auditLogs
    return auditLogs.filter(
      (log) => log.actorId === auditOfficerFilterId || log.entityId === auditOfficerFilterId
    )
  }, [auditLogs, auditOfficerFilterId])

  const adminDisplayName = session?.name || 'Regional Command'

  const filteredAuditOfficerName = useMemo(() => {
    if (!auditOfficerFilterId) return ''
    return (
      officers.find((o) => o.id === auditOfficerFilterId)?.name ||
      fleetOfficers.find((o) => o.id === auditOfficerFilterId)?.name ||
      auditOfficerFilterId
    )
  }, [auditOfficerFilterId, officers, fleetOfficers])


  // --- Incident blocks shared by the mobile + desktop layouts (defined once) ---
  const criticalSosCards = (
    <>
{/* Active Critical SOS Incident Cards */}
              {criticalSosIncidents.length > 0 && (
                <div className="space-y-3">
                  {criticalSosIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-2xl border border-[#EF4444]/80 bg-gradient-to-br from-rose-950/40 via-[#14121F] to-[#0C0F17] p-4 sm:p-5 space-y-4 shadow-2xl"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="size-11 rounded-xl bg-[#EF4444] text-white flex items-center justify-center shadow-lg shadow-rose-950 shrink-0">
                            <AlertTriangle className="size-6 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-[#EF4444] px-2.5 py-0.5 text-[10px] font-black text-white tracking-wider">
                                CRITICAL SOS
                              </span>
                              <span className="text-xs font-sans text-rose-300 font-semibold">
                                {inc.incidentNumber}
                              </span>
                            </div>
                            <h3 className="font-bold text-base sm:text-lg text-white mt-0.5">
                              {inc.reporterName} — {inc.centerName}
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleFocusIncidentLocation(inc)}
                            className="px-3 py-2 rounded-xl bg-[#11131F] hover:bg-[#1A1F36] border border-[#22263C] text-xs font-bold text-slate-200 transition cursor-pointer"
                          >
                            Focus on Map
                          </button>
                          <button
                            onClick={() => handleUpdateIncidentStatus(inc.id, 'RESOLVED')}
                            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition cursor-pointer"
                          >
                            Resolve Alert
                          </button>
                          <button
                            onClick={() => handleDispatchPatrol(inc.id)}
                            className="px-3.5 py-2 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Phone className="size-3.5" />
                            <span>
                              {patrolDispatchedIds[inc.id]
                                ? 'Dispatched (191)'
                                : 'Call Emergency (191)'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#0A0D17]/90 border border-[#22263C] text-xs text-slate-200">
                        <span className="text-slate-400 font-semibold">Incident Report: </span>
                        <span>{inc.description}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-300">
                        <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                          <span className="text-slate-400 block text-[11px] font-medium">
                            Device Battery
                          </span>
                          <div className="text-[#EF4444] font-bold text-sm mt-0.5 flex items-center gap-1">
                            <Battery className="size-3.5" />
                            <span>
                              {typeof inc.reporterBattery === 'number'
                                ? `${inc.reporterBattery}%`
                                : '--%'}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                          <span className="text-slate-400 block text-[11px] font-medium">
                            Contact Phone
                          </span>
                          <div className="text-white font-sans font-bold text-sm mt-0.5">
                            {inc.reporterPhone || 'N/A'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                          <span className="text-slate-400 block text-[11px] font-medium">
                            Reported Time
                          </span>
                          <div className="text-white font-sans font-bold text-sm mt-0.5">
                            {inc.reportedTimeFormatted || 'Just now'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                          <span className="text-slate-400 block text-[11px] font-medium">
                            Center Proximity
                          </span>
                          <div className="text-emerald-400 font-bold text-sm mt-0.5">
                            {typeof inc.reporterDistance === 'number'
                              ? inc.reporterDistance >= 1000
                                ? `${(inc.reporterDistance / 1000).toFixed(1)} km`
                                : `${inc.reporterDistance} m`
                              : 'No telemetry'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
    </>
  )

  const recordedIncidentsBlock = (
    <>
{/* All Incidents Workflow Table / List */}
              <div className="rounded-2xl border border-[#22263C] bg-[#11131F] p-4 sm:p-5 space-y-3.5 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-sans">
                    Recorded Incidents ({filteredIncidents.length})
                  </h3>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(['ALL', 'OPEN', 'RESOLVED'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setIncidentFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                          incidentFilter === tab
                            ? 'bg-[#1E2B7B] text-white border border-sky-400/30'
                            : 'text-slate-400 hover:text-white bg-[#0A0D17]'
                        }`}
                      >
                        {tab === 'ALL'
                          ? `All (${incidents.length})`
                          : tab === 'OPEN'
                          ? `Open (${unresolvedIncidents.length})`
                          : `Resolved (${incidents.length - unresolvedIncidents.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredIncidents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#22263C] p-6 text-center text-xs text-slate-500">
                    No incidents recorded in this filter view.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredIncidents.map((inc) => {
                      const isClosed = ['RESOLVED', 'CLOSED'].includes(inc.status)
                      return (
                        <div
                          key={inc.id}
                          className="rounded-xl bg-[#0C0F1D] border border-[#22263C] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  inc.severity === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : inc.severity === 'HIGH'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                }`}
                              >
                                {inc.severity} · {inc.category}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {inc.incidentNumber}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400">
                                {inc.reportedTimeFormatted}
                              </span>
                            </div>
                            <div className="font-bold text-white text-sm">{inc.title}</div>
                            <div className="text-slate-300">{inc.description}</div>
                            <div className="text-[11px] text-slate-400">
                              Center: <span className="text-slate-200">{inc.centerName}</span> ·
                              Reported by:{' '}
                              <span className="text-slate-200">{inc.reporterName}</span>
                              {inc.resolutionNotes ? ` · Note: ${inc.resolutionNotes}` : ''}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                isClosed
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {inc.status}
                            </span>

                            {!isClosed && inc.status === 'REPORTED' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateIncidentStatus(inc.id, 'INVESTIGATING')
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[#161B2E] hover:bg-[#202742] border border-[#22263C] text-sky-300 font-semibold transition cursor-pointer"
                              >
                                Investigate
                              </button>
                            )}
                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => handleUpdateIncidentStatus(inc.id, 'RESOLVED')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold transition cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
    </>
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
            activeCount={
              activeTab === 'directory'
                ? officers.filter((o) => o.status === 'ACTIVE').length
                : deployedMonitorsCount
            }
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
              ? 'Directory'
              : activeTab === 'centers'
              ? 'Centres'
              : activeTab === 'incidents'
              ? 'Incidents'
              : 'Settings'
          }
          badge={
            activeTab === 'map'
              ? { label: `${deployedMonitorsCount} active`, tone: 'ok' as const }
              : activeTab === 'directory'
              ? { label: `${officers.length} officers` }
              : activeTab === 'centers'
              ? { label: `${examCenters.length} centres` }
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
                  activeSectorName={`${session?.region || 'Ashanti'} Telematics Grid`}
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

                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      { id: 'all', label: `All ${directoryCounts.all}` },
                      { id: 'active', label: `Active ${directoryCounts.active}` },
                      { id: 'revoked', label: `Revoked ${directoryCounts.revoked}` },
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
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <UserPlus className="size-5" />
                Register officer
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-5 pb-6 space-y-4 bg-[#090A0F] font-sans">
              <div className="flex flex-col gap-3 pb-3 border-b border-[#22263C]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[#1E2B7B]/60 border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] shrink-0">
                      <Users className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Field Officers Directory</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          {filteredDirectoryOfficers.length} Officers
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage field personnel, exam center assignments, and login credentials
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white px-3.5 py-2 text-xs font-bold border border-white/10 transition shadow-md cursor-pointer shrink-0"
                  >
                    <UserPlus className="size-3.5 text-white" />
                    <span>+ Register Officer</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Search by name, phone, staff ID, or assigned center..."
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
                    Register a new field officer to assign an examination center and PIN.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredDirectoryOfficers.map((officer) => {
                    return (
                      <div
                        key={officer.id}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[#0E111D] transition-all duration-200 ${
                          officer.status === 'ACTIVE'
                            ? 'border-[#22263C] hover:border-emerald-500/40 hover:shadow-[0_18px_45px_-22px_rgba(16,185,129,0.35)]'
                            : 'border-rose-950/70 hover:border-rose-500/40 hover:shadow-[0_18px_45px_-22px_rgba(244,63,94,0.3)]'
                        }`}
                      >
                        {/* Status accent strip */}
                        <div
                          className={`h-0.5 w-full shrink-0 ${
                            officer.status === 'ACTIVE'
                              ? 'bg-gradient-to-r from-emerald-400 via-emerald-500/40 to-transparent'
                              : 'bg-gradient-to-r from-rose-500 via-rose-500/40 to-transparent'
                          }`}
                        />

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
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0E111D] ${
                                  officer.status === 'ACTIVE'
                                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                    : 'bg-rose-400'
                                }`}
                              />
                              {officer.isGroupLeader && (
                                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-[#F6D300] text-black shadow">
                                  <Star className="size-2.5 fill-black" />
                                </span>
                              )}
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
                                    {officer.status === 'ACTIVE' ? 'Active' : 'Revoked'}
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
                                  <span className="rounded-md border border-[#22263C] bg-[#121626] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                    {officer.staffId}
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
                            <span className="shrink-0 font-semibold text-slate-500">Center</span>
                            <span
                              className={`ml-auto truncate text-right font-medium ${
                                officer.assignedCenter && officer.assignedCenter !== 'Unassigned'
                                  ? 'text-slate-200'
                                  : 'text-amber-400'
                              }`}
                              title={officer.assignedCenter || 'Unassigned'}
                            >
                              {officer.assignedCenter || 'Unassigned'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#22263C] bg-[#121626]">
                              <Users className="size-3.5 text-indigo-400" />
                            </span>
                            <span className="shrink-0 font-semibold text-slate-500">Group</span>
                            <span className="ml-auto font-bold text-sky-400">
                              {officer.group || 'Group 1'}
                            </span>
                          </div>
                        </div>

                        </div>

                        {/* Actions footer */}
                        <div className="mt-auto grid grid-cols-4 gap-1.5 border-t border-[#1C2237] bg-[#0B0E18] p-3">
                          <button
                            type="button"
                            onClick={() => setInspectedOfficer(officer)}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#22263C] bg-[#121626] py-2 px-1 text-[11px] font-semibold text-slate-300 transition cursor-pointer hover:border-slate-500/50 hover:bg-[#181D2E] hover:text-white"
                            title="View & Edit Officer Profile & Assignment"
                          >
                            <User className="size-3.5 text-slate-400 shrink-0" />
                            <span>Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowResetPinModal(officer)}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#22263C] bg-[#121626] py-2 px-1 text-[11px] font-semibold text-slate-300 transition cursor-pointer hover:border-slate-500/50 hover:bg-[#181D2E] hover:text-white"
                            title="Reset 4-Digit Field PIN"
                          >
                            <KeyRound className="size-3.5 text-[#F6D300] shrink-0" />
                            <span>PIN</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatusGuarded(officer)}
                            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-[11px] font-bold transition cursor-pointer border ${
                              officer.status === 'ACTIVE'
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                            }`}
                            title={officer.status === 'ACTIVE' ? 'Revoke Security Access' : 'Activate Security Access'}
                          >
                            {officer.status === 'ACTIVE' ? (
                              <>
                                <ShieldAlert className="size-3.5 shrink-0" />
                                <span>Revoke</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="size-3.5 shrink-0" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfficerToDelete(officer)}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 py-2 px-1 text-[11px] font-semibold text-rose-400 transition cursor-pointer hover:bg-rose-900/40 hover:text-rose-300"
                            title="Decommission Field Officer"
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                            <span>Delete</span>
                          </button>
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
                    placeholder="Search name or code"
                    aria-label="Search centres"
                    className="w-full h-12 rounded-xl border border-[#22263C] bg-[#11131F] pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-400"
                  />
                </div>

                {/* Summary strip */}
                <div className="flex items-center gap-3 flex-wrap">
                  {unresolvedIncidents.length === 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      {examCenters.length} of {examCenters.length} geofences clear
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-status-sos/30 bg-status-sos/10 px-3.5 py-2 text-xs font-semibold text-status-sos">
                      <span className="size-2 rounded-full bg-status-sos animate-pulse" />
                      {unresolvedIncidents.length} open incidents
                    </span>
                  )}
                  <span className="text-xs text-slate-500 tabular-nums">
                    {incidentSummary.breachCount} breaches logged
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
                      Register a WAEC examination centre to monitor its geofence.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredCenters.map((center, idx) => (
                      <MobileCenterCard
                        key={center.id || center.code}
                        index={idx + 1}
                        center={center}
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
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <Plus className="size-5" />
                Register centre
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-5 pb-6 space-y-4 sm:space-y-5 bg-[#090A0F] font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#22263C] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Building2 className="size-4.5 text-[#F6D300]" />
                    <span>Examination Centers & Geofences</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Default {defaultRadiusMeters}m perimeter per centre with live telematics sync
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                      unresolvedIncidents.length > 0
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full animate-pulse ${
                        unresolvedIncidents.length > 0 ? 'bg-rose-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span>
                      {unresolvedIncidents.length > 0
                        ? `${unresolvedIncidents.length} Open Incident${unresolvedIncidents.length > 1 ? 's' : ''}`
                        : `All ${examCenters.length} Geofences Operational`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCenterModalState({ mode: 'create' })}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] text-white px-3.5 py-2 text-xs font-bold border border-white/10 transition shadow-md cursor-pointer shrink-0"
                  >
                    <Plus className="size-3.5 text-white" />
                    <span>Register Center</span>
                  </button>
                </div>
              </div>

              {/* Live Summary Bento Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                <div className="md:col-span-2 rounded-2xl border border-[#22263C] bg-gradient-to-br from-[#161D3A]/60 via-[#101426] to-[#0B0D17] p-4 sm:p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                        {session?.region || 'Ashanti'} Examination Zone
                      </span>
                      <h3 className="text-lg font-bold text-white mt-0.5">
                        Regional Operations Coverage
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        Live GPS telemetry monitoring {examCenters.length} registered examination center
                        {examCenters.length === 1 ? '' : 's'} with geofenced check-in verification.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0C0F17]/80 border border-[#22263C] px-3.5 py-2 rounded-xl text-xs shrink-0">
                      <ShieldCheck
                        className={`size-4 ${
                          incidentSummary.openIncidentsCount === 0
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <div>
                        <div
                          className={`font-bold ${
                            incidentSummary.openIncidentsCount === 0
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {safeCentersCount} / {examCenters.length} Clear
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {incidentSummary.breachCount} Geofence Breaches Logged
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-[#22263C]/80 relative z-10">
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Monitored Centers
                      </span>
                      <span className="text-base sm:text-lg font-bold text-white mt-0.5 block">
                        {examCenters.length} Centers
                      </span>
                    </div>
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Deployed Personnel
                      </span>
                      <span className="text-base sm:text-lg font-bold text-[#F6D300] mt-0.5 block">
                        {examCenters.reduce((acc, c) => acc + c.totalMonitors, 0)} Officers
                      </span>
                    </div>
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Default Perimeter
                      </span>
                      <span className="text-base sm:text-lg font-bold text-sky-400 mt-0.5 block">
                        {systemSettings.geofenceRadius} Radius
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#22263C] bg-[#111422] p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Telemetry Sync
                      </span>
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">Live Sensor Network</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300 py-1.5 border-b border-[#1E243A]">
                      <span className="text-slate-400">Active GPS Feeds:</span>
                      <span className="font-semibold text-emerald-400">
                        {onlineUnitsCount} / {deployedMonitorsCount} Online
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 py-1.5 border-b border-[#1E243A]">
                      <span className="text-slate-400">Verified On-Site:</span>
                      <span className="font-semibold text-white">
                        {verifiedOnSiteCount} Officers
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 py-1.5">
                      <span className="text-slate-400">Automatic Poll:</span>
                      <span className="font-semibold text-sky-400">
                        {systemSettings.locationRefreshInterval}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('map')}
                    className="w-full py-2 px-3 rounded-xl bg-[#1E2B7B]/70 hover:bg-[#1E2B7B] border border-white/10 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MapPin className="size-3.5 text-indigo-300" />
                    <span>View All On Map</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar for Exam Centers */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#101423] p-3 rounded-2xl border border-[#22263C]">
                <div className="flex-1 relative">
                  <Search className="size-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={centerSearchQuery}
                    onChange={(e) => setCenterSearchQuery(e.target.value)}
                    placeholder="Search center name, code (e.g. 050102), or district..."
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] py-2.5 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 font-sans min-h-[44px]"
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

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[160px]">
                    <Filter className="size-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                    <select
                      value={centerDistrictFilter}
                      onChange={(e) => setCenterDistrictFilter(e.target.value)}
                      className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] py-2.5 pl-8 pr-7 text-xs text-slate-200 focus:outline-hidden focus:border-sky-400 font-sans appearance-none cursor-pointer min-h-[44px]"
                    >
                      <option value="ALL">All Districts ({examCenters.length})</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1.5 rounded-xl bg-[#090A0F] border border-[#1E243A] shrink-0 whitespace-nowrap">
                    {filteredCenters.length} of {examCenters.length}
                  </span>
                </div>
              </div>

              {/* Centers Cards Grid */}
              {examCenters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-2">
                  <Building2 className="size-7 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No examination centers found in database
                  </p>
                  <p className="text-xs text-slate-500">
                    Click &ldquo;Register Center&rdquo; to add an examination venue and geofence.
                  </p>
                </div>
              ) : filteredCenters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-3">
                  <Building2 className="size-7 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No examination centers match your filters
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
                    <span>Reset Filters</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
                  {filteredCenters.map((center, index) => {
                    const hasOpenInc = (center.openIncidentsCount || 0) > 0
                    return (
                      <div
                        key={center.code}
                        className="rounded-2xl border border-[#22263C] bg-[#11131F] hover:border-[#38bdf8]/40 transition-all duration-200 p-4 sm:p-5 space-y-3.5 shadow-md flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-xl bg-[#1E2B7B]/60 border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] font-bold text-sm shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                                {center.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5 text-xs">
                                <span className="text-sky-400 font-mono font-bold">{center.code}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400 truncate">
                                  {center.districtName || 'Kumasi Metro'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold shrink-0 flex items-center gap-1.5 ${
                              hasOpenInc
                                ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                                : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full animate-pulse ${
                                hasOpenInc ? 'bg-rose-400' : 'bg-emerald-400'
                              }`}
                            />
                            <span>{hasOpenInc ? 'ALERT ACTIVE' : 'ACTIVE GEOFENCE'}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#1E243A]">
                          <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                            <span className="text-slate-400 text-[11px] block">
                              Perimeter Boundary:
                            </span>
                            <div className="text-white font-bold text-sm mt-0.5 flex items-center gap-1">
                              <Radio className="size-3 text-sky-400 shrink-0" />
                              <span>{center.radius}m Radius</span>
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                            <span className="text-slate-400 text-[11px] block">
                              Assigned / On-Site:
                            </span>
                            <div className="text-[#F6D300] font-bold text-sm mt-0.5 flex items-center gap-1">
                              <Users className="size-3 text-[#F6D300] shrink-0" />
                              <span>
                                {center.onSiteMonitors || 0} / {center.totalMonitors} Officers
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                            <span className="text-slate-400 text-[11px] block">
                              GPS Datum:
                            </span>
                            <div className="text-slate-200 font-mono text-xs mt-0.5 font-medium truncate">
                              {center.lat.toFixed(4)}° {center.lat >= 0 ? 'N' : 'S'},{' '}
                              {Math.abs(center.lng).toFixed(4)}° {center.lng >= 0 ? 'E' : 'W'}
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                            <span className="text-slate-400 text-[11px] block">
                              Perimeter Security:
                            </span>
                            <div
                              className={`font-bold text-xs mt-0.5 flex items-center gap-1 ${
                                hasOpenInc ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {hasOpenInc ? (
                                <AlertTriangle className="size-3 shrink-0" />
                              ) : (
                                <ShieldCheck className="size-3 shrink-0" />
                              )}
                              <span>
                                {hasOpenInc
                                  ? `${center.openIncidentsCount} Open Alert${
                                      (center.openIncidentsCount || 0) > 1 ? 's' : ''
                                    }`
                                  : 'Nominal (0 Alerts)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Responsive HCI 3-action buttons with >= 44px touch targets */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCenterFocus(center)}
                            className="py-2.5 px-3 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-white/10 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[44px]"
                            title="Focus center on fleet map"
                          >
                            <MapPin className="size-3.5 text-white shrink-0" />
                            <span>Focus Map</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCenterModalState({ mode: 'edit', center })}
                            className="py-2.5 px-3 rounded-xl bg-[#161B2E] hover:bg-[#202742] border border-[#22263C] text-xs font-semibold text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                            title="Edit center coordinates or boundary"
                          >
                            <Pencil className="size-3.5 text-sky-400 shrink-0" />
                            <span>Edit Boundary</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCenterToDelete(center)}
                            className="py-2.5 px-3 rounded-xl bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/30 text-xs font-semibold text-rose-400 hover:text-rose-300 transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                            title="Decommission Examination Center"
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                            <span>Delete</span>
                          </button>
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
                {/* Status strip */}
                {unresolvedIncidents.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                    <CheckCircle2 className="size-6 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-emerald-400">No open incidents</div>
                      <div className="text-xs text-emerald-400/70">All stations nominal</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#EF4444]/40 bg-status-sos/10 p-4 flex items-center gap-3">
                    <Siren className="size-6 text-status-sos shrink-0 animate-pulse" />
                    <div>
                      <div className="text-sm font-bold text-status-sos">
                        {unresolvedIncidents.length} open incident
                        {unresolvedIncidents.length > 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-red-100/75">Emergency response required</div>
                    </div>
                  </div>
                )}

                {criticalSosCards}
                {recordedIncidentsBlock}

                {/* Recent activity — flat list, no inner scroll */}
                <div>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500">
                      Recent activity
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllActivity((v) => !v)}
                      className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
                    >
                      {showAllActivity
                        ? 'Show less'
                        : `View full audit log (${filteredAuditLogs.length})`}
                    </button>
                  </div>
                  {filteredAuditLogs.length === 0 ? (
                    <div className="mt-2 rounded-2xl border border-dashed border-[#22263C] p-6 text-center text-xs text-slate-500">
                      No operational audit events recorded yet.
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-[#22263C] bg-[#11131F] overflow-hidden divide-y divide-[#1E243A]">
                      {(showAllActivity
                        ? filteredAuditLogs
                        : filteredAuditLogs.slice(0, 8)
                      ).map((log) => {
                        const isCrit = [
                          'SOS_TRIGGERED',
                          'GEOFENCE_BREACH',
                          'USER_REVOKED',
                        ].includes(log.action)
                        const isOk = [
                          'CHECK_IN_LOGGED',
                          'SOS_STAND_DOWN',
                          'INCIDENT_RESOLVED',
                          'USER_RESTORED',
                        ].includes(log.action)
                        const dot = isCrit
                          ? 'bg-status-sos shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                          : isOk
                          ? 'bg-status-ok'
                          : 'bg-sky-400'
                        return (
                          <div key={log.id} className="flex items-center gap-3 px-3.5 py-3">
                            <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                            <span className="text-[11px] font-semibold tabular-nums text-slate-500 w-10 shrink-0">
                              {log.timeFormatted || '--:--'}
                            </span>
                            <span className="text-xs text-slate-200 leading-snug min-w-0">
                              {log.details?.message ||
                                `${log.actorName} — ${log.action.replace(/_/g, ' ')}`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Log incident button — above the tab bar */}
              <button
                type="button"
                onClick={() => setShowLogIncidentModal(true)}
                className="fixed bottom-24 right-4 z-30 h-14 flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-6 text-base font-semibold text-white shadow-lg shadow-indigo-950/50 transition cursor-pointer"
              >
                <Plus className="size-5" />
                Log incident
              </button>
            </div>

            {/* ===== DESKTOP (lg+) — existing console layout ===== */}
            <div className="hidden lg:block flex-1 overflow-y-auto p-5 pb-6 space-y-5 bg-[#090A0F] font-sans">
              <div className="border-b border-[#22263C] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Siren className="size-4.5 text-[#EF4444]" />
                    <span>Security & Incident Logs</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time emergency SOS alerts, incident workflows, and operational audit trail
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {totalCriticalSosCount > 0 ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-400">
                      <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                      <span>
                        {totalCriticalSosCount} Active SOS Alert
                        {totalCriticalSosCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <span>All Stations Nominal</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLogIncidentModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-md border border-white/10 transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Log Incident</span>
                  </button>
                </div>
              </div>

              {criticalSosCards}

              {recordedIncidentsBlock}

              {/* Bento Row: Live Audit Trail + Security Readiness */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                <div className="lg:col-span-2 rounded-2xl border border-[#22263C] bg-[#11131F] p-4 sm:p-5 space-y-3.5 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-sans">
                      Audit Trail & Telematics Timeline
                    </h3>
                    <div className="flex items-center gap-2">
                      {auditOfficerFilterId && (
                        <button
                          type="button"
                          onClick={() => setAuditOfficerFilterId(null)}
                          className="text-[11px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer"
                        >
                          <span>Officer: {filteredAuditOfficerName}</span>
                          <X className="size-3" />
                        </button>
                      )}
                      <span className="text-[11px] text-slate-400 font-sans">
                        Recent Activity ({filteredAuditLogs.length})
                      </span>
                    </div>
                  </div>

                  {filteredAuditLogs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#22263C] p-6 text-center text-xs text-slate-500">
                      No operational audit events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {filteredAuditLogs.map((log) => {
                        const isCrit = [
                          'SOS_TRIGGERED',
                          'GEOFENCE_BREACH',
                          'USER_REVOKED',
                        ].includes(log.action)
                        const isOk = [
                          'CHECK_IN_LOGGED',
                          'SOS_STAND_DOWN',
                          'INCIDENT_RESOLVED',
                          'USER_RESTORED',
                        ].includes(log.action)

                        const badgeClass = isCrit
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : isOk
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-sky-400 bg-sky-500/10 border-sky-500/30'

                        const timeColor = isCrit
                          ? 'text-[#EF4444]'
                          : isOk
                          ? 'text-emerald-400'
                          : 'text-amber-400'

                        return (
                          <div
                            key={log.id}
                            className={`p-3 rounded-xl bg-[#0C0F1D] border flex items-center justify-between gap-2 ${
                              isCrit ? 'border-rose-500/30' : 'border-[#22263C]'
                            }`}
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <span
                                className={`${timeColor} font-sans font-bold shrink-0 tabular-nums`}
                              >
                                [{log.timeFormatted || '--:--'}]
                              </span>
                              <span className="text-slate-200 leading-snug">
                                {log.details?.message ||
                                  `${log.actorName} — ${log.action.replace(/_/g, ' ')}`}
                              </span>
                            </div>
                            <span
                              className={`font-bold shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}
                            >
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Live Security Network Status */}
                <div className="rounded-2xl border border-[#22263C] bg-[#111422] p-4 sm:p-5 space-y-4 shadow-md flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-sans">
                      Security Network Status
                    </h3>
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Station Verification:</span>
                        <span className="text-emerald-400 font-bold">
                          {safeCentersCount} / {examCenters.length} Centers Clear
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Officers On-Site:</span>
                        <span className="text-sky-400 font-bold">
                          {verifiedOnSiteCount} / {deployedMonitorsCount} On-Site
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Open Incidents:</span>
                        <span
                          className={`font-bold ${
                            incidentSummary.openIncidentsCount > 0
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {incidentSummary.openIncidentsCount} Open ({incidentSummary.breachCount}{' '}
                          Breaches)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-slate-300">
                    <span className="text-sky-400 font-bold block mb-1">
                      WAEC Incident Protocol:
                    </span>
                    <span>
                      Emergency SOS dispatches and status transitions are recorded
                      immediately and kept in the full operator audit history.
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 5: SYSTEM SETTINGS VIEW */}
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
            paperName: inspectedOfficer.paperName,
            startTime: inspectedOfficer.startTime,
            endTime: inspectedOfficer.endTime,
          }}
          onDutyStatus={inspectedOfficer.dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
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
                  Decommission Center
                </h3>
                <p className="text-xs text-slate-400">
                  Permanent removal from central examination registry
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <p className="font-semibold text-white">
                {centerToDelete.name} ({centerToDelete.code})
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed">
                Decommissioning will dissolve this geofence ({centerToDelete.radius}m perimeter) and unlink all active officer deployments and incidents from this venue. This action is permanently audited.
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
                    <span>Decommissioning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Confirm Decommission</span>
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
                  Decommission Field Officer
                </h3>
                <p className="text-xs text-slate-400">
                  Permanently purge credentials and officer record
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <p className="font-semibold text-white">
                {officerToDelete.name} ({formatGhanaPhone(officerToDelete.phone)})
              </p>
              <p className="text-[11px] text-slate-300">
                Staff ID: {officerToDelete.staffId || 'N/A'} • Assigned: {officerToDelete.assignedCenter || 'Unassigned'}
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed pt-1">
                This will delete the officer account, revoke active login sessions, remove exam center shift assignments, and archive incident audit references. This action is irreversible.
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
                    <span>Decommissioning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Confirm Decommission</span>
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
                  Revoke officer access
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
                {revokingOfficer.assignedCenter || 'Unassigned'}
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
                <span>Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
