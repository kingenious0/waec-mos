'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { PinInput } from '@/components/auth/PinInput'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'OFFICER' | 'ADMIN'>('OFFICER')

  // Field officer credentials (phone + 4-digit PIN)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)

  // Administrator credentials (Staff ID / email + password)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Extra check for administrators (SMS step, shown only when required)
  const [smsStep, setSmsStep] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [smsHint, setSmsHint] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    let payload: Record<string, string | boolean> = {}

    if (role === 'OFFICER') {
      const cleanPin = pin.trim()
      const digits = phone.replace(/\D/g, '')
      if (digits.length !== 9) {
        setErrorMsg('Enter a Ghana phone number')
        return
      }
      if (cleanPin.length !== 4) {
        setErrorMsg('Enter your 4-digit PIN')
        return
      }
      // Server normalises the 9 national digits against registered numbers
      payload = { phone: digits, pin: cleanPin, keepSignedIn }
    } else {
      if (!identifier.trim() || !password) {
        setErrorMsg('Enter your Staff ID or email and password')
        return
      }
      payload = { identifier: identifier.trim(), password, keepSignedIn }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErrorMsg(data.error || 'Those details are not right. Try again.')
        setLoading(false)
        return
      }

      if (data.requiresSms) {
        setSmsHint('We sent a 6-digit code to your registered phone.')
        setSmsCode('')
        setSmsStep(true)
        setLoading(false)
        return
      }

      if (data.user?.role === 'ADMIN' || data.user?.role === 'SUPER_ADMIN') {
        router.push(data.user?.mustChangePassword ? '/change-password' : '/admin')
      } else {
        router.push('/field')
      }
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
      setLoading(false)
    }
  }

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    const code = smsCode.trim()
    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit code we sent you')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || 'That code is not right.')
        setLoading(false)
        return
      }
      router.push(data.user?.mustChangePassword ? '/change-password' : '/admin')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
      setLoading(false)
    }
  }

  const roleSwitch = (
    <div className="authb-switch" role="group" aria-label="Sign-in type">
      <button
        type="button"
        className="authb-role"
        data-active={role === 'OFFICER'}
        aria-pressed={role === 'OFFICER'}
        onClick={() => {
          setRole('OFFICER')
          setErrorMsg('')
        }}
      >
        Field officer
      </button>
      <button
        type="button"
        className="authb-role"
        data-active={role === 'ADMIN'}
        aria-pressed={role === 'ADMIN'}
        onClick={() => {
          setRole('ADMIN')
          setErrorMsg('')
        }}
      >
        Administrator
      </button>
    </div>
  )

  return (
    <div className="authb-page">
      {/* Branding, top-left */}
      <header className="authb-header">
        <WaecMosLogo href="/login" size="md" />
      </header>

      <main className="authb-main">
        <div className="authb-card">
          {smsStep ? (
            <>
              <h1 className="authb-title">One more step</h1>
              <p className="authb-sub">{smsHint || 'We sent a 6-digit code to your registered phone.'}</p>

              <form onSubmit={handleVerifySms} style={{ marginTop: 22 }} className="authb-form">
                {errorMsg && (
                  <div role="alert" className="authb-error">
                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <label htmlFor="sms-code" className="authb-label" style={{ marginBottom: 8, marginTop: errorMsg ? 16 : 0 }}>
                  6-digit code
                </label>
                <input
                  id="sms-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => {
                    setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setErrorMsg('')
                  }}
                  placeholder="••••••"
                  className="authb-input"
                  style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: 22, fontWeight: 700, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', minHeight: 56 }}
                />

                <button type="submit" className="authb-btn" style={{ marginTop: 18 }} disabled={loading || smsCode.length !== 6}>
                  {loading ? (
                    <>
                      <span className="authb-spinner" />
                      <span>Checking…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="size-5" aria-hidden />
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                  <button
                    type="button"
                    className="authb-link authb-link--quiet"
                    style={{ textDecoration: 'none' }}
                    onClick={() => {
                      setSmsStep(false)
                      setSmsCode('')
                      setErrorMsg('')
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="authb-link"
                    onClick={() => setSmsHint('A new code is on the way — check your phone.')}
                  >
                    Didn’t get it? Send again
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="authb-title">Welcome back</h1>
              <p className="authb-sub">Sign in to continue.</p>

              {roleSwitch}

              {errorMsg && (
                <div role="alert" className="authb-error" style={{ marginTop: 14 }}>
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ marginTop: 16 }} noValidate>
                {role === 'OFFICER' ? (
                  <>
                    <label htmlFor="phone" className="authb-label">
                      Phone number
                    </label>
                    <div className="authb-field">
                      <span className="authb-prefix">+233</span>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9 ]*"
                        placeholder="24 000 0000"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setErrorMsg('')
                        }}
                        className="authb-input"
                        style={{ border: 0, outline: 'none' }}
                      />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <PinInput
                        value={pin}
                        onChange={(val) => {
                          setPin(val)
                          setErrorMsg('')
                        }}
                        showPin={showPin}
                        onToggleShowPin={() => setShowPin(!showPin)}
                        error={Boolean(errorMsg)}
                        autoFocus={false}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label htmlFor="identifier" className="authb-label">
                      Staff ID or email
                    </label>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="WAEC-ASH-0101 or name@waec.org"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value)
                        setErrorMsg('')
                      }}
                      className="authb-input"
                      style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', width: '100%', minHeight: 56 }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                      <label htmlFor="password" className="authb-label" style={{ marginBottom: 0 }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="authb-link authb-link--quiet"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', minHeight: 30 }}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                        <span>{showPassword ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setErrorMsg('')
                      }}
                      className="authb-input"
                      style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', width: '100%', minHeight: 56 }}
                    />
                  </>
                )}

                {/* Keep signed in + forgot PIN */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={keepSignedIn}
                    onClick={() => setKeepSignedIn(!keepSignedIn)}
                    className="authb-check"
                    data-checked={keepSignedIn}
                  >
                    <span className="authb-check-box" aria-hidden>
                      {keepSignedIn && <Check className="size-4" strokeWidth={3.5} color="#101832" />}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Keep me signed in</span>
                  </button>

                  <Link href="/forgot-password" className="authb-link">
                    Forgot PIN?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="authb-btn"
                  style={{ marginTop: 18 }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="authb-spinner" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="size-5" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>New here? </span>
                <Link href="/request-access" className="authb-link">Request access</Link>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="authb-footer">
        <p>© The West African Examinations Council</p>
      </footer>
    </div>
  )
}
