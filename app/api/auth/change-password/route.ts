import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { recordAuditLog } from '@/lib/db/audit'
import { getSessionFromCookie } from '@/lib/auth/server-session'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { newPassword, currentPassword } = await request.json()

    if (!newPassword || String(newPassword).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json(
        { error: 'Something went wrong on our side. Try again.' },
        { status: 503 }
      )
    }

    const existing = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        role: schema.user.role,
        passwordHash: schema.user.passwordHash,
      })
      .from(schema.user)
      .where(eq(schema.user.id, session.userId))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    // If a current password is set, require it — but never for first-time sets
    if (existing[0].passwordHash && currentPassword) {
      if (!verifyPassword(currentPassword, existing[0].passwordHash)) {
        return NextResponse.json(
          { error: 'Current password is not right.' },
          { status: 401 }
        )
      }
    }

    const hashed = hashPassword(String(newPassword))

    await db
      .update(schema.user)
      .set({
        passwordHash: hashed,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, session.userId))

    // Keep Better Auth credential hash updated if present
    await db
      .update(schema.account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(schema.account.userId, session.userId))

    await recordAuditLog({
      actorId: existing[0].id,
      actorName: existing[0].name,
      actorRole: existing[0].role,
      action: 'PASSWORD_ROTATED',
      entityType: 'users',
      entityId: existing[0].id,
      details: {
        message: `${existing[0].name} updated their account password`,
      },
    })

    return NextResponse.json({ success: true, message: 'Password updated' })
  } catch (error) {
    console.error('Failed to change password:', error)
    return NextResponse.json(
      { error: 'Something went wrong on our side. Try again.' },
      { status: 500 }
    )
  }
}
