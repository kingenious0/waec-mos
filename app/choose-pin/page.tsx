'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { getClientSession } from '@/lib/auth/session'

export default function ChoosePinPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [show1, setShow1] = useState(false)
  const [show2, setShow2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Gate: must be signed in AND have a temporary PIN pending change
  useEffect(() => {
    getClientSession().then((s) => {
      if (!s) {
        router.replace('/login')
        return
      }
      if (!s.mustChangePassword) {
        router.replace(s.role === 'FIELD_OFFICER' ? '/field' : '/admin')
        return
      }
      setReady(true)
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (pin1.length !== 4 || pin2.length !== 4) {
      setErrorMsg('Enter a 4-digit PIN')
      return
    }
    if (pin1 !== pin2) {
      setErrorMsg("The PINs don't match")
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/choose-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin1, pinConfirm: pin2 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save your PIN. Try again.')
        setLoading(false)
        return
      }
      router.replace(data.home || '/login')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="authb-loading">
        <Loader2 className="size-6 animate-spin" aria-hidden />
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
          <h1 className="authb-title">Choose your own PIN</h1>
          <p className="authb-sub">
            You signed in with a PIN from your controller. Pick a new one that only you know.
          </p>

          {errorMsg && (
            <div role="alert" className="authb-error authb-error--form">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="authb-form" noValidate>
            <div className="authb-labelrow">
              <label htmlFor="pin1-input" className="authb-label">
                New 4-digit PIN
              </label>
              <button
                type="button"
                className="authb-textbutton"
                onClick={() => setShow1(!show1)}
                aria-pressed={show1}
              >
                <span>{show1 ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <PinRow
              id="pin1-input"
              value={pin1}
              onChange={(v) => {
                setPin1(v)
                setErrorMsg('')
              }}
              show={show1}
            />

            <div className="authb-labelrow">
              <label htmlFor="pin2-input" className="authb-label">
                Type it again
              </label>
              <button
                type="button"
                className="authb-textbutton"
                onClick={() => setShow2(!show2)}
                aria-pressed={show2}
              >
                <span>{show2 ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <PinRow
              id="pin2-input"
              value={pin2}
              onChange={(v) => {
                setPin2(v)
                setErrorMsg('')
              }}
              show={show2}
            />

            <div className="authb-hint authb-stack">
              <ShieldCheck className="size-5 shrink-0" aria-hidden />
              <p>Do not use 1234, 0000, or your birth year. Do not tell anyone your PIN.</p>
            </div>

            <button
              type="submit"
              className="authb-btn authb-stack"
              disabled={loading || pin1.length !== 4 || pin2.length !== 4}
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save my new PIN</span>
              )}
            </button>
          </form>
        </div>
      </main>
      <footer className="authb-footer">
        <p>© The West African Examinations Council</p>
      </footer>
    </div>
  )
}

function PinRow({
  id,
  value,
  onChange,
  show,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  show: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const digits = [value[0] || '', value[1] || '', value[2] || '', value[3] || '']
  return (
    <div
      className="authb-pin-wrap"
      onClick={() => ref.current?.focus()}
      role="group"
      aria-label="4-digit PIN boxes"
    >
      <div className="authb-pin-grid" aria-hidden>
        {digits.map((d, i) => (
          <div key={i} id={`${id}-box-${i}`} className="authb-pin-box">
            {d ? show ? d : '•' : <span className="authb-pin-empty" />}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onPaste={(e) => {
          e.preventDefault()
          onChange(e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4))
        }}
        autoComplete="new-password"
        className="authb-pin-input"
      />
    </div>
  )
}
