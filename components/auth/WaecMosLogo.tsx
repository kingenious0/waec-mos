'use client'

import React from 'react'
import Link from 'next/link'

interface WaecMosLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function WaecMosLogo({ href = '/login', className = '', size = 'md' }: WaecMosLogoProps) {
  const markSizes = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11 sm:h-12 sm:w-12',
    lg: 'h-14 w-14 sm:h-16 sm:w-16',
  }

  const titleSizes = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
  }

  const subtitleSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  }

  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Real West African Examinations Council emblem */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/waec-logo.png"
        alt="The West African Examinations Council emblem"
        className={`${markSizes[size]} object-contain shrink-0`}
        width={96}
        height={96}
      />

      <div className="leading-tight">
        <div className={`${titleSizes[size]} text-white tracking-tight`}>WAEC MOS</div>
        <div className={`${subtitleSizes[size]} text-white/70 font-normal tracking-normal`}>
          Monitoring and Operations
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-block transition hover:opacity-95">
        {content}
      </Link>
    )
  }

  return content
}
