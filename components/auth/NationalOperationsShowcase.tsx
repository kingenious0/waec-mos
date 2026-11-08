'use client'

import React from 'react'
import { MapPin, AlertTriangle, Clock } from 'lucide-react'

export function NationalOperationsShowcase() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 min-h-full bg-[#070A18] border-l border-white/5 overflow-hidden select-none">
      {/* Background Dot Matrix Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(147, 163, 209, 0.28) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Subtle Ambient Radial Glow for depth */}
      <div className="absolute top-1/4 right-1/4 size-[500px] bg-[#1E2B7B]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 size-[320px] bg-emerald-500/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Showcase Content */}
      <div className="relative z-10 my-auto max-w-xl">
        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D1C1B] border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-7 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <span>NATIONAL OPERATIONS GRID · LIVE</span>
        </div>

        {/* Main Heading */}
        <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.12] mb-4">
          Every officer, every centre, in one place.
        </h2>

        {/* Supporting Description */}
        <p className="text-base xl:text-lg text-zinc-400 leading-relaxed mb-12">
          Real-time attendance verification and coordinated incident response across accredited examination venues.
        </p>

        {/* 3 Core Operational Capabilities */}
        <div className="space-y-8">
          {/* Feature 1: Verified check-in */}
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-[#141A2E] border border-white/10 flex items-center justify-center text-[#F6C90E] shrink-0 shadow-sm mt-0.5">
              <MapPin className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Verified check-in
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">
                GPS confirms every officer is inside the 150 m exam perimeter.
              </p>
            </div>
          </div>

          {/* Feature 2: Instant SOS */}
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-[#141A2E] border border-white/10 flex items-center justify-center text-[#F6C90E] shrink-0 shadow-sm mt-0.5">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Instant SOS
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">
                One hold alerts the regional hub with location and battery.
              </p>
            </div>
          </div>

          {/* Feature 3: Live fleet view */}
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-[#141A2E] border border-white/10 flex items-center justify-center text-[#F6C90E] shrink-0 shadow-sm mt-0.5">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Live fleet view
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">
                Controllers see every officer and centre in real time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Statistics */}
      <div className="relative z-10 pt-10 border-t border-white/10 grid grid-cols-3 gap-6 max-w-xl">
        <div>
          <div className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight">
            16
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-medium">
            Regions
          </div>
        </div>

        <div>
          <div className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight">
            775+
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-medium">
            Accredited centres
          </div>
        </div>

        <div>
          <div className="text-3xl xl:text-4xl font-extrabold text-emerald-400 tracking-tight">
            Live
          </div>
          <div className="text-xs text-zinc-400 mt-1 font-medium">
            Gateway online
          </div>
        </div>
      </div>
    </div>
  )
}
