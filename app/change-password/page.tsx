'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getCurrentClientSession, setClientSession } from '@/lib/auth/session'
import { KeyRound, Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const s = getCurrentClientSession()
    if (!s) {
      router.push('/login')
    } else {
      setSession(s)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.userId,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update password')
        setLoading(false)
        return
      }

      // Update session locally to mark mustChangePassword = false
      if (session) {
        const updated = { ...session, mustChangePassword: false }
        localStorage.setItem('waec_mos_session', JSON.stringify(updated))
      }

      // Redirect to field workspace
      router.push('/field')
    } catch {
      setErrorMsg('Failed to reach authentication server.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-white">
      {/* Top Banner */}
      <header className="flex h-16 items-center border-b border-[#22263c] bg-[#0d0f18]/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative size-9 overflow-hidden rounded-lg border border-[#303654] bg-[#11131f]">
            <Image
              src="/images/waec-logo.jpg"
              alt="WAEC"
              width={36}
              height={36}
              className="size-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white">
              WAEC <span className="text-[#f6d300]">MOS</span>
            </div>
            <div className="text-[9px] tracking-widest text-slate-500">
              CREDENTIAL SECURITY GOVERNANCE
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#22263c] bg-[#11131f] p-6 shadow-2xl md:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <KeyRound size={24} />
              </div>
              <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-300">
                COMPULSORY FIRST-TIME ROTATION
              </span>
              <h1 className="mt-2 text-xl font-black text-white">Set Your Permanent Password</h1>
              <p className="mt-1 text-xs text-slate-400">
                For security reasons, temporary administrator credentials must be changed before entering the operations console.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  New Permanent Password (min. 8 characters)
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#8290ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#8290ff] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e2b7b] py-3 text-xs font-black tracking-wide text-white shadow-[0_0_20px_rgba(46,65,182,.3)] transition hover:bg-[#2b3cb8] disabled:opacity-50"
              >
                {loading ? 'SECURING ACCOUNT...' : 'SAVE & PROCEED TO CONSOLE'}
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
