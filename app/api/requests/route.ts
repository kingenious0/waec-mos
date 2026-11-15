import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireCommand } from '@/lib/auth/guard'
import { desc, eq } from 'drizzle-orm'

/**
 * GET /api/requests
 * Controller view of pending account + PIN-reset requests.
 * Command staff only. Ordered newest first.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected' }, { status: 503 })

    const [accessRequests, pinResetRequests] = await Promise.all([
      db.select().from(schema.accountRequests).orderBy(desc(schema.accountRequests.createdAt)).limit(50),
      db.select().from(schema.pinResetRequests).orderBy(desc(schema.pinResetRequests.createdAt)).limit(50),
    ])

    return NextResponse.json({ accessRequests, pinResetRequests })
  } catch (err) {
    console.error('requests list failed:', err)
    return NextResponse.json({ error: 'Could not load requests.' }, { status: 500 })
  }
}
