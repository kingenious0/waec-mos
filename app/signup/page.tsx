'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GradientMesh } from '@/components/ui/login-page-utils/gradient-mesh'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [phoneQuery, setPhoneQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneQuery.trim()) return

    setChecking(true)
    setErrorMsg('')
    setResult(null)

    try {
      const res = await fetch('/api/officers')
      const data = await res.json()
      const cleanInput = phoneQuery.trim().replace(/[\s\-()]/g, '')

      const found = (data.officers || []).find((o: any) => {
        const p = o.phone.replace(/[\s\-()]/g, '')
        return p === cleanInput || p.endsWith(cleanInput) || cleanInput.endsWith(p.slice(-9))
      })

      if (found) {
        setResult(found)
      } else {
        setErrorMsg(
          'No deployment record was found for this phone number. Please contact your Zonal Coordinator or District Supervisor.'
        )
      }
    } catch {
      setErrorMsg('Failed to connect to the WAEC central registry. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-[#090B14] text-zinc-100 selection:bg-[#1E2B7B] selection:text-white">
      {/* LEFT COLUMN: ROSTER VERIFICATION */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
        {/* Header Branding */}
        <header className="flex items-center justify-between">
          <Link href="/login" className="inline-flex items-center gap-3">
            <div className="size-10 overflow-hidden rounded-xl border border-white/10 bg-[#0E1326] p-1 flex items-center justify-center shadow-md">
              <Image
                src="/images/waec-logo.jpg"
                alt="WAEC Crest"
                width={36}
                height={36}
                className="size-full object-cover rounded-lg"
                priority
              />
            </div>
            <div>
              <div className="font-semibold text-white tracking-tight text-base">WAEC MOS</div>
              <p className="text-xs text-zinc-400">Monitoring & Operations Suite</p>
            </div>
          </Link>

          <Link
            href="/login"
            className="text-xs font-medium text-zinc-400 hover:text-white transition flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Sign in</span>
          </Link>
        </header>

        {/* Main Content Area */}
        <main className="py-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                Verify deployment status
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Examination personnel are pre-registered by Council Headquarters. Enter your phone number to check your assignment.
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5"
              >
                <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Form or Result */}
            {!result ? (
              <form onSubmit={handleCheckStatus} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-medium text-zinc-300">
                    Registered phone number
                  </label>
                  <div className="relative">
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneQuery}
                      onChange={(e) => {
                        setPhoneQuery(e.target.value)
                        setErrorMsg('')
                      }}
                      placeholder="024 000 0000"
                      autoComplete="tel"
                      className="bg-[#121626] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-[#1E2B7B] pl-9 h-11"
                      required
                    />
                    <Phone className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={checking}
                  className="w-full h-11 bg-[#1E2B7B] hover:bg-[#25369A] text-white font-medium text-sm transition cursor-pointer"
                >
                  {checking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking roster...
                    </span>
                  ) : (
                    'Check status'
                  )}
                </Button>
              </form>
            ) : (
              /* Verified Deployment Details */
              <div className="rounded-xl bg-[#121626] border border-white/10 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-emerald-400">Assignment verified</div>
                    <div className="text-base font-semibold text-white mt-0.5">{result.name}</div>
                  </div>
                </div>

                <div className="divide-y divide-white/5 text-xs text-zinc-300">
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-400">Staff ID</span>
                    <span className="font-mono text-white">{result.staffId}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-400">Assigned Center</span>
                    <span className="text-white text-right">{result.assignedCenter}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-zinc-400">Duty Group</span>
                    <span className="text-white">{result.group}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full h-11 bg-[#1E2B7B] hover:bg-[#25369A] text-white font-medium text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Sign In</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            <div className="pt-2 text-center">
              <p className="text-xs text-zinc-400">
                Already know your PIN?{' '}
                <Link
                  href="/login"
                  className="text-zinc-200 font-medium underline underline-offset-4 hover:text-white transition"
                >
                  Return to sign in
                </Link>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 border-t border-white/5 text-xs text-zinc-500">
          <p>© The West African Examinations Council</p>
        </footer>
      </div>

      {/* RIGHT COLUMN: INSTITUTIONAL SHOWCASE WITH OFFICIAL EMBLEM */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden min-h-full border-l border-white/5 bg-[#070A1E]">
        <GradientMesh
          colors={['#050817', '#0C153B', '#162463']}
          distortion={5}
          swirl={0.18}
          speed={0.6}
          rotation={90}
          waveAmp={0.18}
          waveFreq={14}
          waveSpeed={0.18}
          grain={0.03}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#090B14]/90 via-transparent to-[#090B14]/50 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-[#F6D300]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between text-xs font-medium text-zinc-400">
          <span className="tracking-widest uppercase text-[11px] text-[#F6D300]/90 font-mono">
            Personnel Deployment Registry
          </span>
          <span className="text-zinc-400 font-mono text-[11px]">Est. 1952</span>
        </div>

        <div className="relative z-10 my-auto py-12 flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="relative mb-6 group">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-[#F6D300]/30 to-[#1E2B7B]/30 blur-md opacity-75 group-hover:opacity-100 transition" />
            <div className="relative size-28 sm:size-32 rounded-2xl bg-white p-3 shadow-2xl shadow-black/60 border border-white/40 flex items-center justify-center">
              <Image
                src="/images/waec-logo.jpg"
                alt="Official WAEC Crest"
                width={120}
                height={120}
                className="size-full object-contain"
                priority
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-widest text-[#F6D300] uppercase font-mono">
              The West African Examinations Council
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight leading-snug">
              Official Personnel Registry
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-md pt-1">
              Examination monitor and supervisor accounts are provisioned exclusively through authorized regional and zonal coordination rosters.
            </p>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-zinc-400 backdrop-blur-sm">
            <span>Accra</span>
            <span className="text-[#F6D300]">•</span>
            <span>Kumasi</span>
            <span className="text-[#F6D300]">•</span>
            <span>Tamale</span>
            <span className="text-[#F6D300]">•</span>
            <span>Cape Coast</span>
            <span className="text-[#F6D300]">•</span>
            <span>Sekondi</span>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400 font-mono border-t border-white/10 pt-4">
          <span>Ashanti Regional Operations Command</span>
          <span>Kumasi, Ghana</span>
        </div>
      </div>
    </div>
  )
}
