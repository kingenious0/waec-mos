import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { hashPin } from '@/lib/auth/pin'
import { validatePin } from '@/lib/auth/pin-policy'
import { getSessionFromCookie } from '@/lib/auth/server-session'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookie(request as any)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requested = searchParams.get('userId') || session.userId

    // Self-service only — use the dossier API for officer records
    const userId = requested === session.userId ? requested : session.userId

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
    const session = await getSessionFromCookie(request as any)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, pin, photo, bio, title, firstName, lastName } = body
    const userId = session.userId // self-service only

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true })
    }

    const existing = await db
      .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role, phone: schema.user.phone })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }

    // Split-name fields — keep the display `name` column recomposed so every
    // surface that reads `name` stays consistent.
    if (title !== undefined) updates.title = String(title).trim().slice(0, 40)
    if (firstName !== undefined) updates.firstName = String(firstName).trim().slice(0, 80)
    if (lastName !== undefined) updates.lastName = String(lastName).trim().slice(0, 80)
    if (firstName !== undefined || lastName !== undefined || title !== undefined) {
      const row = await db
        .select({
          title: schema.user.title,
          firstName: schema.user.firstName,
          lastName: schema.user.lastName,
          name: schema.user.name,
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1)
      const merged = {
        title: title !== undefined ? String(title).trim() : row[0]?.title || '',
        firstName: firstName !== undefined ? String(firstName).trim() : row[0]?.firstName || '',
        lastName: lastName !== undefined ? String(lastName).trim() : row[0]?.lastName || '',
      }
      const composed = [merged.title, merged.firstName, merged.lastName].filter(Boolean).join(' ').trim()
      if (composed && !String(name || '').trim()) updates.name = composed
    }

    const phoneValidator = /^(\+233|0)\d{9}$/
    if (name !== undefined && String(name).trim()) {
      if (String(name).trim().length > 120) {
        return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
      }
      updates.name = String(name).trim()
    }
    if (email !== undefined) {
      const emailClean = String(email).trim()
      if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      }
      if (emailClean.length > 120) {
        return NextResponse.json({ error: 'Email is too long.' }, { status: 400 })
      }
      updates.email = emailClean
    }
    if (phone !== undefined) {
      const phoneClean = String(phone).trim().replace(/\s+/g, '')
      if (phoneClean && !phoneValidator.test(phoneClean)) {
        return NextResponse.json({ error: 'Enter a Ghana phone number (e.g. 024 000 0000).' }, { status: 400 })
      }
      updates.phone = phoneClean
    }
    if (pin !== undefined && String(pin).trim()) {
      const effectivePhone = phone !== undefined ? String(phone).trim().replace(/\s+/g, '') : existing[0].phone || ''
      const check = validatePin(String(pin).trim(), effectivePhone)
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 })
      }
      updates.pin = hashPin(String(pin).trim())
      updates.pinChangedAt = new Date()
    }
    if (photo !== undefined) {
      const photoClean = String(photo)
      if (photoClean.length > 900_000) {
        return NextResponse.json({ error: 'That image is too large. Pick a smaller one (max ~600 KB).' }, { status: 400 })
      }
      if (photoClean && !photoClean.startsWith('data:image/') && !photoClean.startsWith('https://')) {
        return NextResponse.json({ error: 'Unsupported image format.' }, { status: 400 })
      }
      updates.image = photoClean
    }
    if (bio !== undefined) {
      const bioClean = String(bio).trim()
      if (bioClean.length > 500) {
        return NextResponse.json({ error: 'About is too long (max 500 characters).' }, { status: 400 })
      }
      updates.bio = bioClean
    }

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
        fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save profile:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

