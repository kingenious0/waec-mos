import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireCommand } from '@/lib/auth/guard'
import { recordSecurityEvent } from '@/lib/db/audit'
import { z } from 'zod'
import { eq, and, gte, desc } from 'drizzle-orm'

const reviewSchema = z.object({
  action: z.enum(['it_was_me', 'block']),
  targetUserId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const gate = await requireCommand(request as any)
  if (gate.error) return gate.error
  if (!isLiveDatabase || !db) {
    return NextResponse.json({ items: [] })
  }

  const items: any[] = []

  // 1) Accounts with 3+ failed tries (recent lockout pressure)
  try {
    const lockedPressure = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        staffId: schema.user.staffId,
        failedLoginAttempts: schema.user.failedLoginAttempts,
        lockedUntil: schema.user.lockedUntil,
        lastLoginAt: schema.user.lastLoginAt,
      })
      .from(schema.user)
      .where(gte(schema.user.failedLoginAttempts, 3))
      .limit(5)

    for (const u of lockedPressure) {
      items.push({
        id: `lock-${u.id}`,
        kind: 'locked_out',
        title: `${u.failedLoginAttempts} wrong PIN tries`,
        detail: `${u.name}${u.staffId ? ` (${u.staffId})` : ''} — account is locked and waiting on reset.`,
        time: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
        targetUserId: u.id,
        action: 'block',
      })
    }
  } catch {
    // non-fatal
  }

  // 2) New-device sign-ins + login-from-unknown-IP events
  try {
    const recent = await db
      .select({
        id: schema.securityEvents.id,
        action: schema.securityEvents.action,
        actorId: schema.securityEvents.actorId,
        actorName: schema.securityEvents.actorName,
        details: schema.securityEvents.details,
        createdAt: schema.securityEvents.createdAt,
      })
      .from(schema.securityEvents)
      .where(eq(schema.securityEvents.action, 'NEW_DEVICE_SIGNIN'))
      .orderBy(desc(schema.securityEvents.createdAt))
      .limit(5)

    for (const e of recent) {
      const details = (e.details as Record<string, any>) || {}
      items.push({
        id: e.id,
        kind: 'new_device',
        title: 'Signed in on a new phone',
        detail: `${e.actorName || 'Unknown'} — ${details.userAgent ? String(details.userAgent).slice(0, 60) : 'unknown device'}`,
        time: e.createdAt ? new Date(e.createdAt).toISOString() : null,
        targetUserId: e.actorId || null,
        action: 'review',
      })
    }
  } catch {
    // non-fatal
  }

  // 3) Admins who signed in outside usual duty hours isn't tracked yet — surface what we have
  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error

    const raw = await request.json()
    const parsed = reviewSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true })
    }

    const { action, targetUserId } = parsed.data

    const targetRows = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, targetUserId))
      .limit(1)
    const target = targetRows[0]

    if (action === 'block') {
      await db
        .update(schema.user)
        .set({ status: 'REVOKED', updatedAt: new Date() })
        .where(eq(schema.user.id, targetUserId))

      await recordSecurityEvent({
        action: 'REVIEW_BLOCK',
        actorId: gate.user.id,
        actorName: gate.user.name,
        actorRole: gate.user.role,
        targetUserId,
        targetUserName: target?.name,
      })
      return NextResponse.json({ success: true, action: 'blocked' })
    }

    await recordSecurityEvent({
      action: 'REVIEW_OK',
      actorId: gate.user.id,
      actorName: gate.user.name,
      actorRole: gate.user.role,
      targetUserId,
      targetUserName: target?.name,
    })
    return NextResponse.json({ success: true, action: 'dismissed' })
  } catch (error) {
    console.error('Security review error:', error)
    return NextResponse.json({ error: 'Something went wrong on our side.' }, { status: 500 })
  }
}
