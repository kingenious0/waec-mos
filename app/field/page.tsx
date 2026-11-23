'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CheckCircle2, AlertTriangle, Radio, Building2, X, Camera } from 'lucide-react'
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
import { IncidentReportSheet } from '@/components/field/IncidentReportSheet'
import { OfflineBanner } from '@/components/field/OfflineBanner'
import {
  TodaySchoolCard,
  type TeamMemberPlan,
} from '@/components/field/TodaySchoolCard'
import { isFeatureEnabled } from '@/lib/features'
import { UNCONFIRMED_GRACE_MS } from '@/lib/field/exceptions'
import { impliedSpeedKmh } from '@/lib/field/geo'
import { resolveEventMs, shouldRetryArrivalDelivery } from '@/lib/field/event-time'
import {
  detectionMode,
  getDeviceIntegrity,
  getLastNativePosition,
  integrityWarnings,
  isNativeFieldApp,
  onNativePosition,
  startNativeTracking,
  stopNativeTracking,
  type DetectionMode,
  type NativePosition,
} from '@/lib/field/native'

const FieldMap = dynamic(() => import('@/components/field/FieldMap'), {
  ssr: false,
  loading: () => (
    <div className="size-full flex flex-col items-center justify-center bg-[#0C101A] text-slate-400 gap-2.5 rounded-2xl border border-[#1A2035]">
      <div className="size-7 border-2 border-[#1E2B7B] border-t-[#F6D300] rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-400">Loading Map View...</span>
    </div>
  ),
})

