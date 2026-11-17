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
        setErrorMsg(data.error || 'Something went wrong on our side. Try again.')
        setLoading(false)
        return
      }
      setSentAt(data.sentAt ? new Date(data.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT' : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT')
      setStep('sent')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
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
            <div
              className="mx-auto mb-6 flex items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10"
              style={{ width: 64, height: 64 }}
            >
              <CheckCircle2 className="size-8 text-emerald-300" aria-hidden />
            </div>
            <h1 className="authb-title">Request sent</h1>
            <p className="authb-sub">We told your controller. They will check it is really you, then give you a new PIN.</p>

            <ol className="authb-steps" aria-label="What happens next" style={{ listStyle: 'none', padding: 0, margin: '18px 0 0' }}>
              {[
                'Your controller calls or texts you',
                'You sign in with the new PIN',
                'You choose your own PIN',
              ].map((stepText, i) => (
                <li key={i} className="authb-step" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 14.5, color: 'rgba(255,255,255,0.88)' }}>
                  <span className="authb-step-num" style={{ flex: '0 0 26px', width: 26, height: 26, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  <span>{stepText}</span>
                </li>
              ))}
            </ol>

            <div className="authb-hint" style={{ marginTop: 6 }}>
              <ShieldCheck className="size-5 shrink-0 text-emerald-300" aria-hidden />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>Sent at {sentAt}</p>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.72)' }}>Most requests are answered within 30 minutes.</p>
                <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.72)' }}>Your controller will call or text you. If this number is not registered, nothing happens.</p>
              </div>
            </div>

            <button type="button" onClick={() => router.push('/login')} className="authb-link" style={{ display: 'block', margin: '16px auto 0', background: 'transparent', border: 0, cursor: 'pointer' }}>
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
          <div
            className="mb-5 flex items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10"
            style={{ width: 64, height: 64 }}
          >
            <ShieldCheck className="size-8 text-amber-300" aria-hidden />
          </div>
          <h1 className="authb-title">Forgot your PIN?</h1>
          <p className="authb-sub">No problem. Type your phone number or staff ID. We will ask your controller to give you a new PIN.</p>

          {errorMsg && (
            <div role="alert" className="authb-error" style={{ marginTop: 14 }}>
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: 16 }} noValidate>
            <label htmlFor="identifier" className="authb-label" style={{ marginBottom: 6 }}>
              Phone number or staff ID
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoFocus
              placeholder="024 410 1001 or WAEC-ASH-0101"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setErrorMsg('') }}
              className="authb-input"
              style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', width: '100%', minHeight: 54 }}
              aria-invalid={Boolean(errorMsg)}
            />

            <button type="submit" className="authb-btn" style={{ marginTop: 16 }} disabled={loading || identifier.trim().length < 3}>
              {loading ? (<><Loader2 className="size-5 animate-spin" aria-hidden /><span>Sending…</span></>) : <span>Ask for a new PIN</span>}
            </button>
          </form>

          <div className="authb-hint" style={{ marginTop: 16 }}>
            <ShieldCheck className="size-5 shrink-0 text-sky-300" aria-hidden />
            <p style={{ margin: 0 }}>Your controller will call or text you. For your safety, a PIN is never shown on this page.</p>
          </div>

          <button type="button" onClick={() => router.push('/login')} className="authb-link" style={{ display: 'block', margin: '14px auto 0', background: 'transparent', border: 0, cursor: 'pointer' }}>
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
