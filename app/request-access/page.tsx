'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react'

type Stage = 'form' | 'success'

export default function RequestAccessPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('form')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string
    phone?: string
    staffId?: string
    pin?: string
    confirmPin?: string
  }>({})

  const validate = () => {
    const errs: typeof fieldErrors = {}
    if (fullName.trim().replace(/\s+/g, ' ').length < 2) errs.fullName = 'Enter your full name'
    const digits = phone.replace(/\D/g, '')
    const national = digits.startsWith('233')
      ? digits.slice(3)
      : digits.startsWith('0')
      ? digits.slice(1)
      : digits
    if (national.length !== 9) errs.phone = 'Enter a Ghana phone number — e.g. 050 674 6307'
    if (staffId.trim().length < 3) errs.staffId = 'Enter your staff ID'
    if (pin.length !== 4) errs.pin = 'Enter a 4-digit PIN'
    else if (pin !== confirmPin) errs.confirmPin = "The PINs don't match"
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!validate()) return

    setLoading(true)
    try {
      const digits = phone.replace(/\D/g, '')
      const national = digits.startsWith('233')
        ? digits.slice(3)
        : digits.startsWith('0')
        ? digits.slice(1)
        : digits
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim().replace(/\s+/g, ' '),
          phone: national,
          staffId: staffId.trim().toUpperCase(),
          pin,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong on our side. Try again.')
        setLoading(false)
        return
      }
      setStage('success')
    } catch {
      setErrorMsg('Could not reach the portal. Check your connection and try again.')
      setLoading(false)
    }
  }

  if (stage === 'success') {
    return (
      <div className="authb-page">
        <header className="authb-header">
          <WaecMosLogo href="/login" size="md" />
        </header>
        <main className="authb-main">
          <div className="authb-card authb-card--center">
            <span className="authb-status-icon" aria-hidden>
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="authb-title">Request sent</h1>
            <p className="authb-sub">
              A controller will check your details. You will get a text when you can sign in.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="authb-btn authb-stack"
            >
              <span>Back to sign in</span>
              <ChevronRight className="size-5" aria-hidden />
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
          <h1 className="authb-title">Request access</h1>
          <p className="authb-sub">A controller will check your details before you can sign in.</p>

          {errorMsg && (
            <div role="alert" className="authb-error authb-error--form">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="authb-form" noValidate>
            <label htmlFor="full-name" className="authb-label">
              Full name
            </label>
            <input
              id="full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setFieldErrors((s) => ({ ...s, fullName: undefined }))
                setErrorMsg('')
              }}
              className="authb-plain-input"
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'full-name-err' : undefined}
            />
            {fieldErrors.fullName && (
              <p id="full-name-err" role="alert" className="authb-fielderror">
                {fieldErrors.fullName}
              </p>
            )}

            <label htmlFor="phone" className="authb-label authb-stack">
              Phone number
            </label>
            <div className={`authb-field${fieldErrors.phone ? ' authb-field--error' : ''}`}>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9 ]*"
                autoComplete="tel-national"
                placeholder="050 674 6307"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setFieldErrors((s) => ({ ...s, phone: undefined }))
                  setErrorMsg('')
                }}
                className="authb-input"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'phone-err' : undefined}
              />
            </div>
            {fieldErrors.phone && (
              <p id="phone-err" role="alert" className="authb-fielderror">
                {fieldErrors.phone}
              </p>
            )}

            <label htmlFor="staff-id" className="authb-label authb-stack">
              Staff ID
            </label>
            <input
              id="staff-id"
              name="staffId"
              type="text"
              autoComplete="off"
              placeholder="Staff ID"
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value)
                setFieldErrors((s) => ({ ...s, staffId: undefined }))
                setErrorMsg('')
              }}
              className="authb-plain-input"
              aria-invalid={Boolean(fieldErrors.staffId)}
              aria-describedby={fieldErrors.staffId ? 'staff-id-err' : undefined}
            />
            {fieldErrors.staffId && (
              <p id="staff-id-err" role="alert" className="authb-fielderror">
                {fieldErrors.staffId}
              </p>
            )}

            <div className="authb-labelrow">
              <label htmlFor="pin1-input" className="authb-label">
                Choose a 4-digit PIN
              </label>
              <button
                type="button"
                className="authb-textbutton"
                onClick={() => setShowPin(!showPin)}
                aria-pressed={showPin}
              >
                {showPin ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
                <span>{showPin ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <PinRow
              id="pin1-input"
              value={pin}
              onChange={(v) => {
                setPin(v)
                setFieldErrors((s) => ({ ...s, pin: undefined, confirmPin: undefined }))
                setErrorMsg('')
              }}
              show={showPin}
              invalid={Boolean(fieldErrors.pin)}
            />
            {fieldErrors.pin && (
              <p role="alert" className="authb-fielderror">
                {fieldErrors.pin}
              </p>
            )}

            <div className="authb-labelrow">
              <label htmlFor="pin2-input" className="authb-label">
                Type your PIN again
              </label>
              <button
                type="button"
                className="authb-textbutton"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-pressed={showConfirm}
              >
                {showConfirm ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
                <span>{showConfirm ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <PinRow
              id="pin2-input"
              value={confirmPin}
              onChange={(v) => {
                setConfirmPin(v)
                setFieldErrors((s) => ({ ...s, confirmPin: undefined }))
                setErrorMsg('')
              }}
              show={showConfirm}
              invalid={Boolean(fieldErrors.confirmPin)}
            />
            {fieldErrors.confirmPin && (
              <p role="alert" className="authb-fielderror">
                {fieldErrors.confirmPin}
              </p>
            )}

            <button type="submit" className="authb-btn authb-stack" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>Sending…</span>
                </>
              ) : (
                <span>Request access</span>
              )}
            </button>
          </form>

          <div className="authb-inline authb-inline--center">
            <span className="authb-muted">Already have an account?</span>
            <Link href="/login" className="authb-link">
              Sign in
            </Link>
          </div>
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
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  show: boolean
  invalid?: boolean
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const digits = [value[0] || '', value[1] || '', value[2] || '', value[3] || '']
  return (
    <div
      className="authb-pin-wrap"
      data-invalid={invalid}
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
        aria-invalid={Boolean(invalid)}
      />
    </div>
  )
}
