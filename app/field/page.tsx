'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentClientSession, SessionData, clearClientSession } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { EmergencySosModal } from '@/components/emergency/EmergencySosModal'
import {
  Shield,
  Radio,
  Battery,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ChevronRight,
  User,
  LogOut,
  Navigation,
  Compass,
  Building2,
  Star,
  Flame,
  Phone,
  X,
  Volume2,
  LocateFixed,
  Layers,
} from 'lucide-react'

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

  // Emergency SOS Modal (Screen 2)
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
    <div className="min-h-screen w-full bg-[#07080D] text-zinc-100 flex flex-col justify-center items-center p-0 sm:py-6 sm:px-4 antialiased selection:bg-[#1E2B7B] selection:text-white">
      {/* STRICT MOBILE VIEWPORT CONTAINER */}
      <div className="w-full max-w-md h-[100dvh] sm:h-[844px] flex flex-col bg-[#090A0F] border border-[#1A1F36] sm:rounded-[36px] shadow-2xl relative overflow-hidden">
        
        {/* ============================================================ */}
        {/* 1. TOP OPERATIONAL BAR */}
        {/* ============================================================ */}
        <header className="shrink-0 z-30 px-4 py-3 bg-[#0A0D18]/95 border-b border-[#1A2035] backdrop-blur-md flex items-center justify-between">
          {/* Left: Compact Branding Badge */}
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center font-bold text-[#F6D300] text-xs shadow-md shadow-[#1E2B7B]/30">
              MOS
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-black text-white text-xs tracking-tight">WAEC MOS</span>
                <span className="inline-block size-1 rounded-full bg-slate-500" />
                <span className="text-[10px] font-mono font-bold text-[#F6D300]">ACTIVE SESSION</span>
              </div>
              <p className="text-[9px] font-mono text-zinc-400">KUMASI CENTRAL ZONE</p>
            </div>
          </div>

          {/* Right: Telemetry Indicators */}
          <div className="flex items-center gap-2">
            {/* GPS Lock & Live Pulse */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#101424] border border-[#1C243E] text-[10px] font-mono">
              <Navigation className="size-3 text-emerald-400 fill-emerald-400" />
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 font-bold">GPS LOCK</span>
            </div>

            {/* Battery Indicator */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#101424] border border-[#1C243E] text-[10px] font-mono text-zinc-300">
              <Battery className="size-3.5 text-emerald-400" />
              <span className="font-bold">84%</span>
            </div>

            {/* Profile Avatar / Menu Trigger */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              title="Open Officer Dossier"
              className="size-7 rounded-full bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center text-[#F6D300] text-xs font-bold hover:bg-[#25369A] transition cursor-pointer"
            >
              <User size={13} />
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* 2. TOP HALF: MAP CANVAS (35% - 38% Height) */}
        {/* ============================================================ */}
        <div className="relative h-[36%] w-full bg-[#080B14] overflow-hidden select-none border-b border-[#1A2035]">
          {/* Tactical Vector Map Canvas (SVG) */}
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 400 240"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Radar Radial Gradient for 150m Geofence */}
              <radialGradient id="geofenceNavy" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1E2B7B" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#1E2B7B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#F6D300" stopOpacity="0.1" />
              </radialGradient>

              {/* Grid Pattern */}
              <pattern id="mapGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#161C2E" strokeWidth="0.8" />
              </pattern>
            </defs>

            {/* Map Background Grid */}
            <rect width="100%" height="100%" fill="#080B14" />
            <rect width="100%" height="100%" fill="url(#mapGrid)" />

            {/* Stylized Road Network (Kumasi Western Sector) */}
            <g stroke="#1A2238" strokeWidth="6" strokeLinecap="round" opacity="0.85">
              <path d="M -20,70 Q 120,60 220,90 T 420,130" fill="none" />
              <path d="M 200,-20 L 220,130 L 250,260" fill="none" />
              <path d="M 30,260 L 160,110 L 380,40" fill="none" />
            </g>
            <g stroke="#263152" strokeWidth="2.5" strokeLinecap="round">
              <path d="M -20,70 Q 120,60 220,90 T 420,130" fill="none" />
              <path d="M 200,-20 L 220,130 L 250,260" fill="none" />
              <path d="M 30,260 L 160,110 L 380,40" fill="none" />
            </g>

            {/* Street Names (Cartographic Micro-Labels) */}
            <text x="70" y="55" fill="#475569" fontSize="7" fontFamily="monospace" letterSpacing="1">
              KUMASI - SUNYANI ROAD
            </text>
            <text x="235" y="45" fill="#475569" fontSize="7" fontFamily="monospace" letterSpacing="1">
              PREMPEH BLVD
            </text>
            <text x="60" y="210" fill="#475569" fontSize="7" fontFamily="monospace" letterSpacing="1">
              SOFOLINE PASS
            </text>

            {/* CENTER DATUM: Prempeh College Center A (X: 220, Y: 110) */}
            {/* 150m Translucent Council Navy Geofence Circle with Amber Border */}
            <circle
              cx="220"
              cy="110"
              r="75"
              fill="url(#geofenceNavy)"
              stroke="#F6D300"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              className="animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            {/* Inner Accent Ring */}
            <circle cx="220" cy="110" r="30" fill="none" stroke="#2E41B6" strokeWidth="0.8" opacity="0.6" />

            {/* Center Datum Pin Marker */}
            <g transform="translate(220, 110)">
              {/* Outer Pulsing Aura */}
              <circle cx="0" cy="0" r="8" fill="#F6D300" opacity="0.3" className="animate-ping" />
              {/* Gold Center Core */}
              <circle cx="0" cy="0" r="6" fill="#F6D300" stroke="#080B14" strokeWidth="2" />
              {/* Datum Flag / Label */}
              <rect x="-42" y="-32" width="84" height="18" rx="4" fill="#0C101D" stroke="#F6D300" strokeWidth="1" />
              <text x="0" y="-20" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
                CENTER DATUM
              </text>
            </g>

            {/* USER GPS DOT (Simulated Inside vs Outside) */}
            {simulatedInside ? (
              // INSIDE STATE: (X: 242, Y: 125) -> ~42m from center
              <g transform="translate(242, 125)">
                {/* Distance Bearing Line to Center Datum */}
                <line x1="0" y1="0" x2="-22" y2="-15" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 2" />
                {/* Ping ring */}
                <circle cx="0" cy="0" r="14" fill="#3B82F6" opacity="0.3" className="animate-ping" />
                {/* Accuracy aura */}
                <circle cx="0" cy="0" r="8" fill="#1D4ED8" opacity="0.6" />
                {/* Blue Dot Core */}
                <circle cx="0" cy="0" r="5" fill="#60A5FA" stroke="#FFFFFF" strokeWidth="2" />
                {/* Micro User Tag */}
                <rect x="-24" y="9" width="48" height="13" rx="3" fill="#10B981" stroke="#064E3B" strokeWidth="0.8" />
                <text x="0" y="18" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">
                  YOU • 42m
                </text>
              </g>
            ) : (
              // OUTSIDE STATE: (X: 65, Y: 185) -> ~450m from center
              <g transform="translate(65, 185)">
                {/* Distance Bearing Line to Center Datum */}
                <line x1="0" y1="0" x2="155" y2="-75" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 3" />
                {/* Ping ring */}
                <circle cx="0" cy="0" r="14" fill="#EF4444" opacity="0.25" className="animate-ping" />
                {/* Blue Dot Core */}
                <circle cx="0" cy="0" r="6" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                {/* Micro User Tag */}
                <rect x="-30" y="9" width="60" height="13" rx="3" fill="#B45309" stroke="#F59E0B" strokeWidth="0.8" />
                <text x="0" y="18" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">
                  YOU • 450m
                </text>
              </g>
            )}
          </svg>

          {/* Map Top Floating Overlay: Center Tag */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A0E1A]/90 border border-[#1E253B] backdrop-blur-md">
            <MapPin className="size-3 text-[#F6D300]" />
            <span className="text-[10px] font-bold text-white tracking-tight">{centerVenue}</span>
            <span className="text-[9px] font-mono text-[#F6D300] bg-[#1E2B7B] px-1 rounded font-bold">
              {centerCode}
            </span>
          </div>

          {/* Map Top Right: Interactive Dev Simulation Switcher */}
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center p-0.5 rounded-lg bg-[#0C101D]/90 border border-[#1F263E] backdrop-blur-md text-[9px] font-mono">
            <button
              type="button"
              onClick={() => setSimulatedInside(true)}
              className={`px-2 py-1 rounded transition cursor-pointer font-bold ${
                simulatedInside ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Inside (42m)
            </button>
            <button
              type="button"
              onClick={() => setSimulatedInside(false)}
              className={`px-2 py-1 rounded transition cursor-pointer font-bold ${
                !simulatedInside ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Outside (450m)
            </button>
          </div>

          {/* Map Bottom Left: Geofence Spec Badge */}
          <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0A0D18]/90 border border-[#1A2238] text-[9px] font-mono text-zinc-300">
            <span className="size-1.5 rounded-full bg-[#F6D300]" />
            <span>150m Perimeter Boundary</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. BOTTOM HALF: TACTICAL DUTY SHEET (62% - 65% Height) */}
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
                  <div className="relative size-9 rounded-xl bg-[#1E2B7B] border border-[#2E41B6] flex items-center justify-center font-bold text-[#F6D300] text-sm">
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
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#F6D300]/20 text-[#F6D300] text-[9px] font-bold border border-[#F6D300]/30">
                          <Star className="size-2.5 fill-[#F6D300]" /> {groupName} Leader
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] font-mono text-zinc-400">Staff ID: {session?.staffId || 'WAEC-GH-0412'}</p>
                  </div>
                </div>

                {/* Duty Status Badge */}
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Assigned Venue</span>
                  <span className="text-[10px] font-mono text-zinc-500">Center Code: {centerCode}</span>
                </div>
                <div className="text-sm font-black text-white mt-0.5">{centerVenue}</div>
                <div className="text-[11px] text-zinc-400">Kumasi Central Examination Zone • Ashanti Region</div>
              </div>

              {/* Subject & Shift Timing */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-xl bg-[#111626] border border-[#1A2136] p-2.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase">
                    <Calendar className="size-3 text-[#F6D300]" />
                    <span>Today's Papers</span>
                  </div>
                  <div className="font-bold text-white text-xs mt-1">Core Mathematics 1 & 2</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">08:30 – 12:00 GMT</div>
                </div>

                <div className="rounded-xl bg-[#111626] border border-[#1A2136] p-2.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase">
                    <Clock className="size-3 text-emerald-400" />
                    <span>Arrival Target</span>
                  </div>
                  <div className="font-bold text-emerald-400 text-xs mt-1">By 08:00 GMT</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Depot Sign-in 07:45 GMT</div>
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
                    ✓ ON-SITE VERIFIED (42m to Center Datum)
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                    Hardware GPS confirmed within the official 150m examination perimeter. Check-in unlocked.
                  </p>
                </div>
              </div>
            ) : (
              // OUTSIDE GEOFENCE BADGE
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-amber-400 text-xs">
                    ⚠️ 450m OUTSIDE PERIMETER
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                    You are outside Prempeh College Center A. Approach within 150m to log attendance.
                  </p>
                </div>
              </div>
            )}

            {/* CHECK-IN STATUS CONFIRMATION (WHEN CHECKED IN) */}
            {isCheckedIn && (
              <div className="rounded-xl bg-[#0E1528] border border-[#1E2E5B] p-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Checked in at {checkInTimestamp}</span>
                </div>
                <div className="text-zinc-400 text-[11px]">
                  Elapsed: <strong className="text-white">{formatTimer(shiftSeconds)}</strong>
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
                    ? 'LOG FORMAL DUTY CHECK-IN'
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
          {/* EMERGENCY SOS TRIGGER BAR (OPENS STATE 2A PRE-ACTIVATION) */}
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
                  <div className="text-xs font-black text-white tracking-wider flex items-center gap-1.5">
                    <span>EMERGENCY SOS PROTOCOL</span>
                    <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  </div>
                  <p className="text-[10px] text-red-200/80">
                    Hostility / threat trigger • Ashanti Command line
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 border border-[#EF4444]/40 px-2 py-1 rounded text-[10px] font-mono font-bold text-red-300">
                <AlertTriangle className="size-3 text-amber-400" />
                <span>ACTIVATE SOS</span>
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* EMERGENCY SOS FLOW (SCREEN 2 - STATE 2A & STATE 2B) */}
        {/* ============================================================ */}
        <EmergencySosModal
          isOpen={sosModalOpen}
          onClose={() => setSosModalOpen(false)}
          officerPin={session?.pin || '0412'}
          officerName={officerName}
          venueName={centerVenue}
          centerCode={centerCode}
          coords={{ lat: '6.6924° N', lng: '1.6241° W', acc: '±4.2m' }}
          batteryLevel="82%"
        />

        {/* PROFILE DOSSIER MODAL */}
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
