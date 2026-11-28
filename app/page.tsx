'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { getClientSession, clearLegacyClientState } from '@/lib/auth/session'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Wipe any pre-hardening localStorage session left in this browser
    clearLegacyClientState()

    getClientSession().then((session) => {
      if (session) {
        if (session.role === 'ADMIN') {
          if (session.mustChangePassword) {
            router.replace('/change-password')
          } else {
            router.replace('/admin')
          }
        } else {
          router.replace('/field')
        }
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="authb-page">
      <header className="authb-header">
        <WaecMosLogo href="/login" size="md" />
      </header>
      <main className="authb-loading">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <span className="authb-muted">Opening WAEC MOS…</span>
      </main>
    </div>
  )
}
