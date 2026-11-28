'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { NationalOperationsShowcase } from '@/components/auth/NationalOperationsShowcase'
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Shield } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [phoneQuery, setPhoneQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<boolean | null>(null)
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
      const res = await fetch('/api/officers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneQuery.trim() }),
      })
      const data = await res.json()

      if (res.ok && data.verified) {
        // Roster confirmed — respond with a generic verified state. Never
        // reveal names, statuses, or centre assignments from the registry.
        setResult(true)
      } else {
        setErrorMsg(
          data.error ||
            'No deployment record was found for this phone number. Please contact your Zonal Coordinator or Regional Controller.',
        )
      }
    } catch {
      setErrorMsg('Failed to connect to the WAEC central registry. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="signup-shell">
      <div className="signup-main-panel">
        <header className="signup-header">
          <WaecMosLogo href="/login" size="md" />
          <Link href="/login" className="signup-back">
            <ArrowLeft className="size-4" aria-hidden />
            <span>Sign in</span>
          </Link>
        </header>

        <main className="signup-content">
          <h1 className="authb-title">Check roster status</h1>
          <p className="authb-sub">
            Examination personnel are registered by Council Headquarters. Enter your phone number to
            confirm your deployment.
          </p>

          {errorMsg && (
            <div role="alert" className="signup-error signup-error--form">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleCheckStatus} className="signup-form" noValidate>
              <div>
                <label htmlFor="phone" className="signup-label">
                  Phone number
                </label>
                <div className="signup-inputwrap">
                  <span className="signup-prefix">GH +233</span>
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
                    className="signup-input"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="signup-btn" disabled={checking}>
                {checking ? (
                  <>
                    <span className="authb-spinner" />
                    <span>Checking central registry…</span>
                  </>
                ) : (
                  <>
                    <span>Check roster status</span>
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="signup-result-card">
              <span className="authb-status-icon" aria-hidden>
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="signup-result-title">Your number is on the roster</h2>
              <p className="signup-result-note">
                This phone number is registered for examination duty. Sign in with your PIN, or
                contact your Regional Controller if you have not received your PIN yet.
              </p>
              <div className="signup-actions">
                <button type="button" onClick={() => router.push('/login')} className="signup-btn">
                  <span>Go to sign in</span>
                  <ArrowRight className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setPhoneQuery('')
                  }}
                  className="signup-quietbutton"
                >
                  Verify another number
                </button>
              </div>
            </div>
          )}

          <div className="signup-security-note">
            <Shield className="size-5" aria-hidden />
            <p>Official WAEC devices only. Your location is shared while you are on duty.</p>
          </div>

          <p className="signup-return">
            Already know your PIN?{' '}
            <Link href="/login" className="authb-link">
              Return to sign in
            </Link>
          </p>
        </main>

        <footer className="signup-footer">
          <p>© The West African Examinations Council</p>
        </footer>
      </div>

      <NationalOperationsShowcase />
    </div>
  )
}
