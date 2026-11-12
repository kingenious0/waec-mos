import { NextRequest, NextResponse } from 'next/server'
import { destroySession, clearSessionCookie } from '@/lib/auth/server-session'
import { clearLegacyClientState } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  await destroySession(request)
  const res = NextResponse.json({ success: true })
  clearSessionCookie(res)
  // belt-and-braces: strip any legacy client-auth cookies the browser still holds
  res.cookies.set('waec_role', '', { path: '/', maxAge: 0 })
  res.cookies.set('waec_user', '', { path: '/', maxAge: 0 })
  clearLegacyClientState()
  return res
}
