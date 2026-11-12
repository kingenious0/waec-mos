import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie, destroyAllSessions } from '@/lib/auth/server-session'

/** Sign out of EVERY device except the one calling. */
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const removed = await destroyAllSessions(session.userId, session.id)
  return NextResponse.json({ success: true, signedOut: removed })
}
