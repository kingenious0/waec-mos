'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setClientSession } from '@/lib/auth/session'
import { GradientMesh } from '@/components/ui/login-page-utils/gradient-mesh'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  Mail,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'OFFICER' | 'ADMIN'>('OFFICER')

  // Field Officer credentials (Phone + 4-digit PIN)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  // Admin credentials (Email/Staff ID + Password)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    let payload: Record<string, string> = {}

    if (role === 'OFFICER') {
      const cleanPin = pin.trim()
      if (!phone.trim()) {
        setErrorMsg('Please enter your registered phone number.')
        return
      }
      if (cleanPin.length !== 4) {
        setErrorMsg('Please enter your 4-digit security PIN.')
        return
      }
      payload = { phone: phone.trim(), pin: cleanPin, mode: 'OFFICER' }
    } else {
      if (!identifier.trim() || !password) {
        setErrorMsg('Please enter your Staff ID or Council email, and password.')
        return
      }
      payload = { identifier: identifier.trim(), password, mode: 'ADMIN' }
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid credentials. Please verify and try again.')
        setLoading(false)
        return
      }

      setClientSession(data.user)

      if (data.user.role === 'ADMIN') {
        router.push('/admin')
      } else if (data.user.mustChangePassword) {
        router.push('/change-password')
      } else {
        router.push('/field')
      }
    } catch {
      setErrorMsg('Unable to connect to the WAEC portal. Please check your connection.')
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-[#090B14] text-zinc-100 selection:bg-[#1E2B7B] selection:text-white">
      {/* LEFT COLUMN: AUTHENTICATION FORM */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
        {/* Header Branding */}
        <header>
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
        </header>

        {/* Main Content Area */}
        <main className="py-10">
          <div className="space-y-6">
            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                Sign in
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {role === 'OFFICER'
                  ? 'Enter your registered phone number and 4-digit PIN to access your duty station.'
                  : 'Enter your Staff ID or Council email to access the administrative dashboard.'}
              </p>
            </div>

            {/* Clean Segmented Tab Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#121626] border border-white/5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setRole('OFFICER')
                  setErrorMsg('')
                }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                  role === 'OFFICER'
                    ? 'bg-[#1E2B7B] text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Field Officer
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('ADMIN')
                  setErrorMsg('')
                }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                  role === 'ADMIN'
                    ? 'bg-[#1E2B7B] text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Administrator
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5"
              >
                <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Clean Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {role === 'OFFICER' ? (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-medium text-zinc-300">
                      Phone number
                    </label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
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

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="pin" className="text-xs font-medium text-zinc-300">
                        4-digit PIN
                      </label>
                      <Link
                        href="/signup"
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                      >
                        Forgot PIN?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="pin"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setPin(val)
                          setErrorMsg('')
                        }}
                        placeholder="••••"
                        autoComplete="one-time-code"
                        className="bg-[#121626] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-[#1E2B7B] pl-9 pr-10 h-11 tracking-widest font-mono text-base"
                        required
                      />
                      <Lock className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                        aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                      >
                        {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="identifier" className="text-xs font-medium text-zinc-300">
                      Staff ID or email
                    </label>
                    <div className="relative">
                      <Input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value)
                          setErrorMsg('')
                        }}
                        placeholder="admin@waec.org"
                        autoComplete="username"
                        className="bg-[#121626] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-[#1E2B7B] pl-9 h-11"
                        required
                      />
                      <Mail className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-xs font-medium text-zinc-300">
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setErrorMsg('')
                        }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="bg-[#121626] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-[#1E2B7B] pl-9 pr-10 h-11"
                        required
                      />
                      <Lock className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#1E2B7B] hover:bg-[#25369A] text-white font-medium text-sm transition cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            {/* Clean Verification Callout */}
            <div className="pt-2 text-center">
              <p className="text-xs text-zinc-400">
                New deployment or need verification?{' '}
                <Link
                  href="/signup"
                  className="text-zinc-200 font-medium underline underline-offset-4 hover:text-white transition"
                >
                  Check roster status
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
        {/* Deep Council Navy Fluid Mesh Canvas */}
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

        {/* Ambient Subtle Vignette & Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090B14]/90 via-transparent to-[#090B14]/50 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-[#F6D300]/8 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between text-xs font-medium text-zinc-400">
          <span className="tracking-widest uppercase text-[11px] text-[#F6D300]/90 font-mono">
            Official Examination Portal
          </span>
          <span className="text-zinc-400 font-mono text-[11px]">Est. 1952</span>
        </div>

        {/* Center Institutional Emblem & Message */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-center text-center max-w-lg mx-auto">
          {/* Official WAEC Crest Medallion */}
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
              Monitoring & Operations Suite
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-md pt-1">
              Real-time attendance verification, center telemetry, and coordinated incident response across accredited examination venues.
            </p>
          </div>

          {/* Member Nations Pill */}
          <div className="mt-8 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-zinc-400 backdrop-blur-sm">
            <span>Ghana</span>
            <span className="text-[#F6D300]">•</span>
            <span>Nigeria</span>
            <span className="text-[#F6D300]">•</span>
            <span>Sierra Leone</span>
            <span className="text-[#F6D300]">•</span>
            <span>The Gambia</span>
            <span className="text-[#F6D300]">•</span>
            <span>Liberia</span>
          </div>
        </div>

        {/* Bottom Regional Zonal Info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400 font-mono border-t border-white/10 pt-4">
          <span>Ashanti Regional Operations Command</span>
          <span>Kumasi, Ghana</span>
        </div>
      </div>
    </div>
  )
}
