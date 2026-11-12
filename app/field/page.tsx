'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CheckCircle2, AlertTriangle, Radio, Building2, X } from 'lucide-react'
import { getClientSession, signOutEverywhere, SessionData } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { EmergencySosModal } from '@/components/emergency/EmergencySosModal'
import { FieldHeader } from '@/components/field/FieldHeader'
import { StatusCard, StatusCardState } from '@/components/field/StatusCard'
import { VenueCard } from '@/components/field/VenueCard'
import { PaperTiles, PaperAssignment } from '@/components/field/PaperTiles'
import { DayTimeline, TimelineItem } from '@/components/field/DayTimeline'
import { CheckInButton } from '@/components/field/CheckInButton'
import { SosHoldButton } from '@/components/field/SosHoldButton'
import { ReportButton } from '@/components/field/ReportButton'
import { OfflineBanner } from '@/components/field/OfflineBanner'
import { isFeatureEnabled } from '@/lib/features'

const FieldMap = dynamic(() => import('@/components/field/FieldMap'), {
  ssr: false,
  loading: () => (
    <div className="size-full flex flex-col items-center justify-center bg-[#0C101A] text-slate-400 gap-2.5 rounded-2xl border border-[#1A2035]">
      <div className="size-7 border-2 border-[#1E2B7B] border-t-[#F6D300] rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-400">Loading Map View...</span>
    </div>
  ),
})

interface FieldVenue {
  name: string
  code: string
  zone: string
  region: string
  lat: number
  lng: number
  radiusMeters: number
}

interface FieldAssignmentState {
  venue: FieldVenue | null
  paper: PaperAssignment | null
  timeline: TimelineItem[]
}

const QUEUED_SOS_KEY = 'waec_mos_queued_sos'

