import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { lt, and, inArray } from 'drizzle-orm'

/**
 * Vercel cron — runs daily. Purges location/telemetry history older than
 * RETAIN_LOCATION_DAYS (WAEC policy: 90 days by default).
 *
 * Location history lives in:
 *   - assignments.checkInLat/Lng (kept for the duration of an open operation)
 *   - audit_logs rows for telemetry-type actions
 *   - user.lastLatitude/lastLongitude (last known — not history)
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LOCATION_ACTIONS = [
  'CHECK_IN_LOGGED',
  'CHECK_OUT_LOGGED',
  'GEOFENCE_BREACH',
  'LOW_BATTERY_ALERT',
] as const

export async function GET(request: Request) {
  // Only Vercel cron (or an explicit secret) may call this
  const auth = request.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : ''
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isLiveDatabase || !db) {
    return NextResponse.json({ purged: 0, message: 'Database not connected' })
  }

  const retainDays = Math.max(1, Number(process.env.RETAIN_LOCATION_DAYS || '90') || 90)
  const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(schema.auditLogs)
    .where(
      and(
        lt(schema.auditLogs.createdAt, cutoff),
        inArray(schema.auditLogs.action, [...LOCATION_ACTIONS])
      )
    )
    .returning({ id: schema.auditLogs.id })

  return NextResponse.json({ purged: result.length, cutoff: cutoff.toISOString() })
}
