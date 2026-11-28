'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'

type Step = 'form' | 'sent'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [sentAt, setSentAt] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (identifier.trim().length < 3) {
      setErrorMsg('Enter your phone number or staff ID')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || 'We could not send that request. Try again.')
        setLoading(false)
        return
      }
      setSentAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      setStep('sent')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'sent') {
    return (
      <div className="authb-page">
        <header className="authb-header">
          <WaecMosLogo href="/login" size="md" />
        </header>
        <main className="authb-main">
          <div className="authb-card">
            <span className="authb-status-icon" aria-hidden>
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="authb-title">Request sent</h1>
            <p className="authb-sub">
              We told your controller. They will check it is really you, then give you a new PIN.
            </p>

            <ol className="authb-steps" aria-label="What happens next">
              {[
                'Your controller calls or texts you',
                'You sign in with the new PIN',
                'You choose your own PIN',
              ].map((stepText, i) => (
                <li key={i} className="authb-step">
                  <span className="authb-step-num" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{stepText}</span>
                </li>
              ))}
            </ol>

            <div className="authb-hint authb-stack">
              <ShieldCheck className="size-5 shrink-0" aria-hidden />
              <div>
                <p className="authb-hint-title">Sent at {sentAt}</p>
                <p>
                  Your controller will call or text you. If this number is not registered, nothing
                  happens.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="authb-link authb-linkbutton"
            >
              Back to sign in
            </button>
          </div>
        </main>
        <footer className="authb-footer">
          <p>© The West African Examinations Council</p>
        </footer>
      </div>
    )
  }

  return (
    <div className="authb-page">
      <header className="authb-header">
        <WaecMosLogo href="/login" size="md" />
      </header>
      <main className="authb-main">
        <div className="authb-card">
          <h1 className="authb-title">Forgot your PIN?</h1>
          <p className="authb-sub">
            Type your phone number or staff ID. We will ask your controller to give you a new PIN.
          </p>

          {errorMsg && (
            <div role="alert" className="authb-error authb-error--form">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="authb-form" noValidate>
            <label htmlFor="identifier" className="authb-label">
              Phone number or staff ID
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoFocus
              placeholder="Phone number or staff ID"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                setErrorMsg('')
              }}
              className="authb-plain-input"
              aria-invalid={Boolean(errorMsg)}
            />

            <button
              type="submit"
              className="authb-btn authb-stack"
              disabled={loading || identifier.trim().length < 3}
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>Sending…</span>
                </>
              ) : (
                <span>Ask for a new PIN</span>
              )}
            </button>
          </form>

          <div className="authb-hint authb-stack">
            <ShieldCheck className="size-5 shrink-0" aria-hidden />
            <p>
              Your controller will call or text you. For your safety, a PIN is never shown on this
              page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="authb-link authb-linkbutton"
          >
            Back to sign in
          </button>
        </div>
      </main>
      <footer className="authb-footer">
        <p>© The West African Examinations Council</p>
      </footer>
    </div>
  )
}
