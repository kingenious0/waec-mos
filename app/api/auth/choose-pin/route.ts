import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hashPin } from '@/lib/auth/pin'
import { validatePin } from '@/lib/auth/pin-policy'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { getSessionFromCookie, destroyAllSessions } from '@/lib/auth/server-session'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  pin: z.string().trim().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  pinConfirm: z.string().trim().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})

/**
 * POST /api/auth/choose-pin
 * Used immediately after a controller-issued temporary PIN signs the user in:
 *   - validates the new PIN against the trivial-pin policy
 *   - replaces the temporary PIN with the user's own
 *   - clears mustChangePassword
 *   - ends every OTHER session on the account
 *   - returns where to go next (by role)
 */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookie(request as any)
    if (!session) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 })

    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    const { pin, pinConfirm } = parsed.data
    if (pin !== pinConfirm) return NextResponse.json({ error: "The PINs don't match." }, { status: 400 })

    const rows = await db.select().from(schema.user).where(eq(schema.user.id, session.userId)).limit(1)
    const me = rows[0]
    if (!me) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

    const check = validatePin(pin, me.phone || '')
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

    await db
      .update(schema.user)
      .set({
        pin: hashPin(pin),
        mustChangePassword: false,
        pinChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, me.id))

    // End every session except THIS one
    await destroyAllSessions(me.id, session.id)

    await recordAuditLog({
      actorId: me.id,
      actorName: me.name,
      actorRole: me.role,
      action: 'PIN_CHOSEN',
      entityType: 'users',
      entityId: me.id,
      details: { message: `${me.name} chose their own PIN; other sessions ended` },
    })
    await recordSecurityEvent({
      action: 'PIN_CHOSEN',
      actorId: me.id,
      actorName: me.name,
      actorRole: me.role,
      details: { method: 'choose-pin' },
    })

    const role = (me.role || '').toUpperCase()
    const home = role === 'FIELD_OFFICER' ? '/field' : '/admin'
    return NextResponse.json({ ok: true, home })
  } catch (err) {
    console.error('choose-pin failed:', err)
    return NextResponse.json({ error: 'Could not save your PIN. Try again.' }, { status: 500 })
  }
}
