'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { WaecMosLogo } from '@/components/auth/WaecMosLogo'
import { NationalOperationsShowcase } from '@/components/auth/NationalOperationsShowcase'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Shield } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-[#080B16] text-zinc-100 selection:bg-[#375DFB] selection:text-white">
      {/* LEFT COLUMN: RECOVERY FORM */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-16 max-w-xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center justify-between">
          <WaecMosLogo href="/login" size="md" />
          <Link
            href="/login"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Sign in</span>
          </Link>
        </header>

        {/* Main Content */}
        <main className="py-8 sm:py-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Reset account PIN
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter your registered phone number or Staff ID. Your regional coordinator will dispatch a secure 4-digit verification token.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl bg-[#0D1224] border border-emerald-500/30 p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Recovery Request Transmitted</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-1.5 max-w-sm mx-auto">
                    If this identifier matches an accredited officer or administrator, verification instructions have been dispatched to your regional command hub.
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#2B50EF] text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                  >
                    <span>Return to Sign In</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="identifier" className="text-xs font-medium text-zinc-300">
                    Phone number or Staff ID
                  </label>
                  <div className="relative">
                    <input
                      id="identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 024 412 8900 or WAEC-GH-0412"
                      className="w-full h-12 rounded-xl bg-[#0D1224] border border-white/10 px-4 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-[#375DFB] focus:ring-1 focus:ring-[#375DFB] transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-[#375DFB] hover:bg-[#2B50EF] text-white font-semibold text-sm sm:text-base shadow-lg shadow-[#375DFB]/25 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Transmit recovery request</span>
                  <ArrowRight className="size-4" />
                </button>
              </form>
            )}

            {/* Official Security Box */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-[#141824] border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-3">
              <Shield className="size-4 text-[#FACC15] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Security tokens are encrypted and valid for 15 minutes. Contact your regional coordinator for immediate on-duty assistance.
              </p>
            </div>

            <div className="pt-1 text-center">
              <Link
                href="/login"
                className="text-xs font-semibold text-[#8B9FFB] hover:text-white transition inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to sign in</span>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 border-t border-white/5 text-xs text-zinc-500">
          <p>© The West African Examinations Council</p>
        </footer>
      </div>

      {/* RIGHT COLUMN: NATIONAL OPERATIONS GRID SHOWCASE */}
      <NationalOperationsShowcase />
    </div>
  )
}
