'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/relative-time'
import {
  Inbox,
  Check,
  X,
  Loader2,
  KeyRound,
  ShieldCheck,
  Copy,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

interface AccessRequest {
  id: string
  fullName: string
  phone: string
  staffId: string
  status: string
  createdAt: string
}

interface PinResetRequest {
  id: string
  officerId: string | null
  officerName: string | null
  officerPhone: string
  staffId: string | null
  status: string
  createdAt: string
}

interface RequestsPanelProps {
  /** Called after any decision so the Directory list can refresh */
  onChanged?: () => void
}

/**
 * Directory requests â€” access requests from new volunteers and PIN reset
 * requests from officers. Command staff approve, decline, or issue a
 * one-time temporary PIN (shown once).
 */
export function RequestsPanel({ onChanged }: RequestsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [pinResetRequests, setPinResetRequests] = useState<PinResetRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tempPin, setTempPin] = useState<{ pin: string; name: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/requests', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load requests.')
      setAccessRequests((data.accessRequests || []).filter((r: AccessRequest) => r.status === 'PENDING'))
      setPinResetRequests((data.pinResetRequests || []).filter((r: PinResetRequest) => r.status === 'PENDING'))
    } catch (e: any) {
      setError(e?.message || 'Could not load requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (kind: 'access' | 'pin', id: string, action: 'approve' | 'issue' | 'decline') => {
    if (busyId) return
    if (kind === 'access' && action === 'decline') {
      if (!window.confirm('Decline this access request? The person will not be able to sign in.')) return
    }
    if (kind === 'pin' && action === 'decline') {
      if (!window.confirm('Decline this PIN request? The officer will be told to contact you directly.')) return
    }

    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/requests/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not complete the request.')

      if (kind === 'access') {
        setAccessRequests((prev) => prev.filter((r) => r.id !== id))
        onChanged?.()
      } else if (action === 'issue') {
        setPinResetRequests((prev) => prev.filter((r) => r.id !== id))
        const req = pinResetRequests.find((r) => r.id === id)
        setTempPin({ pin: data.tempPin, name: req?.officerName || 'Officer', expiresAt: data.expiresAt })
        setCopied(false)
        onChanged?.()
      } else {
        setPinResetRequests((prev) => prev.filter((r) => r.id !== id))
        onChanged?.()
      }
    } catch (e: any) {
      setError(e?.message || 'Could not complete the request.')
    } finally {
      setBusyId(null)
    }
  }

  const copyPin = async () => {
    if (!tempPin) return
    try {
      await navigator.clipboard.writeText(tempPin.pin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable â€” controller can still read the PIN */
    }
  }

  const pendingTotal = accessRequests.length + pinResetRequests.length

  return (
    <section aria-label="Requests" className="rounded-2xl border border-[#22263C] bg-[#0E111D] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2 border-b border-[#1C2237]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-300">
            <Inbox className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Requests</h3>
            <p className="text-[10px] text-slate-500">{loading ? 'Loadingâ€¦' : pendingTotal === 0 ? 'Nothing waiting' : `${pendingTotal} waiting for review`}</p>
          </div>
        </div>
        <button type="button" onClick={load} aria-label="Refresh requests" className="size-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      {error && <div role="alert" className="px-4 py-2 text-[11px] text-rose-300 bg-rose-950/40 border-b border-rose-500/20">{error}</div>}

      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-indigo-400" aria-hidden /></div>
      ) : pendingTotal === 0 ? (
        <div className="px-4 py-6 flex flex-col items-center text-center gap-1.5">
          <ShieldCheck className="size-6 text-emerald-400/70" aria-hidden />
          <p className="text-xs font-semibold text-slate-300">All clear</p>
          <p className="text-[10px] text-slate-500">No access or PIN requests waiting right now.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y divide-[#1C2237]">
          {/* Access requests */}
          {accessRequests.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{r.fullName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{
                  (() => {
                    const d = r.phone.replace(/\D/g, '')
                    const national = d.length >= 9 ? '0' + d.slice(-9) : d
                    return `${national.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')} Â· ${r.staffId}`
                  })()}
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">{formatRelativeTime(r.createdAt)} Â· needs access approval</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button type="button" onClick={() => decide('access', r.id, 'approve')} disabled={busyId === r.id} className="h-8 px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-[10px] font-bold text-white inline-flex items-center gap-1.5 transition cursor-pointer">
                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Check className="size-3" aria-hidden />} Approve
                </button>
                <button type="button" onClick={() => decide('access', r.id, 'decline')} disabled={busyId === r.id} className="h-8 px-3 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 text-[10px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer">
                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <X className="size-3" aria-hidden />} Decline
                </button>
              </div>
            </div>
          ))}

          {/* PIN reset requests */}
          {pinResetRequests.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{r.officerName || 'Field officer'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {(() => {
                    const d = (r.officerPhone || '').replace(/\D/g, '')
                    const national = d.length >= 9 ? '0' + d.slice(-9) : d
                    return `${national.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}${r.staffId ? ` Â· ${r.staffId}` : ''}`
                  })()}
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">{formatRelativeTime(r.createdAt)} Â· needs a new PIN</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button type="button" onClick={() => decide('pin', r.id, 'issue')} disabled={busyId === r.id} className="h-8 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-[10px] font-bold text-white inline-flex items-center gap-1.5 transition cursor-pointer">
                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <KeyRound className="size-3" aria-hidden />} Give new PIN
                </button>
                <button type="button" onClick={() => decide('pin', r.id, 'decline')} disabled={busyId === r.id} className="h-8 px-3 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 text-[10px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer">
                  {busyId === r.id ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <X className="size-3" aria-hidden />} Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* One-time temporary PIN modal */}
      {tempPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-label="Temporary PIN">
          <div className="w-full max-w-sm rounded-2xl border border-indigo-500/40 bg-[#0E111D] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="size-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <KeyRound className="size-5 text-indigo-300" aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Temporary PIN for {tempPin.name}</h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  Shown once. Expires in 24 hours{tempPin.expiresAt ? ` (${new Date(tempPin.expiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })})` : ''}. They choose their own PIN at first sign-in.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-500/30 bg-[#0A0D17] px-4 py-4 text-center">
              <span className="text-4xl font-black tracking-[0.4em] text-white select-all tabular-nums">{tempPin.pin}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copyPin} className="flex-1 h-12 rounded-xl border border-[#22263C] text-xs font-bold text-slate-200 inline-flex items-center justify-center gap-2 hover:text-white hover:border-slate-500 transition cursor-pointer">
                <Copy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy PIN'}
              </button>
              <button type="button" onClick={() => setTempPin(null)} className="flex-1 h-12 rounded-xl bg-[#3b57f0] hover:bg-[#3250dd] text-xs font-bold text-white inline-flex items-center justify-center gap-2 transition cursor-pointer">
                <Check className="size-4" aria-hidden /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

