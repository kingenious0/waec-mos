'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getCurrentClientSession, SessionData, clearClientSession } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { EmergencySosModal } from '@/components/emergency/EmergencySosModal'
import {
  Shield,
  Battery,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  User,
  Navigation,
  Star,
  Flame,
} from 'lucide-react'

// Dynamic import for Leaflet FieldMap to prevent SSR issues
const FieldMap = dynamic(() => import('@/components/field/FieldMap'), {
  ssr: false,
  loading: () => (
    <div className="size-full flex flex-col items-center justify-center bg-[#090D1A] text-slate-400 gap-2 font-sans">
      <div className="size-6 border-2 border-[#1E2B7B] border-t-[#F6D300] rounded-full animate-spin" />
      <span className="text-xs">Loading OpenStreetMap...</span>
    </div>
  ),
})

const defaultOfficerSession: SessionData = {
  userId: 'usr-field-1',
  staffId: 'WAEC-GH-0412',
  email: 'kmensah@waec.org',
  name: 'Kofi Mensah',
  phone: '+233 24 412 8900',
  pin: '0412',
  role: 'FIELD_OFFICER',
  status: 'ACTIVE',
  region: 'Ashanti Region',
  group: 'Group 1',
  isGroupLeader: true,
  assignedCenter: 'Prempeh College Center A',
  assignedCenterCode: '050102',
  photo: '',
  mustChangePassword: false,
}

