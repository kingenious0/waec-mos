'use client'

import React from 'react'
import Image from 'next/image'
import { GradientMesh } from '@/components/ui/login-page-utils/gradient-mesh'
import {
  ShieldCheck,
  Radio,
  MapPin,
  Activity,
  CheckCircle2,
  Layers,
  Lock,
  Building2,
  Server,
  Cpu,
} from 'lucide-react'

interface GhanaInstitutionalShowcaseProps {
  portalType?: 'OPERATIONS' | 'REGISTRY'
  title?: string
  description?: string
  badgeLabel?: string
}

// Ghana's key operational examination zones & commands
const GHANA_ZONES = [
  { name: 'Greater Accra', code: 'ACC', status: 'HQ Command' },
  { name: 'Ashanti (Kumasi)', code: 'KMS', status: 'Zonal Office' },
  { name: 'Western (Takoradi)', code: 'TKD', status: 'Active Sector' },
  { name: 'Central (Cape Coast)', code: 'CPC', status: 'Active Sector' },
  { name: 'Eastern (Koforidua)', code: 'KFD', status: 'Active Sector' },
  { name: 'Northern (Tamale)', code: 'TML', status: 'Zonal Office' },
]

export function GhanaInstitutionalShowcase({
  portalType = 'OPERATIONS',
  title,
  description,
  badgeLabel,
}: GhanaInstitutionalShowcaseProps) {
  const isRegistry = portalType === 'REGISTRY'
  const displayTitle = title || (isRegistry ? 'Official Personnel Registry' : 'Monitoring & Operations Suite')
  const displayDesc =
    description ||
    (isRegistry
      ? 'Examination monitor and supervisor rosters are provisioned exclusively through authorized regional and zonal coordination commands across Ghana.'
      : 'Real-time attendance verification, center telemetry, and coordinated incident response across accredited examination venues nationwide.')
  const topBadge = badgeLabel || (isRegistry ? 'Personnel Deployment Registry' : 'Ghana National Operations Grid')

  return (
    <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden min-h-full border-l border-white/5 bg-[#060818]">
      {/* Dynamic Fluid Council Navy Mesh Canvas */}
      <GradientMesh
        colors={['#040614', '#091030', '#132057']}
        distortion={5}
        swirl={0.18}
        speed={0.6}
        rotation={90}
        waveAmp={0.18}
        waveFreq={14}
        waveSpeed={0.18}
        grain={0.03}
      />

      {/* Ambient Vignette & Council Glow Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050713]/95 via-transparent to-[#050713]/60 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-[#F6D300]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -right-24 size-80 bg-[#1E2B7B]/30 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Coordinate / Telemetry Header Watermark */}
      <div className="absolute top-4 right-10 text-[9px] font-mono tracking-widest text-white/10 select-none pointer-events-none hidden xl:block">
        LAT 5.6037° N • LON 0.1870° W • ACCRA HQ
      </div>

      {/* TOP HEADER STATUS BAR */}
      <div className="relative z-10 flex items-center justify-between text-xs font-medium">
        {/* Live Status Pill with Ghana Flag Indicator */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-mono tracking-wider uppercase text-zinc-300 font-semibold">
            {topBadge}
          </span>
          <span className="h-2.5 w-px bg-white/15" />
          <span className="text-[10px] font-mono text-emerald-400 font-medium">LIVE GRID</span>
        </div>

        {/* Security & Heritage Designation */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
          <span className="text-[#F6D300] font-semibold">EST. 1952</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">ACCRA HQ</span>
        </div>
      </div>

      {/* CENTERPIECE: INSTITUTIONAL CREST & GHANA NATIONAL OPERATIONS CONSOLE */}
      <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center max-w-xl mx-auto w-full">
        {/* Official WAEC Crest Medallion with Golden Halo */}
        <div className="relative mb-4 group">
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-[#F6D300]/30 via-[#1E2B7B]/40 to-emerald-500/10 blur-xl opacity-75 group-hover:opacity-100 transition duration-700" />
          <div className="relative size-28 sm:size-32 rounded-2xl bg-white p-3.5 shadow-2xl shadow-black/80 border border-white/50 flex items-center justify-center transform group-hover:scale-[1.02] transition duration-300">
            <Image
              src="/images/waec-logo.jpg"
              alt="Official WAEC Crest"
              width={120}
              height={120}
              className="size-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Republic of Ghana Sovereign Badge */}
        <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-amber-400/25 text-xs font-mono text-zinc-200 shadow-[0_0_15px_rgba(246,211,0,0.08)] backdrop-blur-md">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <span className="text-sm">🇬🇭</span> REPUBLIC OF GHANA
          </span>
          <span className="text-amber-400 font-bold">•</span>
          <span className="text-amber-300 font-medium tracking-wider text-[11px] uppercase">
            National Office
          </span>
        </div>

        {/* Council Branding & Major Heading */}
        <div className="space-y-2.5 mb-6">
          <div className="text-xs font-bold tracking-widest text-[#F6D300] uppercase font-mono">
            The West African Examinations Council
          </div>
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-snug">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-lg mx-auto pt-1 font-sans">
            {displayDesc}
          </p>
        </div>

        {/* GHANA OPERATIONAL GRID CONSOLE CARD (EXCLUSIVELY FOR GHANA) */}
        <div className="w-full rounded-2xl bg-[#0B0F24]/80 border border-white/10 p-5 shadow-2xl backdrop-blur-md text-left transition hover:border-white/15">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-[#1E2B7B]/60 border border-[#1E2B7B] flex items-center justify-center text-[#F6D300]">
                <Radio className="size-3.5 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white tracking-wide uppercase font-mono">
                  Ghana Regional Deployment Grid
                </span>
                <p className="text-[10px] text-zinc-400 font-mono">16 Administrative Regions Synchronized</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-300 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ACTIVE DEPLOYMENT</span>
            </div>
          </div>

          {/* Ghana Zonal Hub Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3.5">
            {GHANA_ZONES.map((zone) => (
              <div
                key={zone.name}
                className="group/chip flex flex-col p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-amber-400/30 transition duration-200"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-300/90 group-hover/chip:text-[#F6D300]">
                    {zone.code}
                  </span>
                  <span className="size-1.5 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-xs font-semibold text-white mt-1 truncate">
                  {zone.name}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {zone.status}
                </span>
              </div>
            ))}
          </div>

          {/* National Telemetry Highlights Bar */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
              <Building2 className="size-3.5 text-[#F6D300] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-white">775+</div>
                <div className="text-[9px] text-zinc-400 font-mono truncate">Accredited Centres</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
              <MapPin className="size-3.5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-white">16 / 16</div>
                <div className="text-[9px] text-zinc-400 font-mono truncate">Regions Covered</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
              <ShieldCheck className="size-3.5 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold font-mono text-white">AES-256</div>
                <div className="text-[9px] text-zinc-400 font-mono truncate">Secure Channel</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM REGIONAL COMMAND FOOTER */}
      <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400 font-mono border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-300 font-medium">Ghana National Operations Command</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Accra Headquarters</span>
          <span className="text-zinc-600">•</span>
          <span className="text-[#F6D300] font-semibold">Kumasi Zonal</span>
        </div>
      </div>
    </div>
  )
}
