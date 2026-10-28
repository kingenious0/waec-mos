'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SessionData } from '@/lib/auth/session'
import {
  X,
  User,
  Shield,
  Building2,
  Mail,
  Phone,
  KeyRound,
  CheckCircle2,
  Lock,
  BadgeCheck,
  Star,
  MapPin,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  session: SessionData | null
  onDutyStatus?: string
}

export function ProfileModal({ isOpen, onClose, session, onDutyStatus }: ProfileModalProps) {
  const [showPin, setShowPin] = useState(false)
  if (!isOpen || !session) return null

  const initials = session.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isFieldOfficer = session.role === 'FIELD_OFFICER'
  const duty = onDutyStatus || (isFieldOfficer ? 'OFF DUTY' : 'HQ ACTIVE')
  const region = session.region || 'Ashanti Region'
  const group = session.group || 'Group 1'
  const isLeader = Boolean(session.isGroupLeader)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#303654] bg-[#11131f] shadow-[0_0_60px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon with WAEC Gold Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1e2b7b] via-[#f6d300] to-[#1e2b7b]" />

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-[#22263c] px-5 py-3.5 bg-[#0d0f18]/90">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-8 items-center justify-center overflow-hidden rounded-lg border border-[#303654] bg-[#15192b]">
              <Image
                src="/images/waec-logo.jpg"
                alt="WAEC"
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black tracking-wider text-white uppercase">
                Official Personnel Dossier
              </h2>
              <p className="text-[9px] text-slate-400">WAEC Monitoring & Operations System · V1</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg border border-[#303654] text-slate-400 transition hover:bg-[#15192b] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Content */}
        <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Officer Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-[#22263c] bg-[#15192b] p-4 text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
            {/* Background Watermark Crest */}
            <div className="pointer-events-none absolute right-0 top-0 size-32 opacity-10">
              <Image src="/images/waec-logo.jpg" alt="WAEC" fill className="object-contain" />
            </div>

            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-[#f6d300] bg-[#1e2b7b] text-xl font-black text-[#f6d300] shadow-[0_0_20px_rgba(246,211,0,.25)]">
              {session.photo ? (
                <Image src={session.photo} alt={session.name} fill className="object-cover rounded-xl" />
              ) : (
                initials
              )}
              {isLeader && (
                <div
                  title="Designated Group Leader"
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[#f6d300] text-black shadow-md"
                >
                  <Star size={12} className="fill-black" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-black">
                <BadgeCheck size={14} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-base font-black text-white">{session.name}</h3>
                <span className="rounded bg-[#1e2b7b] px-2 py-0.5 text-[9px] font-bold text-[#8290ff]">
                  {session.role === 'ADMIN' ? 'HQ ADMINISTRATOR' : 'FIELD OPERATIONS OFFICER'}
                </span>
              </div>

              {/* Group & Region Tagline */}
              <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded bg-[#0d0f18] px-2 py-0.5 font-bold text-[#f6d300] border border-[#303654]">
                  <Users size={11} />
                  <span>{group}</span>
                  {isLeader && <span className="text-[10px]">★ Leader</span>}
                </span>

                <span className="inline-flex items-center gap-1 rounded bg-[#0d0f18] px-2 py-0.5 text-slate-300 border border-[#303654]">
                  <MapPin size={11} className="text-[#8290ff]" />
                  <span>{region}</span>
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-center sm:justify-start gap-2 text-[10px] text-slate-400 font-mono">
                <span>STAFF ID: <strong className="text-white">{session.staffId}</strong></span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{session.status}</span>
              </div>
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Verified Phone Number */}
            <div className="rounded-xl border border-[#22263c] bg-[#0d0f18] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                  <Phone size={12} className="text-[#f6d300]" />
                  <span>Verified Auth Phone</span>
                </div>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[8px] font-bold text-emerald-400">
                  PRE-PROVISIONED
                </span>
              </div>
              <div className="mt-1.5 font-mono text-xs font-bold text-white">
                {session.phone || '+233 24 412 8900'}
              </div>
              <div className="text-[9px] text-slate-500">Primary login credential</div>
            </div>

            {/* Secret 4-Digit PIN */}
            <div className="rounded-xl border border-[#22263c] bg-[#0d0f18] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                  <Lock size={12} className="text-[#8290ff]" />
                  <span>4-Digit Secret PIN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <div className="mt-1.5 font-mono text-xs font-black text-[#f6d300] tracking-widest">
                {showPin ? (session.pin || '0412') : '••••'}
              </div>
              <div className="text-[9px] text-slate-500">Used with phone for instant field login</div>
            </div>

            {/* Work Email */}
            <div className="rounded-xl border border-[#22263c] bg-[#0d0f18] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                <Mail size={12} className="text-[#8290ff]" />
                <span>Official Work Email</span>
              </div>
              <div className="mt-1.5 font-mono text-xs font-semibold text-white truncate">
                {session.email}
              </div>
            </div>

            {/* Duty Status */}
            <div className="rounded-xl border border-[#22263c] bg-[#0d0f18] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                <Shield size={12} className="text-emerald-400" />
                <span>Current Shift State</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    duty.includes('ON')
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      duty.includes('ON') ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {duty}
                </span>
              </div>
            </div>

            {/* Primary Examination Venue */}
            <div className="sm:col-span-2 rounded-xl border border-[#22263c] bg-[#0d0f18] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                  <Building2 size={12} className="text-[#8290ff]" />
                  <span>Primary Assigned Venue</span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#f6d300]">
                  CENTER {session.assignedCenterCode || '050102'}
                </span>
              </div>
              <div className="mt-1.5 text-xs font-bold text-white">{session.assignedCenter}</div>
              <div className="text-[10px] text-slate-400">{region} • Geofence Radius 150m</div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-xl border border-[#303654] bg-[#0d0f18] p-3 text-[11px] text-slate-400">
            <span className="font-bold text-white">Closed Security Governance: </span>
            Field deployment profiles and group assignments are managed exclusively by WAEC National Headquarters Operations Command.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#22263c] px-5 py-3 bg-[#0d0f18]/90">
          <span className="font-mono text-[9px] text-slate-500">
            MOS-ID: {session.userId.slice(0, 8)} • WAEC GHANA
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#303654] bg-[#15192b] px-3.5 py-1 text-xs font-bold text-slate-300 transition hover:bg-[#22263c] hover:text-white"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  )
}
