'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { NationalOperationsShowcase } from '@/components/auth/NationalOperationsShowcase'
import { PinInput } from '@/components/auth/PinInput'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Check,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'OFFICER' | 'ADMIN'>('OFFICER')

  // Field Officer credentials (Phone + 4-digit PIN)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)

  // Admin credentials (Email/Staff ID + Password)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Extra check for admins (SMS)
  const [smsStep, setSmsStep] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [smsHint, setSmsHint] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    let payload: Record<string, string> = {}

    if (role === 'OFFICER') {
      const cleanPhone = phone.trim()
      const cleanPin = pin.trim()

      if (!cleanPhone) {
        setErrorMsg('Please enter your registered phone number.')
        return
      }
      if (cleanPin.length !== 4) {
        setErrorMsg('Please enter your 4-digit security PIN.')
        return
      }

      // If phone starts with 0 or doesn't have country code, keep raw for server normalizer
      payload = { phone: cleanPhone, pin: cleanPin, mode: 'OFFICER' }
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

      // Admin sign-in requires an SMS code first
      if (data.requiresSms) {
        setSmsHint('We sent a 6-digit code to your registered phone.')
        setSmsCode('')
        setSmsStep(true)
        setLoading(false)
        return
      }

      if (data.user.role === 'ADMIN') {
        if (data.user.mustChangePassword) {
          router.push('/change-password')
        } else {
          router.push('/admin')
        }
      } else {
        router.push('/field')
      }
    } catch {
      setErrorMsg('Unable to connect to the WAEC portal. Please check your connection.')
      setLoading(false)
    }
  }

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const code = smsCode.trim()
    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit code we sent.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'The code we sent is not right.')
        setLoading(false)
        return
      }

      if (data.user.mustChangePassword) {
        router.push('/change-password')
      } else {
        router.push('/admin')
      }
    } catch {
      setErrorMsg('Unable to connect to the WAEC portal. Please check your connection.')
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-[#080B16] text-zinc-100 selection:bg-[#375DFB] selection:text-white">
      {/* LEFT COLUMN: AUTHENTICATION FORM */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 max-w-xl mx-auto w-full">
        {/* Header Branding */}
        <header>
          <WaecMosLogo href="/login" size="md" />
        </header>

        {/* Main Content Area */}
        <main className="py-8 sm:py-10">
          <div className="space-y-6">
            {smsStep ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    One more step
                  </h1>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {smsHint || 'We sent a 6-digit code to your registered phone.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#101426] border border-white/5 text-[11px] text-zinc-400 leading-relaxed">
                  The code expires in 5 minutes and works once. Never share it with anyone — HQ will never ask for it.
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5"
                  >
                    <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                    <span className="leading-relaxed">{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleVerifySms} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sms-code" className="text-xs font-medium text-zinc-300">
                      6-digit code
                    </label>
                    <input
                      id="sms-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      value={smsCode}
                      onChange={(e) => {
                        setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        setErrorMsg('')
                      }}
                      placeholder="••••••"
                      className="w-full h-14 rounded-xl bg-[#0D1224] border border-white/10 focus-within:border-[#375DFB] focus:outline-hidden px-4 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder:text-zinc-600"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || smsCode.length !== 6}
                    className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#4A70FF] active:bg-[#2C4DE0] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? 'Checking…' : (
                      <>
                        Sign in
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSmsStep(false)
                        setSmsCode('')
                        setErrorMsg('')
                      }}
                      className="text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSmsCode('')
                        setErrorMsg('')
                        setSmsHint('A new code is on its way — check your phone.')
                        ;(document.getElementById('sms-code') as HTMLInputElement | null)?.focus()
                      }}
                      className="text-xs font-semibold text-[#375DFB] hover:text-[#5B82FF] transition cursor-pointer"
                    >
                      Didn’t get it? Resend
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {role === 'OFFICER'
                  ? 'Sign in with the phone number and 4-digit PIN issued by your regional controller.'
                  : 'Sign in with your Staff ID or Council email issued by National Operations HQ.'}
              </p>
            </div>

            {/* Segmented Control Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#121626] border border-white/5 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setRole('OFFICER')
                  setErrorMsg('')
                }}
                className={`py-2.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                  role === 'OFFICER'
                    ? 'bg-[#375DFB] text-white font-semibold shadow-md shadow-[#375DFB]/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Field officer
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('ADMIN')
                  setErrorMsg('')
                }}
                className={`py-2.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                  role === 'ADMIN'
                    ? 'bg-[#375DFB] text-white font-semibold shadow-md shadow-[#375DFB]/20'
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
                className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {role === 'OFFICER' ? (
                <>
                  {/* Field Officer: Phone number */}
                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-medium text-zinc-300">
                      Phone number
                    </label>
                    <div className="flex items-center rounded-xl bg-[#0D1224] border border-white/10 focus-within:border-[#375DFB] focus-within:ring-1 focus-within:ring-[#375DFB] focus-within:bg-[#121833] transition overflow-hidden">
                      {/* Country prefix badge */}
                      <span className="px-3.5 py-3 text-xs sm:text-sm font-semibold text-zinc-200 border-r border-white/10 select-none shrink-0 tracking-wide">
                        GH +233
                      </span>
                      {/* Phone digits input */}
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setErrorMsg('')
                        }}
                        placeholder="24 000 0000"
                        autoComplete="tel"
                        className="w-full px-3.5 py-3 bg-transparent text-white placeholder:text-zinc-500 text-sm sm:text-base focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Field Officer: 4-digit PIN */}
                  <PinInput
                    value={pin}
                    onChange={(val) => {
                      setPin(val)
                      setErrorMsg('')
                    }}
                    showPin={showPin}
                    onToggleShowPin={() => setShowPin(!showPin)}
                    error={Boolean(errorMsg && errorMsg.includes('PIN'))}
                  />

                  {/* Keep me signed in & Forgot PIN */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setKeepSignedIn(!keepSignedIn)}
                        className={`size-4 rounded flex items-center justify-center transition border ${
                          keepSignedIn
                            ? 'bg-[#375DFB] border-[#375DFB] text-white'
                            : 'border-white/20 bg-[#0D1224]'
                        }`}
                      >
                        {keepSignedIn && <Check className="size-3" strokeWidth={3} />}
                      </div>
                      <span className="text-xs text-zinc-300 font-medium">
                        Keep me signed in
                      </span>
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-[#8B9FFB] hover:text-white transition"
                    >
                      Forgot PIN?
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {/* Administrator: Staff ID or Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="identifier" className="text-xs font-medium text-zinc-300">
                      Staff ID or email
                    </label>
                    <div className="relative">
                      <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value)
                          setErrorMsg('')
                        }}
                        placeholder="admin@waec.org"
                        autoComplete="username"
                        className="w-full h-12 rounded-xl bg-[#0D1224] border border-white/10 pl-10 pr-3.5 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-[#375DFB] focus:ring-1 focus:ring-[#375DFB] transition"
                        required
                      />
                      <Mail className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Administrator: Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-xs font-medium text-zinc-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="size-3.5 text-zinc-400" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5 text-zinc-400" />
                            <span>Show</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setErrorMsg('')
                        }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full h-12 rounded-xl bg-[#0D1224] border border-white/10 pl-10 pr-3.5 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-[#375DFB] focus:ring-1 focus:ring-[#375DFB] transition"
                        required
                      />
                      <Lock className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Keep me signed in & Forgot Password */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setKeepSignedIn(!keepSignedIn)}
                        className={`size-4 rounded flex items-center justify-center transition border ${
                          keepSignedIn
                            ? 'bg-[#375DFB] border-[#375DFB] text-white'
                            : 'border-white/20 bg-[#0D1224]'
                        }`}
                      >
                        {keepSignedIn && <Check className="size-3" strokeWidth={3} />}
                      </div>
                      <span className="text-xs text-zinc-300 font-medium">
                        Keep me signed in
                      </span>
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-[#8B9FFB] hover:text-white transition"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </>
              )}

              {/* Action Button: Sign in -> */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#2B50EF] active:bg-[#2043E0] text-white font-semibold text-sm sm:text-base shadow-lg shadow-[#375DFB]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
              </>
            )}

            {/* Official WAEC Security Notice Box */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#141824] border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-3">
              <Shield className="size-4 text-[#FACC15] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Official WAEC devices only. Your location is shared while you are on duty.
              </p>
            </div>

            {/* Roster Status Link */}
            <div className="pt-1 text-center">
              <p className="text-xs text-zinc-400">
                New deployment or need verification?{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-[#8B9FFB] hover:text-white hover:underline transition"
                >
                  Check roster status
                </Link>
              </p>
            </div>

            {/* Quick Demo Credentials Autofill Helper (Discreet & Useful) */}
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
