'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Mail,
  Phone,
  ShieldCheck,
  MapPin,
  KeyRound,
  ChevronRight,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { getClientSession, signOutEverywhere, type SessionData } from '@/lib/auth/session'
import { formatGhanaPhone } from '@/lib/phone'
import { humanizeRole, relativeDays } from '@/lib/name-utils'

interface ProfileData {
  id: string
  name: string
  title: string | null
  firstName: string | null
  lastName: string | null
  email: string
  phone: string | null
  photo: string | null
  bio: string | null
  staffId: string | null
  role: string
  status: string
  group: string | null
  pinChangedAt: string | null
  regionName: string | null
}

/**
 * Full-page admin profile at /profile — the board-accurate view of the
 * signed-in administrator. Below md: stacked sections. md+: identity card
 * on the left, Personal details / Assignment / Security on the right.
 * View-mode only in this build; edit/PIN flow ships next phase.
 */
export default function ProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [editNoteVisible, setEditNoteVisible] = useState(false)

  useEffect(() => {
    getClientSession().then((s) => {
      if (!s) {
        router.replace('/login')
        return
      }
      setSession(s)
    })
  }, [router])

  const loadProfile = React.useCallback(async (userId: string) => {
    setStatus('loading')
    try {
      const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Profile request failed')
      const data = await res.json()
      setProfile(data.profile as ProfileData)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (session?.userId) void loadProfile(session.userId)
  }, [session?.userId, loadProfile])

  const handleSignOut = () => {
    signOutEverywhere().finally(() => {
      router.push('/login')
    })
  }

  const displayName = useMemo(() => {
    if (profile) {
      const composed = [profile.title, profile.firstName, profile.lastName]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ')
      return composed || profile.name
    }
    return session?.name || ''
  }, [profile, session])

  const initials = useMemo(() => {
    return displayName
      .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Eng\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [displayName])

  if (!session) return null

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#090A0F] text-foreground font-sans flex flex-col">
        <ProfileTopBar onBack={() => router.back()} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-2xl border border-[#22263C] bg-[#0E111D] p-6 text-center space-y-3">
            <div className="size-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-6 text-amber-400" />
            </div>
            <h1 className="text-base font-bold text-white">Couldn’t load your profile</h1>
            <p className="text-xs text-slate-400">
              Check your connection and try again. Your data is safe.
            </p>
            <button
              type="button"
              onClick={() => session.userId && void loadProfile(session.userId)}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading' || !profile) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-foreground font-sans flex flex-col">
        <ProfileTopBar onBack={() => router.back()} />
        <ProfileSkeleton />
      </div>
    )
  }

  const isActive = profile.status === 'ACTIVE'
  const statusLabel = isActive ? 'Active' : 'Revoked'
  const roleLabel = humanizeRole(profile.role)
  const phoneDisplay = formatGhanaPhone(profile.phone)
  const region = profile.regionName || session.region || 'Ashanti Region'
  const pinLine = profile.pinChangedAt
    ? `Last changed ${relativeDays(profile.pinChangedAt).toLowerCase()}`
    : 'PIN not changed yet'

  const editNote = (
    <div className="mb-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 flex items-start gap-2.5">
      <span className="text-xs text-indigo-300 leading-snug">
        Edit mode arrives in the next update — this build shows your live profile.
      </span>
      <button
        type="button"
        onClick={() => setEditNoteVisible(false)}
        className="ml-auto shrink-0 text-indigo-300 hover:text-white text-[11px] font-semibold cursor-pointer"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )

  const statusChip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
        isActive
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
      }`}
    >
      <span className={`size-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {statusLabel}
    </span>
  )

  const staffChip = (
    <span className="inline-flex items-center rounded-full border border-[#22263C] bg-[#11131F] px-3 py-1 text-[11px] font-semibold text-slate-300 tracking-wide">
      {profile.staffId || '—'}
    </span>
  )

  /* ============ MOBILE VIEW (< md) ============ */
  const mobileView = (
    <div className="md:hidden flex-1 overflow-y-auto">
      {/* App bar */}
      <header className="h-[60px] shrink-0 sticky top-0 z-20 flex items-center justify-between border-b border-[#22263C] bg-[#0B0D14]/95 backdrop-blur-md px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="size-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
        >
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-base font-bold text-white tracking-tight">Profile</h1>
        <button
          type="button"
          onClick={() => setEditNoteVisible((v) => !v)}
          className="h-11 px-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200 transition cursor-pointer"
        >
          Edit
        </button>
      </header>

      <div className="p-4 space-y-5 pb-8">
        {editNoteVisible && editNote}

        {/* Identity */}
        <div className="flex items-center gap-4 pt-1">
          <div className="size-24 shrink-0 rounded-full bg-[#1E2B7B] border border-white/10 flex items-center justify-center overflow-hidden">
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo} alt={displayName} className="size-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white leading-tight text-pretty">
              {displayName}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{roleLabel}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {statusChip}
              {staffChip}
            </div>
          </div>
        </div>

        {/* Contact */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
          <h3 className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Contact
          </h3>
          <div className="divide-y divide-[#1E243A] mt-2">
            <ProfileRow icon={<Mail className="size-5 text-slate-400" />} label="Email" value={profile.email} />
            <ProfileRow icon={<Phone className="size-5 text-slate-400" />} label="Phone" value={phoneDisplay} />
          </div>
        </section>

        {/* Assignment */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
          <div className="px-4 pt-4 flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Assignment
            </h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              <ShieldCheck className="size-3.5" />
              Managed by HQ
            </span>
          </div>
          <div className="divide-y divide-[#1E243A] mt-2">
            <ProfileRow icon={<ShieldCheck className="size-5 text-slate-400" />} label="Role" value={roleLabel} />
            <ProfileRow icon={<MapPin className="size-5 text-slate-400" />} label="Command region" value={region} />
          </div>
        </section>

        {/* Security — Change PIN only (no server-side sessions exist) */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
          <h3 className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Security
          </h3>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setEditNoteVisible(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition cursor-pointer"
            >
              <span className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
                <KeyRound className="size-5 text-slate-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-slate-500">Change PIN</span>
                <span className="block text-sm font-semibold text-white mt-0.5">{pinLine}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-slate-500" />
            </button>
          </div>
        </section>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 font-semibold text-sm transition cursor-pointer"
        >
          <LogOut className="size-5" />
          Sign out
        </button>
      </div>
    </div>
  )

  /* ============ DESKTOP VIEW (md+) ============ */
  const desktopView = (
    <div className="hidden md:flex flex-1 flex-col min-h-screen">
      {/* Desktop header */}
      <header className="h-16 shrink-0 flex items-center justify-between border-b border-[#22263C] bg-[#0B0D14] px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="size-11 flex items-center justify-center rounded-xl border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-lg font-bold text-white tracking-tight">Profile</h1>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="h-11 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 px-4 text-rose-400 hover:text-rose-300 text-sm font-bold transition cursor-pointer"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 lg:p-10">
        <div className="max-w-6xl mx-auto grid grid-cols-[400px_1fr] gap-6">
          {editNoteVisible && (
            <div className="col-span-2">
              {editNote}
            </div>
          )}

          {/* Identity card */}
          <div className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-8 flex flex-col items-center text-center shadow-2xl h-fit">
            <div className="size-36 rounded-full bg-[#1E2B7B] border border-white/10 flex items-center justify-center overflow-hidden">
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo} alt={displayName} className="size-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-white">{initials}</span>
              )}
            </div>
            <h2 className="mt-5 text-2xl font-bold text-white leading-tight">{displayName}</h2>
            <p className="mt-1.5 text-sm text-slate-400">{roleLabel}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {statusChip}
              {staffChip}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Personal details */}
            <section className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Personal details</h3>
                <button
                  type="button"
                  onClick={() => setEditNoteVisible((v) => !v)}
                  className="h-9 px-4 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-500/50 transition cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 mt-5">
                <ProfileField label="Title" value={profile.title || '—'} />
                <ProfileField label="First name" value={profile.firstName || '—'} />
                <ProfileField label="Last name" value={profile.lastName || '—'} />
                <ProfileField label="Phone" value={phoneDisplay} />
                <div className="col-span-2">
                  <ProfileField label="Email" value={profile.email} />
                </div>
                <div className="col-span-2">
                  <ProfileField label="About" value={profile.bio || '—'} />
                </div>
              </div>
            </section>

            {/* Assignment */}
            <section className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Assignment</h3>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <ShieldCheck className="size-4" />
                  Managed by HQ
                </span>
              </div>
              <div className="grid grid-cols-3 gap-6 mt-5">
                <ProfileField label="Staff ID" value={profile.staffId || '—'} />
                <ProfileField label="Role" value={roleLabel} />
                <ProfileField label="Command region" value={region} />
              </div>
            </section>

            {/* Security */}
            <section className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-6 shadow-xl">
              <h3 className="text-base font-semibold text-white">Security</h3>
              <button
                type="button"
                onClick={() => setEditNoteVisible(true)}
                className="mt-4 w-full flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-white/[0.03] transition text-left cursor-pointer"
              >
                <span className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
                  <KeyRound className="size-5 text-slate-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-slate-500">PIN</span>
                  <span className="block text-sm font-semibold text-white mt-0.5">{pinLine}</span>
                </span>
                <span className="h-9 px-4 flex items-center rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200">
                  Change PIN
                </span>
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#090A0F] text-foreground font-sans flex flex-col">
      {mobileView}
      {desktopView}
    </div>
  )
}

function ProfileTopBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="h-[60px] shrink-0 flex items-center border-b border-[#22263C] bg-[#0B0D14] px-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="size-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white transition cursor-pointer"
      >
        <ChevronLeft className="size-6" />
      </button>
      <h1 className="text-base font-bold text-white tracking-tight absolute left-1/2 -translate-x-1/2">
        Profile
      </h1>
    </header>
  )
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-slate-500">{label}</span>
        <span className="block text-sm font-semibold text-white mt-0.5 break-all">{value}</span>
      </span>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[11px] text-slate-500">{label}</span>
      <span className="block text-sm font-semibold text-white mt-1 leading-snug">{value}</span>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="flex items-center gap-4 pt-1">
        <div className="size-24 rounded-full bg-[#1A1F33] animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-44 rounded bg-[#1A1F33] animate-pulse" />
          <div className="h-3 w-28 rounded bg-[#161C2E] animate-pulse" />
          <div className="h-6 w-36 rounded-full bg-[#161C2E] animate-pulse" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-[#22263C] bg-[#0E111D] p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-[#1A1F33] animate-pulse" />
          <div className="h-11 rounded-xl bg-[#161C2E] animate-pulse" />
          <div className="h-11 rounded-xl bg-[#161C2E] animate-pulse" />
        </div>
      ))}
    </div>
  )
}