export default function FieldPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(defaultOfficerSession)

  // Geofence & Check-in States
  // Distance: 42m (Inside) or 450m (Outside)
  const [simulatedInside, setSimulatedInside] = useState<boolean>(true)
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false)
  const [checkInTimestamp, setCheckInTimestamp] = useState<string>('07:54 GMT')
  const [shiftSeconds, setShiftSeconds] = useState<number>(0)
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false)

  // Emergency SOS Modal
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false)

  // Verify session on mount
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
      setSession(defaultOfficerSession)
    }
  }, [router])

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
    if (!simulatedInside) return
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

  const handleLogout = () => {
    clearClientSession()
    router.push('/login')
  }

  // Officer display data
  const officerName = session?.name || 'Kofi Mensah'
  const isLeader = session?.isGroupLeader !== undefined ? session.isGroupLeader : true
  const groupName = session?.group || 'Group 1'
  const centerVenue = session?.assignedCenter || 'Prempeh College Center A'
  const centerCode = session?.assignedCenterCode || '050102'

  return (
    <div className="min-h-screen w-full bg-[#07080D] text-zinc-100 flex flex-col justify-center items-center p-0 sm:py-6 sm:px-4 antialiased selection:bg-[#1E2B7B] selection:text-white font-sans">
      {/* STRICT MOBILE VIEWPORT CONTAINER */}
      <div className="w-full max-w-md h-[100dvh] sm:h-[844px] flex flex-col bg-[#090A0F] border border-[#1A1F36] sm:rounded-[36px] shadow-2xl relative overflow-hidden">
        
        {/* ============================================================ */}
        {/* 1. TOP OPERATIONAL BAR */}
        {/* ============================================================ */}
        <header className="shrink-0 z-30 px-4 py-3 bg-[#0A0D18]/95 border-b border-[#1A2035] backdrop-blur-md flex items-center justify-between">
          {/* Left: Compact Branding Badge */}
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center font-bold text-[#F6D300] text-xs shadow-md shadow-[#1E2B7B]/30">
              MOS
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-extrabold text-white text-xs tracking-tight">WAEC MOS</span>
                <span className="inline-block size-1 rounded-full bg-slate-500" />
                <span className="text-[10px] font-semibold text-[#F6D300]">ACTIVE SESSION</span>
              </div>
              <p className="text-[10px] font-medium text-zinc-400">Kumasi Central Zone</p>
            </div>
          </div>

          {/* Right: Telemetry Indicators */}
          <div className="flex items-center gap-2">
            {/* GPS Lock & Live Pulse */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101424] border border-[#1C243E] text-[10px]">
              <Navigation className="size-3 text-emerald-400 fill-emerald-400" />
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-200 font-semibold">GPS Active</span>
            </div>

            {/* Battery Indicator */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#101424] border border-[#1C243E] text-[10px] text-zinc-300">
              <Battery className="size-3.5 text-emerald-400" />
              <span className="font-semibold">84%</span>
            </div>

            {/* Profile Avatar / Menu Trigger */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              title="Open Officer Profile"
              className="size-8 rounded-full bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center text-[#F6D300] text-xs font-bold hover:bg-[#25369A] transition cursor-pointer shadow-sm"
            >
              <User size={14} />
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 2. TOP HALF: REAL LEAFLET OPENSTREETMAP CANVAS */}
        {/* ============================================================ */}
        <div className="relative h-[38%] w-full bg-[#080B14] overflow-hidden select-none border-b border-[#1A2035]">
          <FieldMap
            centerName={centerVenue}
            centerCode={centerCode}
            centerLat={6.7028}
            centerLng={-1.6369}
            radiusMeters={150}
            isInside={simulatedInside}
            officerName={officerName}
          />

          {/* Map Top-Left: Center Code & Venue Badge */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg">
            <MapPin className="size-3.5 text-[#F6D300]" />
            <span className="text-xs font-bold text-white tracking-tight">{centerVenue}</span>
            <span className="text-[10px] font-semibold text-[#F6D300] bg-[#1E2B7B] px-1.5 py-0.5 rounded-md">
              {centerCode}
            </span>
          </div>

          {/* Map Simulation Switcher (Bottom-Center for testing) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] flex items-center p-0.5 rounded-xl bg-slate-950/90 border border-slate-700/80 shadow-lg backdrop-blur-md text-[10px]">
            <button
              type="button"
              onClick={() => setSimulatedInside(true)}
              className={`px-2.5 py-1 rounded-lg transition font-semibold cursor-pointer ${
                simulatedInside ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Inside (42m)
            </button>
            <button
              type="button"
              onClick={() => setSimulatedInside(false)}
              className={`px-2.5 py-1 rounded-lg transition font-semibold cursor-pointer ${
                !simulatedInside ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Outside (450m)
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. BOTTOM HALF: ATTENDANCE & SCHEDULE SHEET */}
        {/* ============================================================ */}
        <div className="flex-1 bg-[#11131F] rounded-t-3xl border-t border-[#22263C] shadow-2xl flex flex-col justify-between p-4 relative z-20 overflow-y-auto">
          {/* Drag Handle Indicator */}
          <div className="mx-auto w-10 h-1 rounded-full bg-zinc-700/60 mb-2 shrink-0" />

          <div className="space-y-3.5">
            {/* DUTY STATION CARD */}
            <div className="rounded-2xl bg-[#0C0F1A] border border-[#1C2237] p-3.5 space-y-3 shadow-inner">
              {/* Card Header: Officer Name & Group Leader Badge */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#181E31]">
                <div className="flex items-center gap-2.5">
                  <div className="relative size-9 rounded-xl bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center font-bold text-[#F6D300] text-sm shadow-md">
                    {officerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-sm leading-tight flex items-center gap-1.5">
                      {officerName}
                      {isLeader && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F6D300]/20 text-[#F6D300] text-[10px] font-semibold border border-[#F6D300]/30">
                          <Star className="size-2.5 fill-[#F6D300]" /> {groupName} Leader
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-zinc-400">Staff ID: {session?.staffId || 'WAEC-GH-0412'}</p>
                  </div>
                </div>

                {/* Duty Status Badge */}
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      isCheckedIn
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${isCheckedIn ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                    {isCheckedIn ? 'ON DUTY' : 'STANDBY'}
                  </span>
                </div>
              </div>

              {/* Examination Venue & Code */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Assigned Venue</span>
                  <span className="text-xs font-semibold text-zinc-400">Code: {centerCode}</span>
                </div>
                <div className="text-sm font-extrabold text-white mt-0.5">{centerVenue}</div>
                <div className="text-xs text-zinc-400">Kumasi Central Examination Zone • Ashanti Region</div>
              </div>

              {/* Subject & Shift Timing */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-xl bg-[#111626] border border-[#1A2136] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase">
                    <Calendar className="size-3 text-[#F6D300]" />
                    <span>Today's Papers</span>
                  </div>
                  <div className="font-bold text-white text-xs mt-1">Core Mathematics 1 & 2</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">08:30 – 12:00 GMT</div>
                </div>

                <div className="rounded-xl bg-[#111626] border border-[#1A2136] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase">
                    <Clock className="size-3 text-emerald-400" />
                    <span>Arrival Target</span>
                  </div>
                  <div className="font-bold text-emerald-400 text-xs mt-1">By 08:00 GMT</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Collection: 07:45 GMT</div>
                </div>
              </div>
            </div>

            {/* DYNAMIC PERIMETER STATUS BADGE */}
            {simulatedInside ? (
              // INSIDE GEOFENCE BADGE
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-emerald-400 text-xs">
                    ✓ Verified On-Site (42m from Center)
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
                    GPS location verified within the official 150m examination perimeter. Attendance unlocked.
                  </p>
                </div>
              </div>
            ) : (
              // OUTSIDE GEOFENCE BADGE
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-amber-400 text-xs">
                    ⚠️ 450m Outside Perimeter
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
                    You are currently outside {centerVenue}. Please move within 150m to record attendance.
                  </p>
                </div>
              </div>
            )}

            {/* CHECK-IN STATUS CONFIRMATION (WHEN CHECKED IN) */}
            {isCheckedIn && (
              <div className="rounded-xl bg-[#0E1528] border border-[#1E2E5B] p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Checked in at {checkInTimestamp}</span>
                </div>
                <div className="text-zinc-400 text-xs">
                  Elapsed: <strong className="text-white font-semibold">{formatTimer(shiftSeconds)}</strong>
                </div>
              </div>
            )}

            {/* PRIMARY CHECK-IN ACTION BUTTON */}
            {!isCheckedIn ? (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={!simulatedInside}
                className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg ${
                  simulatedInside
                    ? 'bg-[#1E2B7B] hover:bg-[#25369A] border border-[#2E41B6] text-white shadow-[#1E2B7B]/40 active:scale-[0.98] cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/40 cursor-not-allowed opacity-80'
                }`}
              >
                <span>
                  {simulatedInside
                    ? 'CONFIRM ATTENDANCE / CHECK-IN'
                    : 'APPROACH CENTER TO UNLOCK CHECK-IN'}
                </span>
                <ChevronRight className={`size-4 ${simulatedInside ? 'text-[#F6D300]' : 'text-zinc-600'}`} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckOut}
                className="w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all cursor-pointer shadow-md"
              >
                <span>CONCLUDE SHIFT / CHECK-OUT</span>
              </button>
            )}
          </div>

          {/* ============================================================ */}
          {/* EMERGENCY SOS TRIGGER BAR */}
          {/* ============================================================ */}
          <div className="pt-3 border-t border-[#1C2237] shrink-0">
            <button
              type="button"
              onClick={() => setSosModalOpen(true)}
              className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-[#7F1D1D]/40 via-[#991B1B]/30 to-[#7F1D1D]/40 hover:from-[#7F1D1D]/60 hover:to-[#7F1D1D]/60 border border-[#EF4444]/50 shadow-lg py-3 px-4 flex items-center justify-between text-left cursor-pointer transition active:scale-[0.99] select-none group"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/50 flex items-center justify-center text-[#FCA5A5] group-hover:scale-105 transition">
                  <Flame className="size-4 animate-pulse text-[#EF4444]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
                    <span>EMERGENCY SOS ALERT</span>
                    <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  </div>
                  <p className="text-[11px] text-red-200/80">
                    Immediate dispatch • Ashanti Regional Control Room
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 border border-[#EF4444]/40 px-2.5 py-1 rounded-lg text-xs font-bold text-red-300">
                <AlertTriangle className="size-3 text-amber-400" />
                <span>ACTIVATE SOS</span>
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* EMERGENCY SOS MODAL */}
        {/* ============================================================ */}
        <EmergencySosModal
          isOpen={sosModalOpen}
          onClose={() => setSosModalOpen(false)}
          officerPin={session?.pin || '0412'}
          officerName={officerName}
          venueName={centerVenue}
          centerCode={centerCode}
          coords={{ lat: '6.7028° N', lng: '1.6369° W', acc: '±4.2m' }}
          batteryLevel="84%"
        />

        {/* PROFILE MODAL */}
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          session={session}
          onDutyStatus={isCheckedIn ? 'ON DUTY' : 'STANDBY'}
        />
      </div>
    </div>
  )
}
