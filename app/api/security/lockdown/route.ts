import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guard'
import { getLockdownState, setLockdown } from '@/lib/auth/lockdown'
import { destroyAllSessions, getSessionFromCookie } from '@/lib/auth/server-session'
import { recordSecurityEvent } from '@/lib/db/audit'
import { z } from 'zod'

const schema = z.object({
  action: z.enum(['lock', 'lift']),
})

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request as any)
  if (gate.error) return gate.error
  const state = await getLockdownState()
  return NextResponse.json({
    active: state.active,
    enabledBy: state.enabledBy,
    enabledAt: state.enabledAt,
  })
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const raw = await request.json()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const session = await getSessionFromCookie(request)

    if (parsed.data.action === 'lock') {
      await setLockdown(true, gate.user.id, gate.user.name)
      // Kill every session except this admin's own (they need it to lift the lock)
      const killed = await destroyAllSessions(gate.user.id, session?.id)
      await recordSecurityEvent({
        action: 'LOCKDOWN_ON',
        actorId: gate.user.id,
        actorName: gate.user.name,
        actorRole: gate.user.role,
        details: { sessionsKilled: killed },
      })
      return NextResponse.json({ success: true, active: true })
    }

    await setLockdown(false)
    await recordSecurityEvent({
      action: 'LOCKDOWN_OFF',
      actorId: gate.user.id,
      actorName: gate.user.name,
      actorRole: gate.user.role,
    })
    return NextResponse.json({ success: true, active: false })
  } catch (error) {
    console.error('Lockdown error:', error)
    return NextResponse.json({ error: 'Something went wrong on our side.' }, { status: 500 })
  }
}
