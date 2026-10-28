'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearClientSession, SessionData } from '@/lib/auth/session'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { ProfileModal } from '@/components/profile/ProfileModal'

interface V1NavbarProps {
  session: SessionData | null
  activeTab?: string
  onTabChange?: (tab: string) => void
  tabs?: { id: string; label: string; count?: number }[]
  onDutyStatus?: string
}

export function V1Navbar({
  session,
  activeTab,
  onTabChange,
  tabs,
  onDutyStatus,
}: V1NavbarProps) {
  const router = useRouter()
  const [showProfile, setShowProfile] = useState(false)

  const handleSignOut = () => {
    clearClientSession()
    router.push('/login')
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-[#22263c] bg-[#0d0f18]/95 px-3 backdrop-blur md:px-6">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link href={session?.role === 'ADMIN' ? '/admin' : '/field'} className="flex items-center gap-2.5">
            <div className="relative flex size-9 sm:size-10 items-center justify-center overflow-hidden rounded-lg border border-[#303654] bg-[#11131f]">
              <Image
                src="/images/waec-logo.jpg"
                alt="West African Examinations Council"
                width={40}
                height={40}
                className="size-full object-cover"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm font-black tracking-[0.16em] text-white">
                  WAEC <span className="text-[#f6d300]">MOS</span>
                </span>
                <span className="rounded bg-[#1e2b7b] px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-[#8290ff]">
                  V1 FOUNDATION
                </span>
              </div>
              <div className="hidden text-[9px] tracking-[0.14em] text-slate-500 sm:block">
                EXAMINATION MONITORING & OPERATIONS SYSTEM
              </div>
            </div>
          </Link>
        </div>

        {/* Optional Workspace Tabs (for Admin if needed) */}
        {tabs && tabs.length > 0 && (
          <nav className="hidden items-center gap-1.5 md:flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-[#1e2b7b] text-white shadow-[0_0_15px_rgba(46,65,182,.3)]'
                    : 'text-slate-400 hover:bg-[#15192b] hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeTab === tab.id ? 'bg-[#2b3cb8] text-white' : 'bg-[#15192b] text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        {/* Right User Badge & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
            <>
              {/* Clickable Profile Pill */}
              <button
                onClick={() => setShowProfile(true)}
                title="Click to view complete Profile Dossier"
                className="group flex items-center gap-2 rounded-lg border border-[#22263c] bg-[#11131f] px-2.5 py-1.5 text-left transition hover:border-[#8290ff] hover:bg-[#15192b]"
              >
                <div className="flex size-7 items-center justify-center rounded-md bg-[#1e2b7b] text-xs font-black text-[#f6d300] transition group-hover:scale-105">
                  {session.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                    <span>{session.name}</span>
                    <ChevronDown size={12} className="text-slate-400 group-hover:text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                    <span className="font-mono text-[#8290ff]">{session.staffId}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-300">
                      {session.role === 'ADMIN' ? 'Admin' : 'Field Officer'}
                    </span>
                  </div>
                </div>
                {/* On mobile, small user icon */}
                <span className="text-[10px] font-bold text-[#8290ff] sm:hidden">Profile</span>
              </button>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[#1e2b7b] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2b3cb8]"
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        session={session}
        onDutyStatus={onDutyStatus}
      />
    </>
  )
}
