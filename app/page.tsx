'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getCurrentClientSession } from '@/lib/auth/session'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const session = getCurrentClientSession()
    if (session) {
      if (session.role === 'ADMIN') {
        router.replace('/admin')
      } else if (session.mustChangePassword) {
        router.replace('/change-password')
      } else {
        router.replace('/field')
      }
    } else {
      router.replace('/signup')
    }
  }, [router])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090B14] text-white font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="size-16 rounded-2xl border border-white/10 bg-[#0E1326] p-2 flex items-center justify-center shadow-xl animate-pulse">
          <Image
            src="/images/waec-logo.jpg"
            alt="WAEC Crest"
            width={48}
            height={48}
            className="size-full object-cover rounded-xl"
            priority
          />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="size-4 border-2 border-[#1E2B7B] border-t-[#F6D300] rounded-full animate-spin" />
          <span className="text-sm font-semibold text-zinc-300">Loading WAEC MOS...</span>
        </div>
      </div>
    </div>
  )
}
