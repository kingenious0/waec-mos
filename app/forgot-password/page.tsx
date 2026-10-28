'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Shield, KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier) return
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-white">
      {/* Top Banner */}
      <header className="flex h-16 items-center border-b border-[#22263c] bg-[#0d0f18]/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative size-9 overflow-hidden rounded-lg border border-[#303654] bg-[#11131f]">
            <Image
              src="/images/waec-logo.jpg"
              alt="WAEC"
              width={36}
              height={36}
              className="size-full object-cover"
              priority
            />
          </div>
          <div>
            <div className="text-sm font-black tracking-wider text-white">
              WAEC <span className="text-[#f6d300]">MOS</span>
            </div>
            <div className="text-[9px] tracking-widest text-slate-500">
              CREDENTIAL RECOVERY
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#22263c] bg-[#11131f] p-6 shadow-2xl md:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-[#303654] bg-[#15192b] text-[#8290ff]">
                <KeyRound size={24} />
              </div>
              <h1 className="text-xl font-black text-white">Reset Account Access</h1>
              <p className="mt-1 text-xs text-slate-400">
                Enter your registered Staff ID or Email to initiate verification.
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
                  <p className="font-bold">Request Dispatched</p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    If this Staff ID or email matches an active account, verification instructions have been dispatched to your registered phone and email. Contact your regional coordinator for immediate on-duty assistance.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#8290ff] hover:underline"
                >
                  <ArrowLeft size={13} />
                  Return to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    Staff ID or Registered Email
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. WAEC-GH-0412 or officer@waec.org"
                      className="w-full rounded-xl border border-[#303654] bg-[#15192b] py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#8290ff] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e2b7b] py-3 text-xs font-black tracking-wide text-white shadow-[0_0_20px_rgba(46,65,182,.3)] transition hover:bg-[#2b3cb8]"
                >
                  TRANSMIT RECOVERY REQUEST
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    <ArrowLeft size={13} />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
