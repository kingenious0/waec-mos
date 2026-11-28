'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { PinInput } from '@/components/auth/PinInput'
import { AlertCircle, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'OFFICER' | 'ADMIN'>('OFFICER')

  // Field officer credentials (phone + 4-digit PIN)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  // Browser sound needs a real gesture. This admin-only checkbox is that gesture.
  const [sosAlarmArmed, setSosAlarmArmed] = useState(false)

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

  const rememberSosAlarmChoice = () => {
    try {
      window.localStorage.setItem(
        'waec-sos-alarm',
        role === 'ADMIN' && sosAlarmArmed ? 'on' : 'off',
      )
    } catch {
      // Sound simply stays off if storage is blocked.
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    let payload: Record<string, string | boolean> = {}

    if (role === 'OFFICER') {
      const cleanPin = pin.trim()
      const digits = phone.replace(/\D/g, '')
      // Ghanaians know their number starting with 0 — accept "0506746307",
      // "233506746307", "+233 50 674 6307" or "506746307" alike.
      const national = digits.startsWith('233')
        ? digits.slice(3)
        : digits.startsWith('0')
        ? digits.slice(1)
        : digits
      if (national.length !== 9) {
        setErrorMsg('Enter a Ghana phone number — e.g. 050 674 6307')
        return
      }
      if (cleanPin.length !== 4) {
        setErrorMsg('Enter your 4-digit PIN')
        return
      }
      // Server normalises the 9 national digits against registered numbers
      payload = { phone: national, pin: cleanPin, keepSignedIn }
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
        rememberSosAlarmChoice()
        router.push(data.user?.mustChangePassword ? '/change-password' : '/admin')
      } else {
        router.push(data.user?.mustChangePassword ? '/choose-pin' : '/field')
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
      rememberSosAlarmChoice()
      router.push(data.user?.mustChangePassword ? '/change-password' : '/admin')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="authb-page">
      <header className="authb-header">
        <WaecMosLogo href="/login" size="md" />
      </header>

      <main className="authb-main">
        <div className="authb-card">
          {smsStep ? (
            <>
              <h1 className="authb-title">Check your phone</h1>
              <p className="authb-sub">
                {smsHint || 'We sent a 6-digit code to your registered phone.'}
              </p>

              <form onSubmit={handleVerifySms} className="authb-form">
                {errorMsg && (
                  <div role="alert" className="authb-error authb-error--form">
                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <label htmlFor="sms-code" className="authb-label authb-stack">
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
                  className="authb-code-input authb-stack--tight"
                />

                <button
                  type="submit"
                  className="authb-btn authb-stack"
                  disabled={loading || smsCode.length !== 6}
                >
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

                <div className="authb-inline">
                  <button
                    type="button"
                    className="authb-textbutton"
                    onClick={() => {
                      setSmsStep(false)
                      setSmsCode('')
                      setErrorMsg('')
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="authb-link authb-textbutton"
                    onClick={() => setSmsHint('A new code is on the way — check your phone.')}
                  >
                    Send another code
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="authb-title">Sign in</h1>
              <p className="authb-sub">
                Field officers use a phone number and PIN. Administrators use their staff details.
              </p>

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

              {errorMsg && (
                <div role="alert" className="authb-error authb-error--form">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="authb-form" noValidate>
                {role === 'OFFICER' ? (
                  <>
                    <label htmlFor="phone" className="authb-label">
                      Phone number
                    </label>
                    <div className="authb-field">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9 ]*"
                        placeholder="050 674 6307"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          setErrorMsg('')
                        }}
                        className="authb-input"
                      />
                    </div>

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
                      placeholder="Staff ID or email address"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value)
                        setErrorMsg('')
                      }}
                      className="authb-plain-input"
                    />

                    <div className="authb-labelrow">
                      <label htmlFor="password" className="authb-label">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="authb-textbutton"
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" aria-hidden />
                        ) : (
                          <Eye className="size-4" aria-hidden />
                        )}
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
                      className="authb-plain-input"
                    />
                  </>
                )}

                <div className="authb-inline">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={keepSignedIn}
                    onClick={() => setKeepSignedIn(!keepSignedIn)}
                    className="authb-check"
                    data-checked={keepSignedIn}
                  >
                    <span className="authb-check-box" aria-hidden>
                      {keepSignedIn && (
                        <Check className="size-4 authb-check-icon" strokeWidth={3} />
                      )}
                    </span>
                    <span className="authb-check-label">Keep me signed in</span>
                  </button>

                  <Link href="/forgot-password" className="authb-link">
                    Forgot PIN?
                  </Link>
                </div>

                {role === 'ADMIN' && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={sosAlarmArmed}
                    onClick={() => setSosAlarmArmed(!sosAlarmArmed)}
                    className="authb-check authb-stack--tight"
                    data-checked={sosAlarmArmed}
                  >
                    <span className="authb-check-box" aria-hidden>
                      {sosAlarmArmed && (
                        <Check className="size-4 authb-check-icon" strokeWidth={3} />
                      )}
                    </span>
                    <span className="authb-check-label">Turn on SOS alarm sound</span>
                  </button>
                )}

                <button type="submit" className="authb-btn authb-stack" disabled={loading}>
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

              <div className="authb-inline authb-inline--center">
                <span className="authb-muted">New here?</span>
                <Link href="/request-access" className="authb-link">
                  Request access
                </Link>
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
