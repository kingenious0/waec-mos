/**
 * Shared sliding-window IP rate limiter, backed by the rate_limits table
 * created in the Phase 1 auth hardening migration.
 */
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const now = () => Date.now()
const WINDOW_MS = 5 * 60 * 1000

export async function hitRateLimit(
  key: string,
  maxHits: number
): Promise<{ limited: boolean; remaining: number }> {
  if (!isLiveDatabase || !db) {
    return { limited: false, remaining: maxHits }
  }
  const rows = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .limit(1)
  const existing = rows[0]
  const windowActive = existing && new Date(existing.resetAt).getTime() > now()

  if (windowActive) {
    const count = existing.count + 1
    if (count > maxHits) {
      await db
        .update(schema.rateLimits)
        .set({ count })
        .where(eq(schema.rateLimits.key, key))
      return { limited: true, remaining: 0 }
    }
    await db
      .update(schema.rateLimits)
      .set({ count })
      .where(eq(schema.rateLimits.key, key))
    return { limited: false, remaining: Math.max(0, maxHits - count) }
  }

  const resetAt = new Date(now() + WINDOW_MS)
  await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count: 1, resetAt },
    })
  return { limited: false, remaining: maxHits - 1 }
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}
