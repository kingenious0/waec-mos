import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight gate:
 *  1. Bounce unauthenticated browsers away from protected pages.
 *     Cookie PRESENCE is checked here; cookie VALIDITY is always
 *     enforced server-side in getSessionFromCookie.
 *  2. Block cross-origin state-changing API requests (CSRF).
 *     Same-origin POSTs carry matching Host and Origin/Referer.
 */
const PROTECTED = ['/admin', '/field', '/profile']
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ---- CSRF guard for API routes ----
  if (pathname.startsWith('/api/')) {
    if (SAFE_METHODS.has(request.method)) return NextResponse.next()

    const host = request.headers.get('host')
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')

    // Same-site API calls always carry a matching Origin or Referer
    const source = origin || referer
    if (!source) {
      // No origin metadata (e.g. same-site fetch with credentials) — allow if cookie present
      const hasSession = Boolean(request.cookies.get('mos_session')?.value)
      if (hasSession) return NextResponse.next()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const sourceHost = new URL(source).host
      if (sourceHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // ---- Page guard ----
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
  matcher: ['/admin/:path*', '/field/:path*', '/profile/:path*', '/api/:path*'],
}
