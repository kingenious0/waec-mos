'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { NationalOperationsShowcase } from '@/components/auth/NationalOperationsShowcase'
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Shield,
  Sparkles,
  MapPin,
  Building,
  UserCheck,
} from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [phoneQuery, setPhoneQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneQuery.trim()) {
      setErrorMsg('Please enter your phone number.')
      return
    }

    setChecking(true)
    setErrorMsg('')
    setResult(null)

    try {
      const res = await fetch('/api/officers')
      const data = await res.json()
      const cleanInput = phoneQuery.trim().replace(/\D/g, '')
      const last9 = cleanInput.length >= 9 ? cleanInput.slice(-9) : cleanInput

      const found = (data.officers || []).find((o: any) => {
        const pDigits = (o.phone || '').replace(/\D/g, '')
        const pLast9 = pDigits.length >= 9 ? pDigits.slice(-9) : pDigits
        return pLast9 === last9
      })

      if (found) {
        setResult(found)
      } else {
        setErrorMsg(
          'No deployment record was found for this phone number. Please contact your Zonal Coordinator or Regional Controller.'
        )
      }
    } catch {
      setErrorMsg('Failed to connect to the WAEC central registry. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  const handleQuickCheck = (testPhone: string) => {
    const formatted = testPhone.replace('+233', '').replace(/\s+/g, '')
    setPhoneQuery(formatted)
    setErrorMsg('')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-[#080B16] text-zinc-100 selection:bg-[#375DFB] selection:text-white">
      {/* LEFT COLUMN: ROSTER VERIFICATION */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 max-w-xl mx-auto w-full">
        {/* Header Branding */}
        <header className="flex items-center justify-between">
          <WaecMosLogo href="/login" size="md" />

          <Link
            href="/login"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Sign in</span>
          </Link>
        </header>

        {/* Main Content Area */}
        <main className="py-8 sm:py-10">
          <div className="space-y-6">
            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Check roster status
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Examination personnel are pre-registered by Council Headquarters. Enter your phone number to verify your deployment and assigned duty station.
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Verification Form or Verified Result Card */}
            {!result ? (
              <form onSubmit={handleCheckStatus} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-medium text-zinc-300">
                    Phone number
                  </label>
                  <div className="flex items-center rounded-xl bg-[#0D1224] border border-white/10 focus-within:border-[#375DFB] focus-within:ring-1 focus-within:ring-[#375DFB] focus-within:bg-[#121833] transition overflow-hidden">
                    <span className="px-3.5 py-3 text-xs sm:text-sm font-semibold text-zinc-200 border-r border-white/10 select-none shrink-0 tracking-wide">
                      GH +233
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phoneQuery}
                      onChange={(e) => {
                        setPhoneQuery(e.target.value)
                        setErrorMsg('')
                      }}
                      placeholder="24 000 0000"
                      autoComplete="tel"
                      className="w-full px-3.5 py-3 bg-transparent text-white placeholder:text-zinc-500 text-sm sm:text-base focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={checking}
                  className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#2B50EF] active:bg-[#2043E0] text-white font-semibold text-sm sm:text-base shadow-lg shadow-[#375DFB]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {checking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Checking central registry...</span>
                    </span>
                  ) : (
                    <>
                      <span>Check roster status</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Verified Officer Card */
              <div className="rounded-2xl bg-[#0D1224] border border-emerald-500/30 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-xl">
                <div className="flex items-start gap-3.5">
                  <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Assignment Verified
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {result.name}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#141A2E]/70 border border-white/5 p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Staff ID</span>
                    <span className="font-mono font-bold text-white">{result.staffId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Assigned Centre</span>
                    <span className="font-medium text-white text-right truncate max-w-[200px]">
                      {result.assignedCenter}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Duty Group</span>
                    <span className="font-medium text-zinc-200">{result.group}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Status</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Active On Duty
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#2B50EF] text-white font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#375DFB]/25"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setPhoneQuery('')
                    }}
                    className="w-full py-2 text-xs text-zinc-400 hover:text-white transition"
                  >
                    Verify another number
                  </button>
                </div>
              </div>
            )}

            {/* Official WAEC Security Notice Box */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#141824] border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-3">
              <Shield className="size-4 text-[#FACC15] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Official WAEC devices only. Your location is shared while you are on duty.
              </p>
            </div>

            {/* Return to Sign in link */}
            <div className="pt-1 text-center">
              <p className="text-xs text-zinc-400">
                Already know your PIN?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[#8B9FFB] hover:text-white hover:underline transition"
                >
                  Return to sign in
                </Link>
              </p>
            </div>

            {/* Quick Demo Credentials Autofill Helper */}
            {!result && (
              <div className="pt-2">
                <div className="p-3 rounded-xl bg-[#101426]/70 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-[#F6C90E]" />
                      <span>Registered Sample Personnel</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">Click to test</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickCheck('0244128900')}
                      className="p-2 rounded-lg bg-[#141A2E] hover:bg-[#1B233D] border border-white/10 text-left transition cursor-pointer"
                    >
                      <div className="font-semibold text-white text-[11px] truncate">
                        Kofi Mensah
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Prempeh College
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCheck('0241002345')}
                      className="p-2 rounded-lg bg-[#141A2E] hover:bg-[#1B233D] border border-white/10 text-left transition cursor-pointer"
                    >
                      <div className="font-semibold text-white text-[11px] truncate">
                        Akua Owusu
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Yaa Asantewaa Girls
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 border-t border-white/5 text-xs text-zinc-500">
          <p>© The West African Examinations Council</p>
        </footer>
      </div>

      {/* RIGHT COLUMN: NATIONAL OPERATIONS GRID SHOWCASE */}
      <NationalOperationsShowcase />
    </div>
  )
}
