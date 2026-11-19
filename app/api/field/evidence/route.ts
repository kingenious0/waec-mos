import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq, and } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2 MB cap (JPEG watermark shots)

const uploadSchema = z.object({
  // data URL: data:image/jpeg;base64,/9j/...
  dataUrl: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/),
  assignmentId: z.string().optional(),
  watermark: z.string().min(3).max(500),
})

/** POST /api/field/evidence — officer uploads their watermarked photo proof. */
export async function POST(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    }
    if (roleKind(caller.role) !== 'officer') {
      return NextResponse.json({ error: 'Only field officers can upload evidence.' }, { status: 403 })
    }
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = uploadSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Bad photo payload' }, { status: 400 })
    }
    const { dataUrl, assignmentId, watermark } = parsed.data

    const b64 = dataUrl.split(',', 2)[1]
    const bytes = Buffer.from(b64, 'base64')
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo is too big — keep it under 2 MB.' }, { status: 413 })
    }
    const mimeType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'

    const id = `evt-photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await db.insert(schema.evidencePhotos).values({
      id,
      officerId: caller.id,
      assignmentId: assignmentId || null,
      centerId: null,
      mimeType,
      photo: bytes,
      watermark,
    })

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.name || 'Field officer',
      actorRole: caller.role,
      action: 'EVIDENCE_PHOTO_UPLOADED',
      entityType: 'evidence_photos',
      entityId: id,
      details: { message: `${caller.name} uploaded a watermarked arrival photo`, watermark },
    })

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('evidence upload failed:', err)
    return NextResponse.json({ error: 'Could not store the photo. Try again.' }, { status: 500 })
  }
}

/**
 * GET /api/field/evidence?officerId=...[&latest=1]
 *   ?latest=1 streams the newest photo bytes (thumbnail; HQ or the officer).
 *   otherwise returns metadata list for HQ.
 */
export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (roleKind(caller.role) === 'officer') {
      // Officers may only fetch their own evidence history, never others'.
    } else if (!['ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(String(caller.role).toUpperCase())) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const officerParam = searchParams.get('officerId')
    const latestOnly = searchParams.get('latest') === '1'

    let officerId = caller.id
    if (roleKind(caller.role) !== 'officer' && officerParam) officerId = officerParam

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ photos: [] })
    }

    if (latestOnly) {
      const rows = await db
        .select()
        .from(schema.evidencePhotos)
        .where(eq(schema.evidencePhotos.officerId, officerId))
        .orderBy(desc(schema.evidencePhotos.createdAt))
        .limit(1)
      if (rows.length === 0) return new NextResponse(null, { status: 404 })
      const r = rows[0]
      return new NextResponse(r.photo as unknown as BodyInit, {
        headers: {
          'Content-Type': r.mimeType,
          'Cache-Control': 'no-store, private',
          'X-Photo-Id': r.id,
        },
      })
    }

    const rows = await db
      .select({
        id: schema.evidencePhotos.id,
        officerId: schema.evidencePhotos.officerId,
        watermark: schema.evidencePhotos.watermark,
        createdAt: schema.evidencePhotos.createdAt,
        mimeType: schema.evidencePhotos.mimeType,
      })
      .from(schema.evidencePhotos)
      .where(eq(schema.evidencePhotos.officerId, officerId))
      .orderBy(desc(schema.evidencePhotos.createdAt))
      .limit(20)

    return NextResponse.json({ photos: rows })
  } catch (err) {
    console.error('evidence GET failed:', err)
    return NextResponse.json({ error: 'Could not load evidence.' }, { status: 500 })
  }
}
