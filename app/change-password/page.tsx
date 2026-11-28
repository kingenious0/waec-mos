'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClientSession } from '@/lib/auth/session'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { KeyRound, ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    getClientSession().then((s) => {
      if (!s) {
        router.push('/login')
      } else if (s.role !== 'ADMIN') {
        router.replace('/field')
      } else {
        setSession(s)
      }
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.userId,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update password')
        setLoading(false)
        return
      }

      router.push(session?.role === 'ADMIN' ? '/admin' : '/field')
    } catch {
      setErrorMsg('Failed to reach authentication server.')
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
          <span className="authb-status-icon" aria-hidden>
            <KeyRound className="size-6" />
          </span>
          <h1 className="authb-title">Set a new password</h1>
          <p className="authb-sub">Choose a new password for your administrator account.</p>

          {errorMsg && (
            <div role="alert" className="authb-error authb-error--form">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="authb-form" noValidate>
            <div className="authb-labelrow">
              <label htmlFor="new-password" className="authb-label">
                New password
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
              id="new-password"
              name="newPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setErrorMsg('')
              }}
              className="authb-plain-input"
            />

            <div className="authb-labelrow">
              <label htmlFor="confirm-password" className="authb-label">
                Type it again
              </label>
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="authb-textbutton"
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
            <input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Type your new password again"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setErrorMsg('')
              }}
              className="authb-plain-input"
            />

            <div className="authb-hint authb-stack">
              <ShieldCheck className="size-5 shrink-0" aria-hidden />
              <p>Use at least 8 characters. Do not share your password.</p>
            </div>

            <button type="submit" className="authb-btn authb-stack" disabled={loading}>
              {loading ? (
                <>
                  <span className="authb-spinner" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span>Save and continue</span>
                  <ArrowRight className="size-5" aria-hidden />
                </>
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
