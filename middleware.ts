import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight gate: bounce unauthenticated browsers away from protected
 * pages. Cookie PRESENCE is checked here; cookie VALIDITY (expiry, idle,
 * revocation) is ALWAYS enforced server-side in getSessionFromCookie.
 */
const PROTECTED = ['/admin', '/field', '/profile']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('mos_session')?.value
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/field/:path*', '/profile/:path*'],
}
