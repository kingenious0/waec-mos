'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Smartphone,
  MapPin,
  BellRing,
  RefreshCw,
  AlertTriangle,
  Users,
  Building2,
  Landmark,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import type { SessionData } from '@/lib/auth/session'
import type { SystemSettingsConfig } from '@/lib/settings-utils'
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-utils'

interface SafetyCenterProps {
  session?: SessionData | null
  onOpenHistory?: () => void
  onFeedback?: (message: string) => void
}

interface OddityItem {
  id: string
  kind: 'locked_out' | 'new_device' | 'review'
  title: string
  detail: string
  time: string | null
  targetUserId: string | null
}

interface LockdownStatus {
  active: boolean
  enabledBy: string | null
  enabledAt: string | null
}

export function SafetyCenter({ session, onOpenHistory, onFeedback }: SafetyCenterProps) {
  const [settings, setSettings] = useState<SystemSettingsConfig>(DEFAULT_SYSTEM_SETTINGS)
  const [oddities, setOddities] = useState<OddityItem[]>([])
  const [lockdown, setLockdown] = useState<LockdownStatus>({ active: false, enabledBy: null, enabledAt: null })
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [isLocking, setIsLocking] = useState(false)

  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, odditiesRes, lockdownRes] = await Promise.all([
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/security/oddities', { cache: 'no-store' }),
        fetch('/api/security/lockdown', { cache: 'no-store' }),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings((prev) => ({ ...prev, ...(data.settings || {}) }))
      }
      if (odditiesRes.ok) {
        const data = await odditiesRes.json()
        setOddities(data.items || [])
      }
      if (lockdownRes.ok) {
        const data = await lockdownRes.json()
        setLockdown({ active: Boolean(data.active), enabledBy: data.enabledBy ?? null, enabledAt: data.enabledAt ?? null })
      }
    } catch (err) {
      console.error('Failed to load safety center', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const toggle = async (key: keyof SystemSettingsConfig, value: boolean | string) => {
    setSavingKey(String(key))
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...settings, [key]: value } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onFeedback?.(data.error || 'Failed to update setting')
        return
      }
      setSettings((prev) => ({ ...prev, ...(data.settings || { [key]: value }) }))
      onFeedback?.('Saved')
    } catch {
      onFeedback?.('Network error')
    } finally {
      setSavingKey(null)
    }
  }

  const autoSignoutEnabled = (settings.sessionTimeout || '').toLowerCase() !== 'never'

  const safetyChecks = [
    {
      key: 'strong-pins',
      icon: KeyRound,
      title: 'Strong PINs',
      desc: 'Nobody can pick an easy PIN like 1234.',
      state: true,
      locked: true,
    },
    {
      key: 'locked',
      icon: Lock,
      title: 'Too many tries? Locked',
      desc: 'After 5 wrong tries, the account waits 5 minutes.',
      state: true,
      locked: true,
    },
    {
      key: 'adminSmsCheck',
      icon: Smartphone,
      title: 'Extra check for admins',
      desc: 'Admins also type a code we text to their phone.',
      state: settings.adminSmsCheck,
      locked: false,
      badge: 'Recommended',
      onToggle: () => toggle('adminSmsCheck', !settings.adminSmsCheck),
    },
    {
      key: 'auto-signout',
      icon: BellRing,
      title: 'Auto sign-out',
      desc: 'People are signed out after doing nothing.',
      state: autoSignoutEnabled,
      locked: false,
      onToggle: () => toggle('sessionTimeout', autoSignoutEnabled ? 'Never' : '30 minutes'),
    },
    {
      key: 'hidden-pins',
      icon: ShieldAlert,
      title: 'Hidden PINs',
      desc: 'Nobody can see a PIN. You can only give a new one.',
      state: true,
      locked: true,
    },
    {
      key: 'locationOnlyOnDuty',
      icon: MapPin,
      title: 'Location only on duty',
      desc: 'We only share an officer\'s location while they are on duty.',
      state: settings.locationOnlyOnDuty,
      locked: false,
      onToggle: () => toggle('locationOnlyOnDuty', !settings.locationOnlyOnDuty),
    },
  ]

  const activeCount = safetyChecks.filter((c) => c.state).length

  const reviewOddity = async (item: OddityItem, action: 'it_was_me' | 'block') => {
    if (!item.targetUserId) {
      setOddities((prev) => prev.filter((o) => o.id !== item.id))
      return
    }
    try {
      const res = await fetch('/api/security/oddities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetUserId: item.targetUserId }),
      })
      if (res.ok) {
        setOddities((prev) => prev.filter((o) => o.id !== item.id))
        onFeedback?.(action === 'block' ? 'Account blocked' : 'Marked as expected')
      }
    } catch {
      onFeedback?.('Network error')
    }
  }

  const handleLockdown = async () => {
    setIsLocking(true)
    try {
      if (lockdown.active) {
        // Lift — requires admin; super-admin only when SMS check is on
        const res = await fetch('/api/security/lockdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lift' }),
        })
        if (res.ok) {
          setLockdown({ active: false, enabledBy: null, enabledAt: null })
          onFeedback?.('System unlocked')
        }
      } else {
        const res = await fetch('/api/security/lockdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lock' }),
        })
        if (res.ok) {
          setLockdown({ active: true, enabledBy: session?.userId || null, enabledAt: new Date().toISOString() })
          onFeedback?.('System locked. Everyone was signed out.')
        }
      }
      setShowLockConfirm(false)
    } catch {
      onFeedback?.('Network error')
    } finally {
      setIsLocking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#0E111D] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6 bg-[#090A0F] font-sans">
      {/* Lockdown banner (desktop too) */}
      {lockdown.active && (
        <div className="mb-5 rounded-2xl border border-[#EF4444]/40 bg-[#1A0D12] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <ShieldAlert className="size-5 text-[#EF4444] shrink-0" />
          <div className="flex-1 text-xs text-red-200">
            <strong className="text-red-100">System is locked.</strong> Only administrators can sign in.
            {lockdown.enabledAt && <span className="text-red-300/80"> Locked {new Date(lockdown.enabledAt).toLocaleString()}</span>}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowLockConfirm(true)}
              className="h-10 px-4 rounded-xl bg-[#EF4444] hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
            >
              Lift lockdown
            </button>
          )}
        </div>
      )}

      {/* Header summary */}
      <div className="rounded-2xl border border-[#22263C] bg-[#0C0F17] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="size-16 shrink-0 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <ShieldCheck className="size-8 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Your system is {activeCount >= 5 ? 'mostly safe' : 'needs attention'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeCount} of {safetyChecks.length} safety checks are on.
          </p>
          <div className="mt-3 h-2 rounded-full bg-[#1A1F33] overflow-hidden max-w-md">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(activeCount / safetyChecks.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={loadAll}
          aria-label="Refresh"
          className="size-11 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
        >
          <RefreshCw className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        {/* SAFETY CHECKS */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0C0F17] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A1F33] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Safety checks
            </h3>
            <span className="text-[11px] text-slate-500 tabular-nums">{activeCount}/{safetyChecks.length}</span>
          </div>
          <div className="divide-y divide-[#161C2E]">
            {safetyChecks.map((check) => {
              const Icon = check.icon
              return (
                <div key={check.key} className="flex items-center gap-3 px-5 py-4">
                  <div className="size-10 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center text-slate-400">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{check.title}</span>
                      {check.badge && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                          {check.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{check.desc}</p>
                  </div>
                  {check.locked ? (
                    <div className="size-11 shrink-0 flex items-center justify-center rounded-full border border-[#22263C] bg-[#11131F] text-slate-500" title="Always on">
                      <Lock className="size-4" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={check.state}
                      disabled={savingKey === check.key}
                      onClick={check.onToggle}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        check.state ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-md transition ${
                          check.state ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* THINGS THAT LOOKED ODD */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0C0F17] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#1A1F33] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Things that looked odd
            </h3>
            <span className="inline-flex items-center rounded-full border border-[#22263C] bg-[#11131F] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              {oddities.length} to review
            </span>
          </div>

          <div className="flex-1 divide-y divide-[#161C2E]">
            {oddities.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Nothing looks off</p>
                <p className="text-xs text-slate-500 mt-1">Strange sign-ins or wrong-PIN patterns will show up here.</p>
              </div>
            ) : (
              oddities.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.detail}</p>
                      {item.time && (
                        <p className="text-[10px] text-slate-500 mt-1.5 tabular-nums">
                          {new Date(item.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => reviewOddity(item, 'it_was_me')}
                          className="h-9 px-3.5 rounded-xl border border-[#22263C] bg-[#11131F] hover:bg-[#181D2E] text-[11px] font-semibold text-slate-200 hover:text-white transition cursor-pointer"
                        >
                          It was me
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewOddity(item, 'block')}
                          className="h-9 px-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-semibold text-rose-300 transition cursor-pointer"
                        >
                          Block account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="px-5 py-3 border-t border-[#1A1F33] flex items-center justify-between text-left hover:bg-white/[0.02] transition cursor-pointer"
            >
              <span className="text-xs font-semibold text-indigo-300">See everything that happened</span>
              <ChevronRight className="size-4 text-slate-500" />
            </button>
          )}
        </section>

        {/* WHO CAN DO WHAT */}
        <section className="rounded-2xl border border-[#22263C] bg-[#0C0F17] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A1F33]">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Who can do what
            </h3>
          </div>
          <div className="divide-y divide-[#161C2E]">
            <AccessRow icon={<Users className="size-5 text-slate-400" />} title="Officer" desc="Check in and send an SOS." />
            <AccessRow icon={<Landmark className="size-5 text-slate-400" />} title="Controller" desc="See officers and centres. Call officers." />
            <AccessRow icon={<Building2 className="size-5 text-slate-400" />} title="Admin" desc="Everything, including adding people and changing safety." />
          </div>
        </section>

        {/* LOCK EVERYTHING */}
        <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-[#14090F] to-[#0C0F17] p-5 sm:p-6 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-rose-400">
            Think someone got in?
          </h3>
          <p className="text-sm text-red-100/80 mt-2 leading-relaxed">
            This signs everyone out and stops all sign-ins until you open it again.
          </p>
          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={() => setShowLockConfirm(true)}
              className="w-full h-14 rounded-2xl border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.99] text-rose-300 font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2.5"
            >
              <ShieldAlert className="size-5" />
              {lockdown.active ? 'Lift the lock' : 'Lock everything now'}
            </button>
          </div>
        </section>
      </div>

      {/* Confirm dialog */}
      {showLockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0F121E] p-6 shadow-2xl">
            <ShieldAlert className="size-12 text-rose-400 mx-auto" />
            <h3 className="mt-4 text-lg font-bold text-white text-center">
              {lockdown.active ? 'Lift the lock?' : 'Lock everything?'}
            </h3>
            <p className="mt-2 text-sm text-slate-300 text-center leading-relaxed">
              {lockdown.active
                ? 'Everyone will be able to sign in again. An audit entry will be recorded.'
                : 'Every active session will be signed out and all future sign-ins will be blocked until you lift this lock.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLockConfirm(false)}
                className="flex-1 h-12 rounded-xl border border-[#22263C] bg-[#161B2E] text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLockdown}
                disabled={isLocking}
                className="flex-1 h-12 rounded-xl bg-[#EF4444] hover:bg-red-500 text-white text-sm font-bold transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLocking ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                {lockdown.active ? 'Lift lock' : 'Lock now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccessRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="size-10 shrink-0 rounded-xl border border-[#22263C] bg-[#11131F] flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{desc}</p>
      </div>
    </div>
  )
}
