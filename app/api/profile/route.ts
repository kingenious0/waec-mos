import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { hashPin } from '@/lib/auth/pin'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        title: schema.user.title,
        firstName: schema.user.firstName,
        lastName: schema.user.lastName,
        email: schema.user.email,
        phone: schema.user.phone,
        photo: schema.user.image,
        bio: schema.user.bio,
        staffId: schema.user.staffId,
        role: schema.user.role,
        status: schema.user.status,
        group: schema.user.groupName,
        isGroupLeader: schema.user.isGroupLeader,
        pinChangedAt: schema.user.pinChangedAt,
        regionName: schema.regions.name,
      })
      .from(schema.user)
      .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
      .where(eq(schema.user.id, userId))
      .limit(1)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, profile: rows[0] })
  } catch (error) {
    console.error('Failed to load profile:', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId, name, email, phone, pin, photo, bio } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true })
    }

    const existing = await db
      .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined && String(name).trim()) updates.name = String(name).trim()
    if (email !== undefined && String(email).trim()) updates.email = String(email).trim()
    if (phone !== undefined) updates.phone = String(phone).trim()
    if (pin !== undefined && String(pin).trim()) {
      updates.pin = hashPin(String(pin).trim())
      updates.pinChangedAt = new Date()
    }
    if (photo !== undefined) updates.image = String(photo)
    if (bio !== undefined) updates.bio = String(bio)

    await db.update(schema.user).set(updates).where(eq(schema.user.id, userId))

    await recordAuditLog({
      actorId: userId,
      actorName: (updates.name as string) || existing[0].name,
      actorRole: existing[0].role,
      action: 'PROFILE_UPDATED',
      entityType: 'users',
      entityId: userId,
      details: {
        message: `${(updates.name as string) || existing[0].name} updated account profile details`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save profile:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

