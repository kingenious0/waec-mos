'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Phone,
  ShieldCheck,
  MapPin,
  KeyRound,
  ChevronRight,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Camera,
  Check,
  Loader2,
  Pencil,
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

interface Draft {
  title: string
  firstName: string
  lastName: string
  phone: string
  email: string
  bio: string
  photo: string
}

const PHONE_RE = /^(0|\+233)\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function blankDraft(p: ProfileData): Draft {
  return {
    title: p.title ?? '',
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    bio: p.bio ?? '',
    photo: p.photo ?? '',
  }
}

function ghanaPhoneOk(phone: string): boolean {
  const digits = phone.replace(/\s+/g, '')
  if (!digits) return true // optional
  return PHONE_RE.test(digits)
}

export default function ProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    title: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    bio: '',
    photo: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Change-PIN dialog (field officers only)
  const [pinOpen, setPinOpen] = useState(false)
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

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

  const isAdmin =
    !!profile &&
    ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(
      (profile.role || '').toUpperCase()
    )

  const startEditing = () => {
    if (!profile) return
    setDraft(blankDraft(profile))
    setSaveError('')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    if (!profile) return
    if (isDirty) {
      const ok = window.confirm('Discard your changes?')
      if (!ok) return
    }
    setIsEditing(false)
    setSaveError('')
  }

  const isDirty =
    !!profile &&
    (draft.title !== (profile.title ?? '') ||
      draft.firstName !== (profile.firstName ?? '') ||
      draft.lastName !== (profile.lastName ?? '') ||
      draft.phone !== (profile.phone ?? '') ||
      draft.email !== (profile.email ?? '') ||
      draft.bio !== (profile.bio ?? '') ||
      draft.photo !== (profile.photo ?? ''))

  // Warn about leaving with unsaved changes
  useEffect(() => {
    if (!isEditing || !isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isEditing, isDirty])

  const showToast = (text: string) => {
    setToast(text)
    window.clearTimeout((showToast as any)._t)
    ;(showToast as any)._t = window.setTimeout(() => setToast(null), 3500)
  }

  const validateDraft = (): string => {
    if (!draft.firstName.trim()) return 'Enter your first name.'
    if (!draft.lastName.trim()) return 'Enter your last name.'
    if (!ghanaPhoneOk(draft.phone)) return 'Enter a Ghana phone number (e.g. 024 000 0000).'
    if (draft.email.trim() && !EMAIL_RE.test(draft.email.trim())) return 'Enter a valid email address.'
    if (draft.bio.trim().length > 500) return 'About is too long (max 500 characters).'
    return ''
  }

  const handlePhotoFile = async (file: File) => {
    setSaveError('')
    if (!file.type.startsWith('image/')) {
      setSaveError('Pick an image file (JPEG, PNG or WebP).')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setSaveError('That image is too large. Pick one under 6 MB.')
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is not available in this browser')
      // centre square crop
      const side = Math.min(bitmap.width, bitmap.height)
      const sx = (bitmap.width - side) / 2
      const sy = (bitmap.height - side) / 2
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
      let dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      // shrink further if needed to stay under the server cap
      if (dataUrl.length > 850_000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      }
      setDraft((d) => ({ ...d, photo: dataUrl }))
      bitmap.close?.()
    } catch {
      setSaveError('Could not read that image. Try a different photo.')
    }
  }

  const handleSave = async () => {
    if (!profile) return
    const invalid = validateDraft()
    if (invalid) {
      setSaveError(invalid)
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const cleanPhone = draft.phone.trim().replace(/\s+/g, '')
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          phone: cleanPhone,
          email: draft.email.trim(),
          bio: draft.bio.trim(),
          photo: draft.photo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || 'Could not save. Check your connection and try again.')
        return
      }
      await loadProfile(profile.id)
      setIsEditing(false)
      showToast('Your profile is saved.')
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePin = async () => {
    setPinError('')
    if (pin1.length !== 4) return setPinError('Enter a 4-digit PIN.')
    if (pin1 !== pin2) return setPinError("The PINs don't match.")
    setPinBusy(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin1 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPinError(data.error || 'Could not change the PIN.')
        return
      }
      setPinOpen(false)
      setPin1('')
      setPin2('')
      if (profile?.id) await loadProfile(profile.id)
      showToast('Your PIN has changed.')
    } catch {
      setPinError('Could not change the PIN. Try again.')
    } finally {
      setPinBusy(false)
    }
  }

  const handleSignOut = () => {
    if (isEditing && isDirty) {
      const ok = window.confirm('Discard your changes and sign out?')
      if (!ok) return
    }
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
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#3b57f0] hover:bg-[#3250dd] text-white text-sm font-semibold transition cursor-pointer"
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

  const staffChip = profile.staffId ? (
    <span className="inline-flex items-center rounded-full border border-[#22263C] bg-[#161B2E] px-3 py-1 text-[11px] font-mono font-semibold text-slate-300">
      {profile.staffId}
    </span>
  ) : null

  const hiddenFile = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) void handlePhotoFile(file)
        e.target.value = ''
      }}
    />
  )

  const avatarBlock = (sizeClass: string, initialsClass: string) => (
    <div
      className={`${sizeClass} rounded-full bg-[#1E2B7B] border border-white/10 flex items-center justify-center overflow-hidden relative ${isEditing ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#3b57f0]/60 transition-shadow' : ''}`}
      onClick={() => isEditing && fileRef.current?.click()}
      role={isEditing ? 'button' : undefined}
      aria-label={isEditing ? 'Change profile photo' : undefined}
      tabIndex={isEditing ? 0 : -1}
      onKeyDown={(e) => {
        if (isEditing && (e.key === 'Enter' || e.key === ' ')) fileRef.current?.click()
      }}
    >
      {draftPhotoSrc(profile, draft, isEditing) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draftPhotoSrc(profile, draft, isEditing)!}
          alt={displayName}
          className="size-full object-cover"
        />
      ) : (
        <span className={initialsClass}>{initials}</span>
      )}
      {isEditing && (
        <span className="absolute bottom-0 inset-x-0 h-9 bg-black/60 flex items-center justify-center gap-1 text-[10px] font-semibold text-white">
          <Camera className="size-3.5" /> Change photo
        </span>
      )}
    </div>
  )

  const toastNote = toast && (
    <div
      role="status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/80 px-4 py-2.5 text-xs font-semibold text-emerald-300 shadow-2xl"
    >
      <Check className="size-4" />
      {toast}
    </div>
  )

  const saveErrorNote = saveError && (
    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-300 flex items-start gap-2">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <span>{saveError}</span>
    </div>
  )

  /* ============ MOBILE VIEW ============ */
  const mobileView = (
    <div className="md:hidden flex flex-col flex-1 min-h-screen">
      <header className="h-[60px] shrink-0 flex items-center border-b border-[#22263C] bg-[#0B0D14] px-2 relative">
        <button
          type="button"
          onClick={() => (isEditing ? cancelEditing() : router.back())}
          aria-label={isEditing ? 'Cancel editing' : 'Back'}
          className="size-11 flex items-center justify-center rounded-full text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-base font-bold text-white tracking-tight absolute left-1/2 -translate-x-1/2">
          {isEditing ? 'Edit profile' : 'Profile'}
        </h1>
        {!isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="ml-auto h-10 px-4 flex items-center gap-1.5 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer mr-1"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        )}
      </header>

      <div className={`flex-1 overflow-y-auto px-4 py-5 space-y-5 ${isEditing ? 'pb-24' : ''}`}>
        {saveErrorNote}

        {/* Identity */}
        <div className="flex flex-col items-center text-center pt-1">
          {avatarBlock('size-24', 'text-3xl font-bold text-white')}
          <h2 className="mt-4 text-xl font-bold text-white leading-tight">{displayName}</h2>
          <p className="mt-1 text-xs text-slate-400">{roleLabel}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {statusChip}
            {staffChip}
          </div>
        </div>

        {/* Personal details — edit or read */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
          <h3 className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Personal details
          </h3>
          <div className="px-4 py-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Title (optional)" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Dr." />
                  <Field label="First name" value={draft.firstName} onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))} placeholder="James" autoComplete="given-name" />
                </div>
                <Field label="Last name" value={draft.lastName} onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))} placeholder="Addo" autoComplete="family-name" />
                <Field label="Phone number" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="024 000 0000" inputMode="tel" autoComplete="tel" />
                <Field label="Email" value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder="name@waec.org" inputMode="email" autoComplete="email" />
                <TextArea label="About (optional)" value={draft.bio} onChange={(v) => setDraft((d) => ({ ...d, bio: v.slice(0, 500) }))} placeholder="A sentence about your work…" maxLength={500} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <ProfileField label="Title" value={profile.title || '—'} />
                <ProfileField label="First name" value={profile.firstName || '—'} />
                <ProfileField label="Last name" value={profile.lastName || '—'} />
                <ProfileField label="Phone" value={phoneDisplay} />
                <div className="col-span-2"><ProfileField label="Email" value={profile.email} /></div>
                <div className="col-span-2"><ProfileField label="About" value={profile.bio || '—'} /></div>
              </div>
            )}
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

        {/* Security */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
          <h3 className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Security
          </h3>
          <div className="mt-2">
            {isAdmin ? (
              <div className="w-full flex items-center gap-3 px-4 py-3.5">
                <span className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
                  <ShieldCheck className="size-5 text-slate-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-slate-500">Password &amp; sign-in</span>
                  <span className="block text-sm font-semibold text-white mt-0.5">Managed by HQ</span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setPinError(''); setPin1(''); setPin2(''); setPinOpen(true) }}
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
            )}
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

      {/* Fixed Cancel / Save bar while editing */}
      {isEditing && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[#22263C] bg-[#0B0D14]/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={cancelEditing}
            className="h-12 flex-1 rounded-xl border border-[#22263C] text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="h-12 flex-1 rounded-xl bg-[#3b57f0] hover:bg-[#3250dd] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? (<><Loader2 className="size-4 animate-spin" /> Saving…</>) : 'Save changes'}
          </button>
        </div>
      )}
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
            onClick={() => (isEditing ? cancelEditing() : router.back())}
            aria-label={isEditing ? 'Cancel editing' : 'Back'}
            className="size-11 flex items-center justify-center rounded-xl border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-lg font-bold text-white tracking-tight">{isEditing ? 'Edit profile' : 'Profile'}</h1>
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
        <div className="max-w-6xl mx-auto grid grid-cols-[380px_1fr] gap-6 items-start">
          {/* Identity card */}
          <div className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-8 flex flex-col items-center text-center shadow-2xl h-fit">
            {avatarBlock('size-36', 'text-5xl font-bold text-white')}
            <h2 className="mt-5 text-2xl font-bold text-white leading-tight">{displayName}</h2>
            <p className="mt-1.5 text-sm text-slate-400">{roleLabel}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {statusChip}
              {staffChip}
            </div>
            {isEditing ? (
              <p className="mt-4 text-[11px] text-slate-500">Tap your photo to change it.</p>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="mt-5 h-11 px-5 flex items-center gap-2 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-500/50 transition cursor-pointer"
              >
                <Pencil className="size-4" />
                Edit profile
              </button>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Personal details */}
            <section className="rounded-3xl border border-[#22263C] bg-[#0E111D] p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">Personal details</h3>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelEditing} className="h-10 px-4 rounded-xl border border-[#22263C] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={!isDirty || saving} className="h-10 px-4 rounded-xl bg-[#3b57f0] hover:bg-[#3250dd] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white transition cursor-pointer flex items-center gap-2">
                      {saving ? (<><Loader2 className="size-4 animate-spin" /> Saving…</>) : 'Save changes'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="h-10 px-4 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-500/50 transition cursor-pointer"
                  >
                    Edit
                  </button>
                )}
              </div>
              {saveErrorNote && <div className="mt-4">{saveErrorNote}</div>}
              {isEditing ? (
                <div className="grid grid-cols-2 gap-4 mt-5">
                  <Field label="Title (optional)" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Dr." />
                  <Field label="First name" value={draft.firstName} onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))} placeholder="James" autoComplete="given-name" />
                  <Field label="Last name" value={draft.lastName} onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))} placeholder="Addo" autoComplete="family-name" />
                  <Field label="Phone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="024 000 0000" inputMode="tel" autoComplete="tel" />
                  <div className="col-span-2"><Field label="Email" value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder="name@waec.org" inputMode="email" autoComplete="email" /></div>
                  <div className="col-span-2"><TextArea label="About (optional)" value={draft.bio} onChange={(v) => setDraft((d) => ({ ...d, bio: v.slice(0, 500) }))} placeholder="A sentence about your work…" maxLength={500} /></div>
                </div>
              ) : (
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
              )}
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
              {isAdmin ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl px-2 py-3">
                  <span className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
                    <ShieldCheck className="size-5 text-slate-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500">Password &amp; sign-in</span>
                    <span className="block text-sm font-semibold text-white mt-0.5">Managed by HQ</span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setPinError(''); setPin1(''); setPin2(''); setPinOpen(true) }}
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
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#090A0F] text-foreground font-sans flex flex-col">
      {hiddenFile}
      {toastNote}
      {mobileView}
      {desktopView}

      {/* Change-PIN dialog (field officers) */}
      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="change-pin-title">
          <div className="w-full max-w-md rounded-2xl border border-[#22263C] bg-[#0E111D] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 id="change-pin-title" className="text-base font-bold text-white">Choose a new PIN</h3>
              <button type="button" onClick={() => setPinOpen(false)} aria-label="Close" className="size-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer">
                <ChevronRight className="size-5 rotate-180" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Pick 4 digits only you know. Avoid 1234, 1111, 0000, or your birth year.</p>
            {pinError && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                {pinError}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5" htmlFor="new-pin-1">New PIN</label>
              <input
                id="new-pin-1"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin1}
                onChange={(e) => { setPin1(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                placeholder="••••"
                autoComplete="off"
                className="w-full h-12 rounded-xl border border-[#22263C] bg-[#0A0D17] px-4 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#3b57f0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5" htmlFor="new-pin-2">Type it again</label>
              <input
                id="new-pin-2"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin2}
                onChange={(e) => { setPin2(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                placeholder="••••"
                autoComplete="off"
                className="w-full h-12 rounded-xl border border-[#22263C] bg-[#0A0D17] px-4 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#3b57f0]"
              />
            </div>
            <button
              type="button"
              onClick={handleChangePin}
              disabled={pinBusy || pin1.length !== 4 || pin2.length !== 4}
              className="w-full h-12 rounded-xl bg-[#3b57f0] hover:bg-[#3250dd] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2"
            >
              {pinBusy ? (<><Loader2 className="size-4 animate-spin" /> Saving…</>) : 'Save my new PIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function draftPhotoSrc(profile: ProfileData, draft: Draft, isEditing: boolean): string | null {
  return isEditing ? draft.photo || null : profile.photo || null
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'tel' | 'email' | 'text'
  autoComplete?: string
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-slate-500 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#3b57f0] focus:ring-1 focus:ring-[#3b57f0]/60"
      />
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="text-[11px] text-slate-500">
          {label}
        </label>
        {typeof maxLength === 'number' && (
          <span className="text-[10px] text-slate-600 tabular-nums">{value.length}/{maxLength}</span>
        )}
      </div>
      <textarea
        id={id}
        rows={3}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-[#3b57f0] focus:ring-1 focus:ring-[#3b57f0]/60 resize-y"
      />
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