export default function FieldPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  // Geofence & GPS States
  const [gpsMode, setGpsMode] = useState<'live' | 'mock-inside' | 'mock-outside'>('live')
  const [liveCoords, setLiveCoords] = useState<{
    lat: number
    lng: number
    accuracy: number
    speedKmh: number
  } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied'>('searching')
  const [testVenueOverride, setTestVenueOverride] = useState<{
    lat: number
    lng: number
    name: string
  } | null>(null)

  // Live DB Operational States
  const [isAssignmentLoading, setIsAssignmentLoading] = useState<boolean>(true)
  const [assignment, setAssignment] = useState<FieldAssignmentState>({
    venue: null,
    paper: null,
    timeline: [],
  })
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false)
  const [checkInTimestamp, setCheckInTimestamp] = useState<string>('')
  const [shiftSeconds, setShiftSeconds] = useState<number>(0)
  const [isSosActive, setIsSosActive] = useState<boolean>(false)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(10000)

  // UI States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false)
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false)
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [queuedSosCount, setQueuedSosCount] = useState<number>(0)
  const [isDesktop, setIsDesktop] = useState<boolean>(true)
  const [deviceGpsActive, setDeviceGpsActive] = useState<boolean>(false)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [fieldFeedback, setFieldFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const initialSosPromptShownRef = useRef<boolean>(false)
  const initialTelemetrySentRef = useRef<string>('')

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setFieldFeedback({ type, message })
  }, [])

  // Auto-dismiss toast after 4.5s
  useEffect(() => {
    if (!fieldFeedback) return
    const t = setTimeout(() => setFieldFeedback(null), 4500)
    return () => clearTimeout(t)
  }, [fieldFeedback])

  // Verify authentication on mount
  useEffect(() => {
    getClientSession().then((s) => {
      if (!s) {
        router.push('/login')
        return
      }
      if (s.role === 'ADMIN') {
        router.push('/admin')
        return
      }
      setSession(s)
    })
  }, [router])

  // Battery Status API (null if unsupported so we never fake 84%)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      ;(navigator as any)
        .getBattery?.()
        .then((battery: any) => {
          const updateBattery = () => setBatteryLevel(Math.round(battery.level * 100))
          updateBattery()
          battery.addEventListener('levelchange', updateBattery)
        })
        .catch(() => {})
    }
  }, [])

  // Real GPS Geofence Watcher
  const startGpsWatch = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setDeviceGpsActive(false)
      setGpsStatus('denied')
      return undefined
    }

    setGpsStatus('searching')

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGpsActive(true)
        setGpsStatus('active')
        const rawSpeed = pos.coords.speed
        const speedKmh =
          typeof rawSpeed === 'number' && !Number.isNaN(rawSpeed) && rawSpeed > 0
            ? Math.round(rawSpeed * 3.6)
            : 0
        setLiveCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          speedKmh,
        })
      },
      (err) => {
        console.warn('Geolocation access error:', err.message)
        setDeviceGpsActive(false)
        setGpsStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    const cleanup = startGpsWatch()
    return () => {
      if (cleanup) cleanup()
    }
  }, [startGpsWatch])

  const handleRetryGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return
    setGpsStatus('searching')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceGpsActive(true)
        setGpsStatus('active')
        setLiveCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          speedKmh:
            typeof pos.coords.speed === 'number' && !Number.isNaN(pos.coords.speed) && pos.coords.speed > 0
              ? Math.round(pos.coords.speed * 3.6)
              : 0,
        })
      },
      () => {
        setDeviceGpsActive(false)
        setGpsStatus('denied')
        showToast('error', 'Location access blocked. Enable browser GPS permissions to check in.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Track responsive screen size to mount Leaflet only in the visible layout
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch Live Assignment, Check-In State, & Active SOS State from Neon DB
  const fetchAssignment = useCallback(
    async (silent = false) => {
      if (!session?.userId) return
      if (!silent) setIsAssignmentLoading(true)
      try {
        const url = `/api/field/assignment?officerId=${encodeURIComponent(
          session.userId
        )}&staffId=${encodeURIComponent(session.staffId || '')}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (data.success) {
          setAssignment({
            venue: data.venue || null,
            paper: data.paper || null,
            timeline: Array.isArray(data.timeline) ? data.timeline : [],
          })
          setIsCheckedIn(Boolean(data.isCheckedIn))
          setCheckInTimestamp(data.checkInTimeFormatted || '')
          if (data.isCheckedIn && data.checkInTimeIso) {
            const elapsed = Math.max(
              0,
              Math.floor((Date.now() - Date.parse(data.checkInTimeIso)) / 1000)
            )
            setShiftSeconds(Number.isNaN(elapsed) ? 0 : elapsed)
          } else {
            setShiftSeconds(0)
          }
          const dbSos = Boolean(data.isSosActive)
          setIsSosActive(dbSos)
          if (dbSos && !initialSosPromptShownRef.current) {
            initialSosPromptShownRef.current = true
            setSosModalOpen(true)
          }
          if (typeof data.refreshIntervalMs === 'number' && data.refreshIntervalMs >= 3000) {
            setRefreshIntervalMs(data.refreshIntervalMs)
          }
        }
      } catch (err) {
        console.error('Failed to load assignment from DB:', err)
      } finally {
        if (!silent) setIsAssignmentLoading(false)
      }
    },
    [session?.userId, session?.staffId]
  )

  useEffect(() => {
    if (!session?.userId) return
    fetchAssignment(false)
    const pollMs = Math.max(refreshIntervalMs, 15000)
    const timer = setInterval(() => {
      fetchAssignment(true)
    }, pollMs)
    return () => clearInterval(timer)
  }, [session?.userId, refreshIntervalMs, fetchAssignment])

  // Monitor network status and flush queued offline SOS payloads on reconnect
  const flushQueuedSos = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(QUEUED_SOS_KEY)
      if (!raw) {
        setQueuedSosCount(0)
        return
      }
      const queue: any[] = JSON.parse(raw)
      if (!Array.isArray(queue) || queue.length === 0) {
        setQueuedSosCount(0)
        return
      }

      const remaining: any[] = []
      for (const payload of queue) {
        try {
          const res = await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok) remaining.push(payload)
        } catch {
          remaining.push(payload)
        }
      }

      if (remaining.length === 0) {
        localStorage.removeItem(QUEUED_SOS_KEY)
        setQueuedSosCount(0)
        setIsSosActive(true)
        showToast('success', 'Queued SOS alert transmitted to Regional Command upon reconnect.')
      } else {
        localStorage.setItem(QUEUED_SOS_KEY, JSON.stringify(remaining))
        setQueuedSosCount(remaining.length)
      }
    } catch {
      // ignore storage errors
    }
  }, [showToast])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem(QUEUED_SOS_KEY) || '[]')
        if (Array.isArray(existing)) setQueuedSosCount(existing.length)
      } catch {
        setQueuedSosCount(0)
      }
    }

    const handleOnline = () => {
      setIsOffline(false)
      flushQueuedSos()
    }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushQueuedSos])

  // Shift Timer when checked in
  useEffect(() => {
    if (!isCheckedIn) return
    const interval = setInterval(() => {
      setShiftSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isCheckedIn])

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0'
    )}`
  }

  // Active Venue details (Strictly from Neon DB or user-initiated Test Spot)
  const baseVenue = assignment.venue
  const activeVenue: FieldVenue | null = baseVenue
    ? testVenueOverride
      ? {
          ...baseVenue,
          lat: testVenueOverride.lat,
          lng: testVenueOverride.lng,
          name: testVenueOverride.name,
        }
      : baseVenue
    : null

  const officerName = session?.name || 'Field Officer'
  const centerVenue =
    activeVenue?.name ||
    (isAssignmentLoading ? session?.assignedCenter || 'Loading Venue...' : 'No Venue Assigned')
  const centerCode = activeVenue
    ? activeVenue.code
    : isAssignmentLoading
    ? session?.assignedCenterCode || ''
    : ''
  const centerZone = activeVenue?.zone || 'Ashanti Examination Zone'
  const centerRegion = activeVenue?.region || session?.region || 'Ashanti Region'
  const geofenceRadius = activeVenue?.radiusMeters || 150

  // Calculate distance in meters using Haversine
  const calculateHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  let effectiveUserLat: number | undefined = undefined
  let effectiveUserLng: number | undefined = undefined
  let distanceMeters: number | null = null
  let isInside = false

  if (gpsMode === 'live') {
    if (liveCoords) {
      effectiveUserLat = liveCoords.lat
      effectiveUserLng = liveCoords.lng
      if (activeVenue) {
        distanceMeters = calculateHaversine(
          liveCoords.lat,
          liveCoords.lng,
          activeVenue.lat,
          activeVenue.lng
        )
        isInside = distanceMeters <= geofenceRadius
      }
    }
  } else if (gpsMode === 'mock-outside') {
    if (activeVenue) {
      effectiveUserLat = activeVenue.lat + 0.00405
      effectiveUserLng = activeVenue.lng
    }
    distanceMeters = 450
    isInside = false
  } else if (gpsMode === 'mock-inside') {
    if (activeVenue) {
      effectiveUserLat = activeVenue.lat + 0.00038
      effectiveUserLng = activeVenue.lng
    }
    distanceMeters = 42
    isInside = true
  }

  const statusCardState: StatusCardState = isCheckedIn
    ? 'checked-in'
    : !isAssignmentLoading && !activeVenue
    ? 'unassigned'
    : gpsMode === 'live' && gpsStatus === 'denied'
    ? 'gps-denied'
    : gpsMode === 'live' && (!liveCoords || gpsStatus === 'searching')
    ? 'gps-searching'
    : isInside
    ? 'inside'
    : 'outside'

  // Live Telemetry Heartbeat Ref (keeps interval stable across GPS ticks)
  const telemetryPayloadRef = useRef<{
    officerId: string
    lat?: number
    lng?: number
    battery: number | null
    speedKmh: number
    accuracyMeters?: number
    distanceMeters: number | null
    isSimulated: boolean
  } | null>(null)

  telemetryPayloadRef.current = session?.userId
    ? {
        officerId: session.userId,
        lat: effectiveUserLat,
        lng: effectiveUserLng,
        battery: batteryLevel,
        speedKmh: gpsMode === 'live' && liveCoords ? liveCoords.speedKmh : 0,
        accuracyMeters: gpsMode === 'live' && liveCoords ? liveCoords.accuracy : 10,
        distanceMeters,
        isSimulated: gpsMode !== 'live' || Boolean(testVenueOverride),
      }
    : null

  const sendTelemetryHeartbeat = useCallback(async () => {
    const payload = telemetryPayloadRef.current
    if (!payload || !payload.officerId || isOffline) return
    if (payload.lat === undefined || payload.lng === undefined) return
    try {
      await fetch('/api/field/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // Silently retry on next scheduled heartbeat
    }
  }, [isOffline])

  // Immediately sync on first GPS lock / simulation mode change, then repeat every refreshIntervalMs
  useEffect(() => {
    if (!session?.userId || isOffline) return
    if (effectiveUserLat === undefined || effectiveUserLng === undefined) return
    const key = `${gpsMode}:${Boolean(testVenueOverride)}`
    if (initialTelemetrySentRef.current !== key) {
      initialTelemetrySentRef.current = key
      sendTelemetryHeartbeat()
    }
  }, [session?.userId, isOffline, effectiveUserLat, effectiveUserLng, gpsMode, testVenueOverride, sendTelemetryHeartbeat])

  useEffect(() => {
    if (!session?.userId) return
    const timer = setInterval(() => {
      sendTelemetryHeartbeat()
    }, refreshIntervalMs)
    return () => clearInterval(timer)
  }, [session?.userId, refreshIntervalMs, sendTelemetryHeartbeat])

  // Handle Duty Check-In (strictly persisted in Neon DB)
  const handleCheckIn = async () => {
    if (!isInside || !session?.userId) return
    if (isOffline) {
      showToast('error', 'Network offline. Reconnect to verify and record your check-in.')
      return
    }

    try {
      const res = await fetch('/api/field/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officerId: session.userId,
          action: 'CHECK_IN',
          lat: effectiveUserLat,
          lng: effectiveUserLng,
          distanceMeters: distanceMeters ?? 0,
          battery: batteryLevel,
          accuracyMeters: liveCoords?.accuracy,
          isTestMode: gpsMode !== 'live' || Boolean(testVenueOverride),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast('error', data.error || 'Unable to verify check-in at this time.')
        return
      }
      setIsCheckedIn(true)
      setCheckInTimestamp(data.checkInTimeFormatted || 'Just now')
      setShiftSeconds(0)
      showToast('success', 'Attendance verified on site and synced with Regional Command.')
      void fetchAssignment(true)
    } catch {
      showToast('error', 'Connection error while submitting check-in.')
    }
  }

  // Handle Duty Check-Out (strictly persisted in Neon DB)
  const handleCheckOut = async () => {
    if (!session?.userId) return
    if (isOffline) {
      showToast('error', 'Network offline. Reconnect to conclude and log your shift.')
      return
    }

    try {
      const res = await fetch('/api/field/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officerId: session.userId,
          action: 'CHECK_OUT',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast('error', data.error || 'Failed to conclude duty shift.')
        return
      }
      setIsCheckedIn(false)
      setCheckInTimestamp('')
      setShiftSeconds(0)
      showToast('success', 'Shift concluded and recorded in duty log.')
      void fetchAssignment(true)
    } catch {
      showToast('error', 'Connection error while concluding shift.')
    }
  }

  // Dispatch Emergency SOS Incident to Neon DB (or queue offline)
  const dispatchSosIncident = useCallback(
    async (notes?: string) => {
      if (!session?.userId) return
      const payload = {
        reportedBy: session.userId,
        centerCode,
        centerName: centerVenue,
        lat: effectiveUserLat,
        lng: effectiveUserLng,
        battery: batteryLevel,
        distanceMeters,
        isSos: true,
        category: 'SOS',
        severity: 'CRITICAL',
        description:
          notes?.trim() ||
          `Field officer ${officerName} triggered an immediate emergency SOS distress signal at ${centerVenue}.`,
      }

      if (isOffline) {
        if (typeof window !== 'undefined') {
          try {
            const existing = JSON.parse(localStorage.getItem(QUEUED_SOS_KEY) || '[]')
            const next = Array.isArray(existing) ? [...existing, payload] : [payload]
            localStorage.setItem(QUEUED_SOS_KEY, JSON.stringify(next))
            setQueuedSosCount(next.length)
          } catch {
            setQueuedSosCount((prev) => prev + 1)
          }
        }
        return
      }

      try {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setIsSosActive(true)
        } else {
          const err = await res.json().catch(() => ({}))
          showToast('error', err.error || 'Failed to log SOS incident.')
        }
      } catch {
        showToast('error', 'Network error dispatching SOS signal.')
      }
    },
    [
      session?.userId,
      centerCode,
      centerVenue,
      effectiveUserLat,
      effectiveUserLng,
      batteryLevel,
      distanceMeters,
      officerName,
      isOffline,
      showToast,
    ]
  )

  const handleTriggerSos = async () => {
    await dispatchSosIncident()
    setIsSosActive(true)
    setSosModalOpen(true)
  }

  // Strict DB-PIN-verified SOS Stand Down
  const handleStandDownSos = async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    if (!session?.userId) return { ok: false, error: 'Active officer session required.' }
    try {
      const res = await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'STAND_DOWN',
          officerId: session.userId,
          pin,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          ok: false,
          error: data.error || 'Invalid 4-digit security PIN. Emergency alert remains active.',
        }
      }
      setIsSosActive(false)
      showToast('success', 'Emergency SOS alert stood down and verified.')
      void fetchAssignment(true)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error verifying stand-down PIN.' }
    }
  }

  // Persist Field Officer profile updates directly to Neon DB
  const handleSaveProfile = async (updated: Partial<SessionData>): Promise<boolean> => {
    if (!session?.userId) return false
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.userId,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        pin: updated.pin,
        photo: updated.photo,
        bio: updated.bio,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save profile to database.')
    }
    setSession((prev) => (prev ? { ...prev, ...updated } : null))
    showToast('success', 'Profile details saved to database.')
    return true
  }

  const handleLogout = () => {
    signOutEverywhere().finally(() => {
      router.push('/login')
    })
  }

  const paperAssignment: PaperAssignment | null = assignment.paper
  const todayTimeline: TimelineItem[] = assignment.timeline

  return (
    <div className="min-h-screen w-full bg-[#070913] text-zinc-100 flex flex-col font-sans select-none antialiased">
      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} queuedCount={queuedSosCount} />

      {/* Active SOS Beacon Banner (persisted across reloads until stood down or resolved) */}
      {isSosActive && (
        <div className="w-full bg-red-600/20 border-b border-red-500/40 px-4 py-2 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2 font-semibold">
            <Radio className="size-4 text-red-400 animate-pulse shrink-0" />
            <span>EMERGENCY SOS TRANSMISSION ACTIVE — Regional Command alerted</span>
          </div>
          <button
            type="button"
            onClick={() => setSosModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition cursor-pointer shrink-0"
          >
            Open SOS Terminal
          </button>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {fieldFeedback && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-md max-w-[92vw] ${
            fieldFeedback.type === 'error'
              ? 'border-rose-500/40 bg-[#1A0D12]/95 text-rose-300'
              : 'border-emerald-500/35 bg-[#0C1814]/95 text-emerald-300'
          }`}
        >
          {fieldFeedback.type === 'error' ? (
            <AlertTriangle className="size-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          )}
          <span>{fieldFeedback.message}</span>
          <button
            type="button"
            onClick={() => setFieldFeedback(null)}
            className="ml-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main Field Header */}
      <FieldHeader
        session={session}
        zoneName={centerZone}
        batteryLevel={batteryLevel}
        isGpsActive={deviceGpsActive || gpsMode !== 'live'}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
      />

      {/* ============================================================ */}
      {/* --- RESPONSIVE LAYOUT CONTAINER --- */}
      {/* ============================================================ */}

      {/* 1. MOBILE VIEWPORT (< 1024px): Single column, centered, max-w-md */}
      <div className="flex-1 flex lg:hidden flex-col items-center justify-between p-4 w-full max-w-md mx-auto space-y-3 pb-6">
        {/* Map Card (~330px tall) */}
        <div className="w-full h-[330px] shrink-0 relative">
          {!isDesktop && activeVenue ? (
            <FieldMap
              centerName={centerVenue}
              centerCode={centerCode}
              centerLat={activeVenue.lat}
              centerLng={activeVenue.lng}
              radiusMeters={geofenceRadius}
              isInside={isInside}
              distanceMeters={distanceMeters}
              userLat={effectiveUserLat}
              userLng={effectiveUserLng}
            />
          ) : !isDesktop ? (
            <div className="size-full rounded-2xl border border-[#1A2035] bg-[#0C101A] flex flex-col items-center justify-center p-6 text-center gap-2">
              <Building2 className="size-7 text-slate-500" />
              <div className="text-xs font-semibold text-slate-300">
                {isAssignmentLoading ? 'Loading assigned venue from database...' : 'No examination center assigned yet'}
              </div>
            </div>
          ) : null}

          {/* Testing & GPS Mode switcher */}
          {activeVenue && (
            <div className="absolute top-3 right-3 z-[400] flex items-center p-0.5 rounded-lg bg-[#0B0F1A]/90 border border-[#212A40] text-[10px] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setGpsMode('live')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                  gpsMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    gpsStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                Live
              </button>
              <button
                type="button"
                onClick={() => setGpsMode('mock-inside')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  gpsMode === 'mock-inside' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sim 42m
              </button>
              <button
                type="button"
                onClick={() => setGpsMode('mock-outside')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  gpsMode === 'mock-outside' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sim 450m
              </button>
            </div>
          )}

          {/* Quick Test Trigger for Live GPS */}
          {gpsMode === 'live' && liveCoords && distanceMeters !== null && distanceMeters > geofenceRadius && (
            <button
              type="button"
              onClick={() => {
                setTestVenueOverride({
                  lat: liveCoords.lat,
                  lng: liveCoords.lng,
                  name: 'My Spot (Test Venue)',
                })
              }}
              className="absolute bottom-12 left-3 z-[400] text-[10px] font-semibold bg-[#0B0F1A]/95 text-sky-300 hover:text-white border border-[#23335A] hover:border-sky-400 px-2 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              Test Check-In Here
            </button>
          )}
          {testVenueOverride && (
            <button
              type="button"
              onClick={() => setTestVenueOverride(null)}
              className="absolute bottom-12 right-3 z-[400] text-[10px] font-semibold bg-[#1C1215]/95 text-red-300 hover:text-white border border-red-500/30 px-2 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              Reset Venue
            </button>
          )}
        </div>

        {/* Status Card */}
        <StatusCard
          state={statusCardState}
          distanceMeters={distanceMeters ?? 0}
          geofenceRadius={geofenceRadius}
          checkInTime={checkInTimestamp || 'Just now'}
          elapsedFormatted={formatTimer(shiftSeconds)}
          onRetryGps={handleRetryGps}
        />

        {/* Venue Card */}
        <VenueCard
          venueName={centerVenue}
          venueCode={centerCode}
          zoneName={centerZone}
          regionName={centerRegion}
        />

        {/* Paper / Arrive Tiles */}
        <PaperTiles assignment={paperAssignment} />

        {/* Mobile Collapsible Schedule Timeline */}
        <DayTimeline items={todayTimeline} collapsible={true} />

        {/* Action Dock */}
        <div className="w-full space-y-2.5 pt-2">
          <CheckInButton
            isInside={isInside && Boolean(activeVenue)}
            distanceMeters={distanceMeters}
            geofenceRadius={geofenceRadius}
            isCheckedIn={isCheckedIn}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />

          {isFeatureEnabled('FIELD_INCIDENT_REPORTING') ? (
            <div className="flex items-center gap-2.5 w-full">
              <SosHoldButton
                onTriggerSos={handleTriggerSos}
                isOffline={isOffline}
                className="flex-1"
              />
              <ReportButton onOpenReport={() => setSosModalOpen(true)} />
            </div>
          ) : (
            <SosHoldButton
              onTriggerSos={handleTriggerSos}
              isOffline={isOffline}
              className="w-full"
            />
          )}
        </div>
      </div>

      {/* 2. DESKTOP VIEWPORT (>= 1024px): Two columns with 20px gap */}
      <div className="hidden lg:flex flex-1 p-5 gap-5 max-w-7xl mx-auto w-full items-stretch min-h-[calc(100vh-64px)] pb-6">
        {/* Left Column: Map Card extending down to match right panel */}
        <div className="flex-1 min-h-[720px] xl:min-h-[760px] h-full relative flex flex-col self-stretch">
          {isDesktop && activeVenue ? (
            <FieldMap
              centerName={centerVenue}
              centerCode={centerCode}
              centerLat={activeVenue.lat}
              centerLng={activeVenue.lng}
              radiusMeters={geofenceRadius}
              isInside={isInside}
              distanceMeters={distanceMeters}
              userLat={effectiveUserLat}
              userLng={effectiveUserLng}
            />
          ) : isDesktop ? (
            <div className="size-full min-h-[330px] flex-1 rounded-2xl border border-[#1A2035] bg-[#0C101A] flex flex-col items-center justify-center p-8 text-center gap-3">
              <Building2 className="size-10 text-slate-500" />
              <div className="text-sm font-semibold text-slate-200">
                {isAssignmentLoading
                  ? 'Synchronizing duty deployment from database...'
                  : 'No Examination Center Assigned'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Contact the Ashanti Regional Control Room to assign an examination center and exam paper timetable to your account.
              </p>
            </div>
          ) : null}

          {/* Testing & GPS Mode switcher */}
          {activeVenue && (
            <div className="absolute top-3 right-3 z-[400] flex items-center p-0.5 rounded-lg bg-[#0B0F1A]/90 border border-[#212A40] text-[10px] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setGpsMode('live')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                  gpsMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    gpsStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                Live GPS
              </button>
              <button
                type="button"
                onClick={() => setGpsMode('mock-inside')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  gpsMode === 'mock-inside' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sim Inside (42m)
              </button>
              <button
                type="button"
                onClick={() => setGpsMode('mock-outside')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  gpsMode === 'mock-outside' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sim Outside (450m)
              </button>
            </div>
          )}

          {/* Quick Test Trigger for Live GPS */}
          {gpsMode === 'live' && liveCoords && distanceMeters !== null && distanceMeters > geofenceRadius && (
            <button
              type="button"
              onClick={() => {
                setTestVenueOverride({
                  lat: liveCoords.lat,
                  lng: liveCoords.lng,
                  name: 'My Spot (Test Venue)',
                })
              }}
              className="absolute bottom-12 left-3 z-[400] text-[10px] font-semibold bg-[#0B0F1A]/95 text-sky-300 hover:text-white border border-[#23335A] hover:border-sky-400 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              Set Venue to My Location (Test Check-In)
            </button>
          )}
          {testVenueOverride && (
            <button
              type="button"
              onClick={() => setTestVenueOverride(null)}
              className="absolute bottom-12 right-3 z-[400] text-[10px] font-semibold bg-[#1C1215]/95 text-red-300 hover:text-white border border-red-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              Reset to {baseVenue?.name || 'Assigned Venue'}
            </button>
          )}
        </div>

        {/* Right Column: 460px panel with action dock pinned to bottom */}
        <div className="w-[460px] flex flex-col justify-between space-y-3.5 self-stretch shrink-0">
          <div className="space-y-3.5">
            {/* Status Card */}
            <StatusCard
              state={statusCardState}
              distanceMeters={distanceMeters ?? 0}
              geofenceRadius={geofenceRadius}
              checkInTime={checkInTimestamp || 'Just now'}
              elapsedFormatted={formatTimer(shiftSeconds)}
              onRetryGps={handleRetryGps}
            />

            {/* Venue Card */}
            <VenueCard
              venueName={centerVenue}
              venueCode={centerCode}
              zoneName={centerZone}
              regionName={centerRegion}
            />

            {/* Paper / Arrive Tiles */}
            <PaperTiles assignment={paperAssignment} />

            {/* Today Timeline */}
            <DayTimeline items={todayTimeline} />
          </div>

          {/* Action Dock (Pinned to panel bottom) */}
          <div className="space-y-2.5 pt-2">
            <CheckInButton
              isInside={isInside && Boolean(activeVenue)}
              distanceMeters={distanceMeters}
              geofenceRadius={geofenceRadius}
              isCheckedIn={isCheckedIn}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />

            {isFeatureEnabled('FIELD_INCIDENT_REPORTING') ? (
              <div className="flex items-center gap-2.5 w-full">
                <SosHoldButton
                  onTriggerSos={handleTriggerSos}
                  isOffline={isOffline}
                  className="flex-1"
                />
                <ReportButton onOpenReport={() => setSosModalOpen(true)} />
              </div>
            ) : (
              <SosHoldButton
                onTriggerSos={handleTriggerSos}
                isOffline={isOffline}
                className="w-full"
              />
            )}

            <p className="text-[11px] text-slate-500 text-center select-none pt-1">
              Keyboard: focus SOS and hold Space for 1.5 seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Emergency SOS Modal (Incident & Distress details) */}
      <EmergencySosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        initialTriggered={isSosActive}
        officerName={officerName}
        venueName={centerVenue}
        centerCode={centerCode}
        coords={
          effectiveUserLat !== undefined && effectiveUserLng !== undefined
            ? {
                lat: `${effectiveUserLat.toFixed(4)}° ${effectiveUserLat >= 0 ? 'N' : 'S'}`,
                lng: `${Math.abs(effectiveUserLng).toFixed(4)}° ${effectiveUserLng >= 0 ? 'E' : 'W'}`,
                acc: liveCoords ? `±${liveCoords.accuracy}m` : 'Simulated',
              }
            : { lat: '--', lng: '--', acc: 'Acquiring' }
        }
        batteryLevel={typeof batteryLevel === 'number' ? `${batteryLevel}%` : '--%'}
        onDispatchSos={dispatchSosIncident}
        onStandDown={handleStandDownSos}
      />

      {/* Officer Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        session={session}
        onDutyStatus={isCheckedIn ? 'ON DUTY' : 'STANDBY'}
        onSave={handleSaveProfile}
        onLogout={handleLogout}
      />
    </div>
  )
}
