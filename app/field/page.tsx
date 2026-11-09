'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getCurrentClientSession, SessionData, clearClientSession } from '@/lib/auth/session'
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

// Dynamic import for Leaflet FieldMap (SSR false, lazy loaded)
const FieldMap = dynamic(() => import('@/components/field/FieldMap'), {
  ssr: false,
  loading: () => (
    <div className="size-full flex flex-col items-center justify-center bg-[#0C101A] text-slate-400 gap-2.5 rounded-2xl border border-[#1A2035]">
      <div className="size-7 border-2 border-[#1E2B7B] border-t-[#F6D300] rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-400">Loading Map View...</span>
    </div>
  ),
})

export default function FieldPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  // Geofence & Check-in States
  const [gpsMode, setGpsMode] = useState<'live' | 'mock-inside' | 'mock-outside'>('live')
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied'>('searching')
  const [testVenueOverride, setTestVenueOverride] = useState<{ lat: number; lng: number; name: string } | null>(null)

  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false)
  const [checkInTimestamp, setCheckInTimestamp] = useState<string>('07:54 GMT')
  const [shiftSeconds, setShiftSeconds] = useState<number>(0)
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false)
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false)
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const [queuedSosCount, setQueuedSosCount] = useState<number>(0)
  const [isDesktop, setIsDesktop] = useState<boolean>(true)
  const [deviceGpsActive, setDeviceGpsActive] = useState<boolean>(true)
  const [batteryLevel, setBatteryLevel] = useState<number>(84)

  // Battery Status API (if supported)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      ;(navigator as any).getBattery?.().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100))
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100))
        })
      }).catch(() => {})
    }
  }, [])

  // Real GPS Geofence Watcher
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setDeviceGpsActive(false)
      setGpsStatus('denied')
      return
    }

    setGpsStatus('searching')

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGpsActive(true)
        setGpsStatus('active')
        setLiveCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
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

  // Track responsive screen size to mount Leaflet only in the visible layout
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Verify authentication on mount
  useEffect(() => {
    const s = getCurrentClientSession()
    if (s) {
      if (s.role === 'ADMIN') {
        router.push('/admin')
        return
      }
      if (s.mustChangePassword) {
        router.push('/change-password')
        return
      }
      setSession(s)
    } else {
      router.push('/login')
      return
    }
  }, [router])

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Shift Timer when checked in
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isCheckedIn) {
      interval = setInterval(() => {
        setShiftSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isCheckedIn])

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Handle Duty Check-In
  const handleCheckIn = async () => {
    if (!isInside) return
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
    setCheckInTimestamp(nowTime)
    setIsCheckedIn(true)

    try {
      if (session) {
        await fetch('/api/officers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.userId,
            action: 'TOGGLE_DUTY',
            dutyStatus: 'ON_DUTY',
          }),
        })
      }
    } catch {
      // Offline fallback
    }
  }

  const handleCheckOut = async () => {
    setIsCheckedIn(false)
    try {
      if (session) {
        await fetch('/api/officers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.userId,
            action: 'TOGGLE_DUTY',
            dutyStatus: 'OFF_DUTY',
          }),
        })
      }
    } catch {
      // Offline fallback
    }
  }

  // Handle SOS Trigger
  const handleTriggerSos = async () => {
    if (isOffline) {
      setQueuedSosCount((prev) => prev + 1)
      return
    }

    try {
      if (session) {
        await fetch('/api/officers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: session.userId,
            action: 'TRIGGER_SOS',
          }),
        })
      }
    } catch {
      setQueuedSosCount((prev) => prev + 1)
    }

    setSosModalOpen(true)
  }

  const handleLogout = () => {
    clearClientSession()
    router.push('/login')
  }

  // Active Venue details (supports test location override)
  const defaultVenue = {
    lat: 6.7028,
    lng: -1.6369,
    name: session?.assignedCenter || 'Prempeh College Center A',
    code: session?.assignedCenterCode || '050102',
  }
  const activeVenue = testVenueOverride
    ? { ...defaultVenue, lat: testVenueOverride.lat, lng: testVenueOverride.lng, name: testVenueOverride.name }
    : defaultVenue

  const officerName = session?.name || 'Kofi Mensah'
  const centerVenue = activeVenue.name
  const centerCode = activeVenue.code

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
  let distanceMeters = 42
  let isInside = true

  if (gpsMode === 'live' && liveCoords) {
    effectiveUserLat = liveCoords.lat
    effectiveUserLng = liveCoords.lng
    distanceMeters = calculateHaversine(
      liveCoords.lat,
      liveCoords.lng,
      activeVenue.lat,
      activeVenue.lng
    )
    isInside = distanceMeters <= 150
  } else if (gpsMode === 'mock-outside') {
    distanceMeters = 450
    isInside = false
  } else {
    // 'mock-inside' or fallback before liveCoords arrive
    distanceMeters = 42
    isInside = true
  }

  const statusCardState: StatusCardState = isCheckedIn
    ? 'checked-in'
    : gpsMode === 'live' && gpsStatus === 'denied'
    ? 'gps-denied'
    : gpsMode === 'live' && gpsStatus === 'searching' && !liveCoords
    ? 'gps-searching'
    : isInside
    ? 'inside'
    : 'outside'

  const paperAssignment: PaperAssignment = {
    title: 'Core Mathematics 1 and 2',
    timeRange: '08:30 to 12:00 GMT',
    arriveBy: '08:00',
    collectBy: 'Collect at 07:45',
  }

  const todayTimeline: TimelineItem[] = [
    { time: '07:45', label: 'Collect papers', isHighlight: false },
    { time: '08:00', label: 'Check in deadline', isHighlight: true },
    { time: '08:30', label: 'Core Mathematics 1 and 2 begins', isHighlight: false },
    { time: '12:00', label: 'Paper ends', isHighlight: false },
  ]

  return (
    <div className="min-h-screen w-full bg-[#070913] text-zinc-100 flex flex-col font-sans select-none antialiased">
      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} queuedCount={queuedSosCount} />

      {/* Main Field Header */}
      <FieldHeader
        session={session}
        batteryLevel={batteryLevel}
        isGpsActive={deviceGpsActive}
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
          {!isDesktop && (
            <FieldMap
              centerName={centerVenue}
              centerCode={centerCode}
              centerLat={activeVenue.lat}
              centerLng={activeVenue.lng}
              radiusMeters={150}
              isInside={isInside}
              distanceMeters={distanceMeters}
              userLat={effectiveUserLat}
              userLng={effectiveUserLng}
            />
          )}

          {/* Testing & GPS Mode switcher */}
          <div className="absolute top-3 right-3 z-[400] flex items-center p-0.5 rounded-lg bg-[#0B0F1A]/90 border border-[#212A40] text-[10px] backdrop-blur-md">
            <button
              type="button"
              onClick={() => setGpsMode('live')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                gpsMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className={`size-1.5 rounded-full ${gpsStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              Live
            </button>
            <button
              type="button"
              onClick={() => setGpsMode('mock-inside')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                gpsMode === 'mock-inside' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              42m
            </button>
            <button
              type="button"
              onClick={() => setGpsMode('mock-outside')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                gpsMode === 'mock-outside' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              450m
            </button>
          </div>

          {/* Quick Test Trigger for Live GPS */}
          {gpsMode === 'live' && liveCoords && distanceMeters > 150 && (
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
              🎯 Test Check-In Here
            </button>
          )}
          {testVenueOverride && (
            <button
              type="button"
              onClick={() => setTestVenueOverride(null)}
              className="absolute bottom-12 right-3 z-[400] text-[10px] font-semibold bg-[#1C1215]/95 text-red-300 hover:text-white border border-red-500/30 px-2 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              ✕ Reset
            </button>
          )}
        </div>

        {/* Status Card */}
        <StatusCard
          state={statusCardState}
          distanceMeters={distanceMeters}
          checkInTime={checkInTimestamp}
          elapsedFormatted={formatTimer(shiftSeconds)}
        />

        {/* Paper / Arrive Tiles */}
        <PaperTiles assignment={paperAssignment} />

        {/* Mobile Collapsible Schedule Timeline */}
        <DayTimeline items={todayTimeline} collapsible={true} />

        {/* Action Dock */}
        <div className="w-full space-y-2.5 pt-2">
          <CheckInButton
            isInside={isInside}
            distanceMeters={distanceMeters}
            geofenceRadius={150}
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
          {isDesktop && (
            <FieldMap
              centerName={centerVenue}
              centerCode={centerCode}
              centerLat={activeVenue.lat}
              centerLng={activeVenue.lng}
              radiusMeters={150}
              isInside={isInside}
              distanceMeters={distanceMeters}
              userLat={effectiveUserLat}
              userLng={effectiveUserLng}
            />
          )}

          {/* Testing & GPS Mode switcher */}
          <div className="absolute top-3 right-3 z-[400] flex items-center p-0.5 rounded-lg bg-[#0B0F1A]/90 border border-[#212A40] text-[10px] backdrop-blur-md">
            <button
              type="button"
              onClick={() => setGpsMode('live')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                gpsMode === 'live' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className={`size-1.5 rounded-full ${gpsStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              🛰️ Live GPS
            </button>
            <button
              type="button"
              onClick={() => setGpsMode('mock-inside')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                gpsMode === 'mock-inside' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inside (42m)
            </button>
            <button
              type="button"
              onClick={() => setGpsMode('mock-outside')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                gpsMode === 'mock-outside' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Outside (450m)
            </button>
          </div>

          {/* Quick Test Trigger for Live GPS */}
          {gpsMode === 'live' && liveCoords && distanceMeters > 150 && (
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
              🎯 Set Venue to My Location (Test Check-In)
            </button>
          )}
          {testVenueOverride && (
            <button
              type="button"
              onClick={() => setTestVenueOverride(null)}
              className="absolute bottom-12 right-3 z-[400] text-[10px] font-semibold bg-[#1C1215]/95 text-red-300 hover:text-white border border-red-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md shadow-md transition cursor-pointer"
            >
              ✕ Reset to Prempeh College
            </button>
          )}
        </div>

        {/* Right Column: 460px panel with action dock pinned to bottom */}
        <div className="w-[460px] flex flex-col justify-between space-y-3.5 self-stretch shrink-0">
          <div className="space-y-3.5">
            {/* Status Card */}
            <StatusCard
              state={statusCardState}
              distanceMeters={distanceMeters}
              checkInTime={checkInTimestamp}
              elapsedFormatted={formatTimer(shiftSeconds)}
            />

            {/* Venue Card */}
            <VenueCard
              venueName={centerVenue}
              venueCode={centerCode}
              zoneName="Kumasi Central Examination Zone"
              regionName="Ashanti Region"
            />

            {/* Paper / Arrive Tiles */}
            <PaperTiles assignment={paperAssignment} />

            {/* Today Timeline */}
            <DayTimeline items={todayTimeline} />
          </div>

          {/* Action Dock (Pinned to panel bottom) */}
          <div className="space-y-2.5 pt-2">
            <CheckInButton
              isInside={isInside}
              distanceMeters={distanceMeters}
              geofenceRadius={150}
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
        officerPin={session?.pin || '0412'}
        officerName={officerName}
        venueName={centerVenue}
        centerCode={centerCode}
        coords={
          liveCoords
            ? {
                lat: `${liveCoords.lat.toFixed(4)}° N`,
                lng: `${Math.abs(liveCoords.lng).toFixed(4)}° W`,
                acc: `±${liveCoords.accuracy}m`,
              }
            : { lat: '6.7028° N', lng: '1.6369° W', acc: '±4.2m' }
        }
        batteryLevel={`${batteryLevel}%`}
      />

      {/* Officer Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        session={session}
        onDutyStatus={isCheckedIn ? 'ON DUTY' : 'STANDBY'}
        onSave={(updated) => setSession((prev) => (prev ? { ...prev, ...updated } : null))}
        onLogout={handleLogout}
      />
    </div>
  )
}
