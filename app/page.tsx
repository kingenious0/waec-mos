'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentClientSession } from '@/lib/auth/session'
import { Shield, ArrowRight, Users, ShieldAlert, CheckCircle2 } from 'lucide-react'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const session = getCurrentClientSession()
    if (session) {
      if (session.role === 'ADMIN') {
        router.push('/admin')
      } else if (session.mustChangePassword) {
        router.push('/change-password')
      } else {
        router.push('/field')
      }
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-white">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#22263c] bg-[#0d0f18]/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative size-10 overflow-hidden rounded-lg border border-[#303654] bg-[#11131f]">
            <Image
              src="/images/waec-logo.jpg"
              alt="WAEC"
              width={40}
              height={40}
              className="size-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white">
              WAEC <span className="text-[#f6d300]">MOS</span>
            </div>
            <div className="text-[9px] tracking-widest text-slate-500">
              NATIONAL MONITORING & OPERATIONS SYSTEM
            </div>
          </div>
        </div>

        <Link
          href="/login"
          className="rounded-xl bg-[#1e2b7b] px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(46,65,182,.3)] transition hover:bg-[#2b3cb8]"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Body */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-2xl text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-[#303654] bg-[#11131f] text-[#f6d300] shadow-[0_0_30px_rgba(246,211,0,.15)]">
            <Shield size={32} />
          </div>

          <div className="mb-3 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-[#8290ff]">
            WAEC SECURE OPERATIONS SUITE · V1 FOUNDATION
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Examination Field Monitoring & Operations System
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 leading-relaxed">
            Role-based operational platform for administrators and field officers to manage examination centers, personnel rosters, duty verification, and security credentials.
          </p>

          {/* Quick Pillars */}
          <div className="my-8 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <Users size={18} className="text-[#8290ff]" />
              <div className="mt-2 text-xs font-bold text-white">Closed Access Control</div>
              <div className="mt-1 text-[11px] text-slate-400">
                Admin-provisioned credentials with compulsory first-time password rotation.
              </div>
            </div>

            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <div className="mt-2 text-xs font-bold text-white">Duty Verification</div>
              <div className="mt-1 text-[11px] text-slate-400">
                Official shift check-in and exam hall presence monitoring with live timing.
              </div>
            </div>

            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <Shield size={18} className="text-[#f6d300]" />
              <div className="mt-2 text-xs font-bold text-white">Personnel Dossiers</div>
              <div className="mt-1 text-[11px] text-slate-400">
                Comprehensive profile verification, assigned center codes, and venue directives.
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-xl bg-[#1e2b7b] px-6 py-3.5 text-xs font-black tracking-wider text-white shadow-[0_0_25px_rgba(46,65,182,.4)] transition hover:bg-[#2b3cb8]"
            >
              ACCESS OPERATIONS PORTAL
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#22263c] bg-[#0d0f18]/60 py-4 text-center text-[10px] text-slate-500">
        West African Examinations Council · MOS v1.0.0 · All Rights Reserved
      </footer>
    </div>
  )
}
