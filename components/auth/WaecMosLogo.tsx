'use client'

import React from 'react'
import Link from 'next/link'

interface WaecMosLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function WaecMosLogo({ href = '/login', className = '', size = 'md' }: WaecMosLogoProps) {
  const badgeSizes = {
    sm: 'size-9 rounded-xl',
    md: 'size-11 rounded-xl',
    lg: 'size-12 rounded-2xl',
  }

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
  }

  const subtitleSizes = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  }

  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Official yellow emblem with circular 'wa' badge */}
      <div
        className={`${badgeSizes[size]} bg-[#F6C90E] flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10 p-1`}
      >
        <svg
          viewBox="0 0 32 32"
          className="size-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Black circle contour */}
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke="#0A0D18"
            strokeWidth="2.2"
            fill="none"
          />
          {/* Stylized lowercase 'wa' ligature */}
          <text
            x="16"
            y="20.5"
            textAnchor="middle"
            fill="#0A0D18"
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="12.5"
            letterSpacing="-0.8px"
          >
            wa
          </text>
        </svg>
      </div>

      <div className="leading-tight">
        <div className={`${titleSizes[size]} text-white tracking-tight`}>
          WAEC MOS
        </div>
        <div className={`${subtitleSizes[size]} text-zinc-400 font-normal tracking-normal`}>
          Monitoring and Operations Suite
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