/**
 * Mobile section heading: a small caps label with a hairline rule.
 * Gives the single-column phone layout rhythm instead of a flat pile of cards.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#161B2B]" aria-hidden="true" />
    </div>
  )
}

interface FieldVenue {
  name: string
  code: string
  zone: string
  region: string
  lat: number
  lng: number
  radiusMeters: number
}

interface FieldDutyPaper {
  paperName: string
  startTime: string | null
  endTime: string | null
  sessionSlot: string | null
}

interface FieldAssignmentState {
  venue: FieldVenue | null
  plan: { centerId: string; centerName: string | null; source: string } | null
  paper: PaperAssignment | null
  papers: FieldDutyPaper[]
  timeline: TimelineItem[]
  seriesName: string | null
  isDeployed: boolean
  nextPaper: { date: string; paperName: string; startTime: string | null } | null
  today: {
    arrival: { at: string; phoneTime?: string | null; accuracyTier: string | null; confirmed: boolean } | null
    departure: { at: string; phoneTime?: string | null; duringPaper: boolean } | null
  } | null
}

interface PhotoRequestState {
  id: string
  officerId: string
  reason: string
  status: string
  createdAt: string
}

const QUEUED_SOS_KEY = 'waec_mos_queued_sos'
const QUEUED_ARRIVALS_KEY = 'waec_mos_queued_arrivals'

export default function FieldPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  // Geofence & GPS States — live GPS only, no simulator in production
  const [liveCoords, setLiveCoords] = useState<{
    lat: number
    lng: number
    accuracy: number
    speedKmh: number
  } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied'>('searching')
  const [activeDetection, setActiveDetection] = useState<DetectionMode>(() => detectionMode())
  const [deviceWarnings, setDeviceWarnings] = useState<string[]>([])

  // Live DB Operational States
  const [isAssignmentLoading, setIsAssignmentLoading] = useState<boolean>(true)
  const [assignment, setAssignment] = useState<FieldAssignmentState>({
    venue: null,
    plan: null,
    paper: null,
    papers: [],
    timeline: [],
    seriesName: null,
    isDeployed: false,
    nextPaper: null,
    today: null,
  })
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false)
  const [checkInTimestamp, setCheckInTimestamp] = useState<string>('')
  const [shiftSeconds, setShiftSeconds] = useState<number>(0)
  const [isSosActive, setIsSosActive] = useState<boolean>(false)
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(10000)
  const [centerOptions, setCenterOptions] = useState<{ id: string; name: string }[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberPlan[] | null>(null)
  const [teamBusy, setTeamBusy] = useState<boolean>(false)

  // UI States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false)
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false)
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false)
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [queuedSosCount, setQueuedSosCount] = useState<number>(0)
  const [queuedArrivalCount, setQueuedArrivalCount] = useState<number>(0)
  const [photoRequest, setPhotoRequest] = useState<PhotoRequestState | null>(null)
  const [nowTick, setNowTick] = useState<number>(() => Date.now())
  const [isDesktop, setIsDesktop] = useState<boolean>(true)
  const [deviceGpsActive, setDeviceGpsActive] = useState<boolean>(false)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [fieldFeedback, setFieldFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const initialSosPromptShownRef = useRef<boolean>(false)
  const initialTelemetrySentRef = useRef<string>('')
  const lastNativeFixRef = useRef<{ lat: number; lng: number; atMs: number } | null>(null)

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
      if ((s as any).mustChangePassword) {
        router.replace('/choose-pin')
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

  // Real GPS watcher. Web = foreground only. APK = native foreground service
  // that keeps streaming fixes while the officer walks between exam halls.
  const applyFix = useCallback((lat: number, lng: number, accuracy: number, speedKmh: number) => {
    setDeviceGpsActive(true)
    setGpsStatus('active')
    setLiveCoords({ lat, lng, accuracy, speedKmh })
  }, [])

  const startGpsWatch = useCallback(() => {
    setGpsStatus('searching')

    if (isNativeFieldApp()) {
      setActiveDetection('native-background')
      let cancelled = false
      let listener: Awaited<ReturnType<typeof onNativePosition>> = null

      void (async () => {
        try {
          const last = await getLastNativePosition()
          if (last && !cancelled) {
            lastNativeFixRef.current = {
              lat: last.latitude,
              lng: last.longitude,
              atMs: last.timestamp,
            }
            applyFix(last.latitude, last.longitude, last.accuracy, 0)
          }
          listener = await onNativePosition((fix: NativePosition) => {
            if (cancelled) return
            const previous = lastNativeFixRef.current
            const speedKmh = previous
              ? Math.round(
                  impliedSpeedKmh(
                    { lat: previous.lat, lng: previous.lng, atMs: previous.atMs },
                    { lat: fix.latitude, lng: fix.longitude, atMs: fix.timestamp }
                  ) ?? 0
                )
              : 0
            lastNativeFixRef.current = {
              lat: fix.latitude,
              lng: fix.longitude,
              atMs: fix.timestamp,
            }
            applyFix(fix.latitude, fix.longitude, fix.accuracy, speedKmh)
          })
          await startNativeTracking()
        } catch {
          if (!cancelled) {
            setDeviceGpsActive(false)
            setGpsStatus('denied')
          }
        }
      })()

      void getDeviceIntegrity()
        .then((signal) => setDeviceWarnings(integrityWarnings(signal)))
        .catch(() => setDeviceWarnings([]))

      return () => {
        cancelled = true
        void listener?.remove()
        void stopNativeTracking()
      }
    }

    setActiveDetection('web-foreground')
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setDeviceGpsActive(false)
      setGpsStatus('denied')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawSpeed = pos.coords.speed
        const speedKmh =
          typeof rawSpeed === 'number' && !Number.isNaN(rawSpeed) && rawSpeed > 0
            ? Math.round(rawSpeed * 3.6)
            : 0
        applyFix(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy), speedKmh)
      },
      (err) => {
        console.warn('Geolocation access error:', err.message)
        setDeviceGpsActive(false)
        setGpsStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [applyFix])

  useEffect(() => {
    const cleanup = startGpsWatch()
    return () => {
      if (cleanup) cleanup()
    }
  }, [startGpsWatch])

  const handleRetryGps = () => {
    if (isNativeFieldApp()) {
      setGpsStatus('searching')
      void startNativeTracking()
        .then((ok) => {
          if (!ok) setGpsStatus('denied')
        })
        .catch(() => setGpsStatus('denied'))
      return
    }
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
        const url = `/api/field/duty?officerId=${encodeURIComponent(
          session.userId
        )}&staffId=${encodeURIComponent(session.staffId || '')}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (data.success) {
          const papers: FieldDutyPaper[] = Array.isArray(data.papers) ? data.papers : []
          // "Today's paper" = the first paper that hasn't ended yet; if all
          // are done, keep the last one shown as ended.
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
          const parseMin = (raw?: string | null) => {
            if (!raw) return null
            const m = String(raw).match(/(\d{1,2}):(\d{2})/)
            return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
          }
          const current = papers.find((p) => {
            const end = parseMin(p.endTime)
            return end === null || end >= nowMinutes
          })
          const paperAssignment: PaperAssignment | null = current
            ? {
                title: current.paperName,
                timeRange:
                  current.startTime && current.endTime
                    ? `${current.startTime} to ${current.endTime} GMT`
                    : current.startTime
                    ? `${current.startTime} GMT`
                    : 'Time not confirmed by WAEC',
                arriveBy: data.arriveBy ?? '—',
                collectBy: data.arriveBy ? `Check-in opens ${data.arriveBy}` : 'To be advised',
              }
            : null
          setAssignment({
            venue: data.venue || null,
            plan: data.plan
              ? {
                  centerId: data.plan.centerId,
                  centerName: data.venue?.name || null,
                  source: data.plan.source || 'deployment',
                }
              : null,
            paper: paperAssignment,
            papers,
            timeline: Array.isArray(data.timeline) ? data.timeline : [],
            seriesName: data.seriesName || null,
            isDeployed: Boolean(data.isDeployed),
            nextPaper: data.nextPaper || null,
            today: data.today || null,
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

  // Today's school picker — centres come from the database, never a local list.
  const fetchCenters = useCallback(async () => {
    try {
      const res = await fetch('/api/centers')
      if (!res.ok) return
      const data = await res.json()
      const all: { id: string; name: string; region?: string | null }[] = Array.isArray(
        data.centers
      )
        ? data.centers.map((c: any) => ({
            id: c.id,
            name: c.name,
            region: c.regionName || null,
          }))
        : []
      // Keep the picker to this officer's region when we know it. If the region
      // is unknown (or has no centres yet), show every registered centre so a
      // newly deployed officer is never locked out.
      const region = session?.region
      const scoped = region ? all.filter((c) => c.region === region) : all
      setCenterOptions((scoped.length > 0 ? scoped : all).map(({ id, name }) => ({ id, name })))
    } catch {
      // Leave the picker hidden — the venue card still shows the assigned school.
    }
  }, [session?.region])

  // Group board — a leader sees the whole group; an officer sees just themself.
  const fetchTeam = useCallback(async () => {
    if (!session?.userId) return
    try {
      const res = await fetch('/api/field/team', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.members)) setTeamMembers(data.members as TeamMemberPlan[])
    } catch {
      // Non-fatal — the card falls back to the officer's own plan.
    }
  }, [session?.userId])

  useEffect(() => {
    void fetchCenters()
    void fetchTeam()
  }, [fetchCenters, fetchTeam])

  // Rare on-request proof: HQ/leaders ask, the officer answers with one photo.
  const fetchPhotoRequest = useCallback(async () => {
    if (!session?.userId) return
    try {
      const res = await fetch('/api/field/photo-request', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const pending = (Array.isArray(data.requests) ? data.requests : []).find(
        (r: PhotoRequestState) => r.status === 'PENDING' && r.officerId === session.userId
      )
      setPhotoRequest(pending || null)
    } catch {
      // Non-fatal — the normal evidence button still works.
    }
  }, [session?.userId])

  useEffect(() => {
    if (!session?.userId) return
    void fetchPhotoRequest()
    const timer = setInterval(() => void fetchPhotoRequest(), Math.max(refreshIntervalMs, 15000))
    return () => clearInterval(timer)
  }, [fetchPhotoRequest, refreshIntervalMs, session?.userId])

  // Set today's school for yourself — or, as a group leader, for a teammate.
  const handleSetSchool = useCallback(
    async (officerId: string, centerId: string) => {
      if (!centerId || teamBusy) return
      setTeamBusy(true)
      try {
        const res = await fetch('/api/field/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ officerId, centerId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast('error', data.error || 'Could not save today’s school.')
          return
        }
        showToast('success', 'Today’s school saved. Check-in now uses this centre.')
        void fetchAssignment(true)
        void fetchTeam()
      } catch {
        showToast('error', 'Connection error while saving today’s school.')
      } finally {
        setTeamBusy(false)
      }
    },
    [teamBusy, fetchAssignment, fetchTeam, showToast]
  )

  // A leader can record why a teammate has no GPS proof. HQ still sees it as
  // unconfirmed until the officer taps "I'm here" or sends a photo.
  const handleMarkPresent = useCallback(
    async (officerId: string, reason: string) => {
      if (teamBusy) return
      setTeamBusy(true)
      try {
        const res = await fetch('/api/field/arrival', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'mark_present', officerId, reason }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast('error', data.error || 'Could not mark present.')
          return
        }
        showToast('success', 'Recorded with your name and reason. HQ will see it as unconfirmed.')
        void fetchTeam()
        void fetchAssignment(true)
      } catch {
        showToast('error', 'Connection error while recording attendance.')
      } finally {
        setTeamBusy(false)
      }
    },
    [teamBusy, fetchTeam, fetchAssignment, showToast]
  )

  // Group leader's rare exception tool: ask one teammate for one photo.
  const handleRequestPhoto = useCallback(
    async (officerId: string, reason: string) => {
      if (teamBusy) return
      setTeamBusy(true)
      try {
        const res = await fetch('/api/field/photo-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'request', officerId, reason }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast('error', data.error || 'Could not ask for the photo.')
          return
        }
        showToast(
          'success',
          data.alreadyPending
            ? 'That officer already has a photo request waiting.'
            : 'Photo request sent. The officer will see it in their app.'
        )
      } catch {
        showToast('error', 'Connection error while asking for the photo.')
      } finally {
        setTeamBusy(false)
      }
    },
    [teamBusy, showToast]
  )

  // ---- Offline arrival queue -------------------------------------------------
  // The device keeps the time it saw the event (phoneTime); the server adds
  // serverTime when it finally receives it. HQ always gets both timestamps.
  const readQueuedArrivals = useCallback((): any[] => {
    if (typeof window === 'undefined') return []
    try {
      const queued = JSON.parse(localStorage.getItem(QUEUED_ARRIVALS_KEY) || '[]')
      return Array.isArray(queued) ? queued : []
    } catch {
      return []
    }
  }, [])

  const queueArrival = useCallback(
    (payload: Record<string, unknown>) => {
      if (typeof window === 'undefined') return
      try {
        const next = [...readQueuedArrivals(), payload]
        localStorage.setItem(QUEUED_ARRIVALS_KEY, JSON.stringify(next))
        setQueuedArrivalCount(next.length)
      } catch {
        setQueuedArrivalCount((prev) => prev + 1)
      }
    },
    [readQueuedArrivals]
  )

  const flushQueuedArrivals = useCallback(async () => {
    const queue = readQueuedArrivals()
    if (queue.length === 0) {
      setQueuedArrivalCount(0)
      return
    }
    let delivered = 0
    const remaining: any[] = []
    for (const payload of queue) {
      try {
        const res = await fetch('/api/field/arrival', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        // Bad payloads would loop forever; drop them. Keep auth/server failures.
        if (!shouldRetryArrivalDelivery(res.status)) {
          delivered += 1
        } else {
          remaining.push(payload)
        }
      } catch {
        remaining.push(payload)
      }
    }
    try {
      if (remaining.length === 0) localStorage.removeItem(QUEUED_ARRIVALS_KEY)
      else localStorage.setItem(QUEUED_ARRIVALS_KEY, JSON.stringify(remaining))
    } catch {
      // Storage may be unavailable; the in-memory count still reflects reality.
    }
    setQueuedArrivalCount(remaining.length)
    if (delivered > 0) {
      showToast('success', `${delivered} offline check-in update${delivered > 1 ? 's' : ''} sent to Regional Command.`)
      void fetchAssignment(true)
    }
  }, [fetchAssignment, readQueuedArrivals, showToast])

  // Monitor network status and flush queued offline payloads on reconnect
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
        const sos = JSON.parse(localStorage.getItem(QUEUED_SOS_KEY) || '[]')
        if (Array.isArray(sos)) setQueuedSosCount(sos.length)
      } catch {
        setQueuedSosCount(0)
      }
      setQueuedArrivalCount(readQueuedArrivals().length)
    }

    const handleOnline = () => {
      setIsOffline(false)
      void flushQueuedSos()
      void flushQueuedArrivals()
    }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOffline(!navigator.onLine)
    if (navigator.onLine) void flushQueuedArrivals()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushQueuedArrivals, flushQueuedSos, readQueuedArrivals])

  // Keeps the "please confirm now" reminder honest without extra API calls.
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

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

  const activeVenue: FieldVenue | null = assignment.venue

  const officerName = session?.name || 'Field Officer'
  const centerVenue =
    activeVenue?.name ||
    (isAssignmentLoading ? session?.assignedCenter || 'Loading Venue...' : 'No Venue Assigned')
  const centerCode = activeVenue
    ? activeVenue.code
    : isAssignmentLoading
    ? session?.assignedCenterCode || ''
    : ''
  const centerZone = activeVenue?.zone || ''
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

  // ---- Auto arrival/departure detection (dwell 2 min inside the geofence) ----
  const arrivalPostedRef = useRef<string>('')
  const departurePostedRef = useRef<string>('')
  const insideSinceRef = useRef<number | null>(null)

  const postArrival = useCallback(
    async (action: 'detect_arrival' | 'done', venueId?: string) => {
      const payload = {
        action,
        lat: liveCoords?.lat,
        lng: liveCoords?.lng,
        accuracyM: liveCoords?.accuracy,
        distanceMeters,
        phoneTime: new Date().toISOString(),
      }
      try {
        const res = await fetch('/api/field/arrival', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        if (!res.ok && (isOffline || res.status >= 500)) queueArrival(payload)
      } catch {
        // Offline or a dead gateway — keep the device timestamp for the flush.
        queueArrival(payload)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOffline, liveCoords?.lat, liveCoords?.lng, liveCoords?.accuracy, distanceMeters, queueArrival]
  )

  useEffect(() => {
    const venueId = activeVenue?.code || 'none'
    if (!activeVenue || liveCoords === null || distanceMeters === null) {
      insideSinceRef.current = null
      return
    }
    const inside = distanceMeters <= geofenceRadius
    if (inside) {
      if (insideSinceRef.current === null) insideSinceRef.current = Date.now()
      const dwellMs = Date.now() - insideSinceRef.current
      const key = `${new Date().toISOString().slice(0, 10)}:${venueId}`
      if (dwellMs >= 120_000 && arrivalPostedRef.current !== key) {
        arrivalPostedRef.current = key
        void postArrival('detect_arrival', venueId)
      }
      return
    }
    const wasInside = insideSinceRef.current !== null
    if (wasInside && departurePostedRef.current !== venueId) {
      departurePostedRef.current = venueId
      void postArrival('done', venueId)
    }
    insideSinceRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCoords, activeVenue, distanceMeters, geofenceRadius, postArrival])

  const statusCardState: StatusCardState = isCheckedIn
    ? 'checked-in'
    : !isAssignmentLoading && !activeVenue
    ? 'unassigned'
    : gpsStatus === 'denied'
    ? 'gps-denied'
    : !liveCoords || gpsStatus === 'searching'
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
        speedKmh: liveCoords ? liveCoords.speedKmh : 0,
        accuracyMeters: liveCoords ? liveCoords.accuracy : undefined,
        distanceMeters,
        isSimulated: false,
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

  useEffect(() => {
    if (!session?.userId || isOffline) return
    if (effectiveUserLat === undefined || effectiveUserLng === undefined) return
    if (initialTelemetrySentRef.current !== 'sent') {
      initialTelemetrySentRef.current = 'sent'
      sendTelemetryHeartbeat()
    }
  }, [session?.userId, isOffline, effectiveUserLat, effectiveUserLng, sendTelemetryHeartbeat])

  useEffect(() => {
    if (!session?.userId) return
    const timer = setInterval(() => {
      sendTelemetryHeartbeat()
    }, refreshIntervalMs)
    return () => clearInterval(timer)
  }, [session?.userId, refreshIntervalMs, sendTelemetryHeartbeat])

  // Handle Duty Check-In (strictly persisted in Neon DB)
  // ---- Photo evidence: capture → burn watermark → upload ----
  const evidenceInputRef = useRef<HTMLInputElement>(null)
  const [evidenceProof, setEvidenceProof] = useState<string | null>(null) // watermark text once stored
  const [evidenceBusy, setEvidenceBusy] = useState(false)
  const fulfillAfterUploadRef = useRef<string | null>(null)

  const fulfillPhotoRequest = useCallback(
    async (requestId: string) => {
      try {
        const res = await fetch('/api/field/photo-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'fulfill', requestId }),
        })
        if (!res.ok) return false
        setPhotoRequest(null)
        return true
      } catch {
        return false
      }
    },
    []
  )

  const handleEvidencePick = useCallback(
    async (file: File | undefined) => {
      if (!file || !session?.userId) return
      setEvidenceBusy(true)
      try {
        const dataUrlIn = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = () => reject(new Error('read failed'))
          r.readAsDataURL(file)
        })

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image()
          i.onload = () => resolve(i)
          i.onerror = () => reject(new Error('bad image'))
          i.src = dataUrlIn
        })

        // Downscale to a sensible proof size
        const MAX_W = 1280
        const scale = Math.min(1, MAX_W / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no canvas')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Watermark block: dark translucent strip with two lines of text
        const wmHeight = Math.max(54, Math.round(canvas.height * 0.075))
        const y = canvas.height - wmHeight
        ctx.fillStyle = 'rgba(8, 11, 19, 0.82)'
        ctx.fillRect(0, y, canvas.width, wmHeight)
        ctx.fillStyle = '#FBBF24'
        ctx.fillRect(0, y, canvas.width, 3)

        const now = new Date()
        const dateStr = now.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'Africa/Accra',
        })
        const timeStr =
          now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Africa/Accra',
          }) + ' GMT'

        const schoolLine = `${centerVenue}`
        const locationLine = `${centerZone ? centerZone.replace(' Examination Zone', '') : ''}${
          centerRegion ? `, ${centerRegion}` : ''
        } · ${dateStr} · ${timeStr}`
        const officerLine = `${officerName}${session.staffId ? ` (${session.staffId})` : ''}${
          centerCode ? ` · Code ${centerCode}` : ''
        }`

        const pad = Math.round(canvas.width * 0.03)
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `700 ${Math.round(wmHeight * 0.32)}px Inter, system-ui, sans-serif`
        ctx.fillText(schoolLine, pad, y + Math.round(wmHeight * 0.42), canvas.width - pad * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.font = `500 ${Math.round(wmHeight * 0.22)}px Inter, system-ui, sans-serif`
        ctx.fillText(locationLine, pad, y + Math.round(wmHeight * 0.72), canvas.width - pad * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.72)'
        ctx.font = `600 ${Math.round(wmHeight * 0.17)}px Inter, system-ui, sans-serif`
        ctx.fillText(officerLine, pad, y + Math.round(wmHeight * 0.94), canvas.width - pad * 2)

        const stamped = canvas.toDataURL('image/jpeg', 0.85)
        const stampText = `${schoolLine} · ${locationLine} · ${officerLine}`

        const res = await fetch('/api/field/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dataUrl: stamped, watermark: stampText }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          showToast('error', data.error || 'Could not save the photo proof.')
          return
        }
        setEvidenceProof(stampText)
        const requestToFulfill = fulfillAfterUploadRef.current
        fulfillAfterUploadRef.current = null
        if (requestToFulfill) {
          const sent = await fulfillPhotoRequest(requestToFulfill)
          showToast(
            sent ? 'success' : 'error',
            sent
              ? 'Photo proof sent to Regional Command.'
              : 'Photo saved. Could not mark the request as answered — try again.'
          )
        } else {
          showToast('success', 'Photo proof saved with watermark.')
        }
      } catch {
        showToast('error', 'Could not process that photo. Try again.')
      } finally {
        setEvidenceBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, centerVenue, centerZone, centerRegion, centerCode, officerName, showToast, fulfillPhotoRequest]
  )

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
          isTestMode: false,
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
      // Mirror the tap into the arrivals ledger so HQ sees the one-tap confirm
      void fetch('/api/field/arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'confirm' }),
      }).catch(() => {})
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
      void fetch('/api/field/arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'done' }),
      }).catch(() => {})
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

  // Routine issue report — deliberately separate from the emergency SOS path.
  const submitIncidentReport = useCallback(
    async ({ category, description }: { category: string; description: string }) => {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          category,
          severity: 'MEDIUM',
          isSos: false,
          centerCode,
          centerName: centerVenue,
          lat: effectiveUserLat,
          lng: effectiveUserLng,
          battery: batteryLevel,
          distanceMeters,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Could not send report.')
      }
      setReportModalOpen(false)
      showToast('success', 'Report sent to Regional Command.')
    },
    [
      batteryLevel,
      centerCode,
      centerVenue,
      distanceMeters,
      effectiveUserLat,
      effectiveUserLng,
      showToast,
    ]
  )

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

  const evidenceDock = (
    <div className="w-full">
      <input
        ref={evidenceInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void handleEvidencePick(f)
        }}
      />
      <button
        type="button"
        disabled={evidenceBusy}
        onClick={() => evidenceInputRef.current?.click()}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[#161B2E] hover:bg-[#20283F] border border-[#22263C] text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-60"
        title="Take a photo of the school with the official watermark burned in"
      >
        {evidenceBusy ? (
          <>
            <span className="size-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" aria-hidden />
            <span>Saving photo…</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{evidenceProof ? 'Replace photo proof' : 'Take photo proof'}</span>
          </>
        )}
      </button>
      {evidenceProof && (
        <p className="mt-1 text-[10px] text-emerald-400 flex items-center gap-1">
          <span aria-hidden>✓</span> Evidence saved — watermarked with school, time &amp; date
        </p>
      )}
    </div>
  )

  // Honest empty state when nothing is on today — say what's next, in plain words.
  const emptyDutyCard = !isAssignmentLoading && !paperAssignment ? (
    <div className="w-full rounded-2xl border border-[#1C2337] bg-[#0F121E] p-4 text-center select-none">
      <Building2 className="size-6 text-slate-500 mx-auto mb-1.5" />
      <p className="text-xs font-semibold text-slate-200">No paper deployed for today</p>
      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
        {assignment.isDeployed
          ? assignment.seriesName
            ? `You're deployed to ${assignment.seriesName}.`
            : "You're deployed this series."
          : 'You are not deployed to an exam centre yet.'}
      </p>
      {assignment.nextPaper ? (
        <p className="text-[10px] text-slate-400 mt-2 tabular-nums">
          Next up:{' '}
          <span className="text-slate-200 font-semibold">
            {new Date(`${assignment.nextPaper.date}T00:00:00Z`).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            {' · '}
            {assignment.nextPaper.paperName}
            {assignment.nextPaper.startTime ? ` · ${assignment.nextPaper.startTime}` : ''}
          </span>
        </p>
      ) : null}
    </div>
  ) : null

  const todaySchoolCard = (
    <TodaySchoolCard
      selfOfficerId={session?.userId}
      selfName={session?.name}
      selfPlan={assignment.plan}
      centerOptions={centerOptions}
      members={teamMembers}
      onSetSchool={handleSetSchool}
      onMarkPresent={handleMarkPresent}
      onRequestPhoto={handleRequestPhoto}
      busy={teamBusy}
    />
  )

  const pendingArrival = assignment.today?.arrival
  const pendingArrivalMs = resolveEventMs(pendingArrival?.at, pendingArrival?.phoneTime) ?? Number.NaN
  const unconfirmedMinutes =
    pendingArrival && !Number.isNaN(pendingArrivalMs)
      ? Math.max(0, Math.floor((nowTick - pendingArrivalMs) / 60_000))
      : 0
  const isConfirmationOverdue =
    Boolean(pendingArrival && !pendingArrival.confirmed && !isCheckedIn) &&
    unconfirmedMinutes >= UNCONFIRMED_GRACE_MS / 60_000

  const confirmationNotice =
    pendingArrival && !pendingArrival.confirmed && !isCheckedIn ? (
      <div
        role="status"
        className={`w-full rounded-xl border px-3.5 py-2.5 flex items-center gap-2 ${
          isConfirmationOverdue
            ? 'border-amber-500/60 bg-amber-500/15'
            : 'border-amber-500/40 bg-amber-500/10'
        }`}
      >
        <span className="size-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="flex-1 leading-snug text-xs text-amber-200">
          {isConfirmationOverdue ? (
            <>
              <strong>Please confirm now.</strong> We detected you at the centre{' '}
              {unconfirmedMinutes} minutes ago and Regional Command has not seen your
              confirmation.
            </>
          ) : (
            <>
              We detected you at the centre. Tap <strong>I&apos;m here</strong> to confirm for
              Regional Command.
            </>
          )}
        </span>
      </div>
    ) : null

  const detectionNote =
    activeDetection === 'native-background' ? (
      <p className="text-[11px] leading-snug text-slate-400 font-sans">
        Your phone records location even while the app is in the background. Keep the
        &ldquo;WAEC field tracking&rdquo; notification on.
      </p>
    ) : (
      <p className="text-[11px] leading-snug text-slate-400 font-sans">
        On the web, location is checked only while this page is open. It cannot see you when the
        page is closed.
      </p>
    )

  const photoRequestBanner = photoRequest ? (
    <div
      role="status"
      className="w-full rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2.5 flex flex-col gap-2"
    >
      <div className="flex items-start gap-2">
        <Camera className="size-4 text-sky-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-sky-200">One photo requested</p>
          <p className="text-[11px] leading-snug text-sky-100/85 mt-0.5">
            {photoRequest.reason}. The photo will carry the school, date, time and your name.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={evidenceBusy}
        onClick={() => {
          fulfillAfterUploadRef.current = photoRequest.id
          evidenceInputRef.current?.click()
        }}
        className="h-11 w-full rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
      >
        {evidenceBusy ? 'Saving photo…' : 'Take the requested photo'}
      </button>
    </div>
  ) : null

  return (
    <div className="min-h-screen w-full bg-[#070913] text-zinc-100 flex flex-col font-sans select-none antialiased">
      {/* App chrome — banners and header stay pinned while the officer scrolls */}
      <div className="sticky top-0 z-30 shrink-0">
        {/* Offline Alert Banner */}
        <OfflineBanner
          isOffline={isOffline}
          queuedCount={queuedSosCount + queuedArrivalCount}
        />

        {deviceWarnings.length > 0 ? (
          <div
            role="status"
            className="w-full border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-[11px] leading-snug text-amber-200 font-sans"
          >
            <strong>Phone check:</strong> {deviceWarnings.join(' ')}
          </div>
        ) : null}

        {/* Active SOS Beacon Banner (persisted across reloads until stood down or resolved) */}
        {isSosActive && (
          <div className="w-full bg-red-600/20 border-b border-red-500/40 px-4 py-2 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2 font-semibold">
              <Radio className="size-4 text-red-400 animate-pulse shrink-0" />
              <span>Help has been called — Regional Command has your location</span>
            </div>
            <button
              type="button"
              onClick={() => setSosModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition cursor-pointer shrink-0"
            >
              View alert
            </button>
          </div>
        )}

        {/* Main Field Header */}
        <FieldHeader
          session={session}
          zoneName={centerZone}
          batteryLevel={batteryLevel}
          isGpsActive={deviceGpsActive}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      </div>

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

      {/* ============================================================ */}
      {/* --- RESPONSIVE LAYOUT CONTAINER --- */}
      {/* ============================================================ */}

      {/* 1. MOBILE VIEWPORT (< 1024px): single column with native-app rhythm */}
      <div className="flex-1 lg:hidden w-full">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-[calc(11rem_+_env(safe-area-inset-bottom))]">
          {/* Hero map */}
          <div className="relative h-[300px] w-full shrink-0">
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
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#1A2035] bg-[#0C101A] p-6 text-center">
                <Building2 className="size-7 text-slate-500" />
                <div className="text-xs font-semibold text-slate-300">
                  {isAssignmentLoading
                    ? 'Loading assigned venue…'
                    : 'No examination centre assigned yet'}
                </div>
              </div>
            )}
          </div>

          {/* Check-in status */}
          <section className="flex flex-col gap-2.5">
            <SectionLabel>Check-in status</SectionLabel>
            <StatusCard
              state={statusCardState}
              distanceMeters={distanceMeters ?? 0}
              geofenceRadius={geofenceRadius}
              checkInTime={checkInTimestamp || 'Just now'}
              elapsedFormatted={formatTimer(shiftSeconds)}
              onRetryGps={handleRetryGps}
            />
            <div className="rounded-xl border border-[#161B2B] bg-[#0B0E18] px-3.5 py-2.5">
              {detectionNote}
            </div>
          </section>

          {/* Your centre */}
          <section className="flex flex-col gap-2.5">
            <SectionLabel>Your centre</SectionLabel>
            <VenueCard
              venueName={centerVenue}
              venueCode={centerCode}
              zoneName={centerZone}
              regionName={centerRegion}
            />
            {todaySchoolCard}
          </section>

          {/* Today's duty */}
          <section className="flex flex-col gap-2.5">
            <SectionLabel>Today&apos;s duty</SectionLabel>
            {isAssignmentLoading ? (
              <div className="h-[88px] animate-pulse rounded-2xl border border-[#1C2337] bg-[#0F121E]" />
            ) : (
              emptyDutyCard ?? <PaperTiles assignment={paperAssignment} />
            )}
            {confirmationNotice}
            {photoRequestBanner}
            {pendingArrival && !pendingArrival.confirmed && !isCheckedIn && (
              <button
                type="button"
                onClick={handleCheckIn}
                className="h-12 w-full rounded-xl border border-white/10 bg-[#1E2B7B] text-[13px] font-bold text-white transition hover:bg-[#28389E] cursor-pointer"
              >
                Confirm — I&apos;m here
              </button>
            )}
            {evidenceDock}
          </section>

          {/* Schedule — the card carries its own expand header */}
          {todayTimeline.length > 0 && <DayTimeline items={todayTimeline} collapsible={true} />}

          <p className="px-2 text-center text-[11px] leading-snug text-slate-500 select-none">
            In danger? Press and hold the red SOS button to call for help.
          </p>
        </div>
      </div>

      {/* Mobile action dock — the primary action never scrolls away */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1A2035] bg-[#0A0D18]/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <CheckInButton
                isInside={isInside && Boolean(activeVenue)}
                distanceMeters={distanceMeters}
                geofenceRadius={geofenceRadius}
                isCheckedIn={isCheckedIn}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
              />
            </div>
            {isFeatureEnabled('FIELD_INCIDENT_REPORTING') ? (
              <div className="flex w-[92px] shrink-0">
                <ReportButton
                  onOpenReport={() => setReportModalOpen(true)}
                  heightClass="h-[60px]"
                />
              </div>
            ) : null}
          </div>
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
                  ? 'Loading your duty assignment…'
                  : 'No examination centre assigned'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Contact Regional Command to assign you an examination centre and paper timetable.
              </p>
            </div>
          ) : null}
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
            {detectionNote}

            {/* Venue Card */}
            <VenueCard
              venueName={centerVenue}
              venueCode={centerCode}
              zoneName={centerZone}
              regionName={centerRegion}
            />

            {todaySchoolCard}

            {/* Paper / Arrive Tiles */}
            {emptyDutyCard ?? <PaperTiles assignment={paperAssignment} />}

            {/* Today Timeline */}
            {todayTimeline.length > 0 && <DayTimeline items={todayTimeline} />}
          </div>

          {/* Action Dock (Pinned to panel bottom) */}
          <div className="space-y-2.5 pt-2">
            {confirmationNotice}
            {photoRequestBanner}
            {pendingArrival && !pendingArrival.confirmed && !isCheckedIn && (
              <button
                type="button"
                onClick={handleCheckIn}
                className="w-full h-11 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] text-xs font-bold text-white transition cursor-pointer border border-white/10"
              >
                Confirm — I&apos;m here
              </button>
            )}
            <CheckInButton
              isInside={isInside && Boolean(activeVenue)}
              distanceMeters={distanceMeters}
              geofenceRadius={geofenceRadius}
              isCheckedIn={isCheckedIn}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />

            {evidenceDock}

            <SosHoldButton
              onTriggerSos={handleTriggerSos}
              isOffline={isOffline}
              variant="dock"
            />

            {isFeatureEnabled('FIELD_INCIDENT_REPORTING') ? (
              <ReportButton onOpenReport={() => setReportModalOpen(true)} />
            ) : null}

            <p className="text-[11px] text-slate-500 text-center select-none pt-1">
              Keyboard: focus SOS and hold Space for 1 second.
            </p>
          </div>
        </div>
      </div>

      {/* Emergency trigger — always reachable in the phone thumb zone */}
      <SosHoldButton
        onTriggerSos={handleTriggerSos}
        isOffline={isOffline}
        variant="floating"
      />

      {/* Emergency SOS confirmation / stand-down */}
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

      {/* Routine issues — kept separate from the emergency path */}
      <IncidentReportSheet
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onSubmit={submitIncidentReport}
        centerName={centerVenue}
        isOffline={isOffline}
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
