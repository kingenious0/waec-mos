import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { recordAuditLog } from '@/lib/db/audit'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    if (isLiveDatabase && db) {
      const existing = await db
        .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1)

      if (existing.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const hashed = hashPassword(String(newPassword))

      await db
        .update(schema.user)
        .set({
          passwordHash: hashed,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, userId))

      // Also keep Better Auth account credential hash updated if present
      await db
        .update(schema.account)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(schema.account.userId, userId))

      await recordAuditLog({
        actorId: existing[0].id,
        actorName: existing[0].name,
        actorRole: existing[0].role,
        action: 'PASSWORD_ROTATED',
        entityType: 'users',
        entityId: existing[0].id,
        details: {
          message: `${existing[0].name} updated permanent account password`,
        },
      })

      return NextResponse.json({ success: true, message: 'Password updated successfully' })
    }

    const success = store.changeUserPassword(userId, newPassword)
    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Failed to change password:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
