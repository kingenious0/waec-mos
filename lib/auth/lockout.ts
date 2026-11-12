/**
 * Phase 1 lockout policy (DB-backed so it holds across serverless instances):
 *   - 5 wrong tries → account locked for 5 minutes
 *   - each repeat lockout doubles the wait (5, 10, 20, 40 min cap)
 *   - the same throttle applies per phone number and per IP address
 * Successful sign-in resets the counters.
 */
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const MAX_ATTEMPTS = 5
const BASE_LOCK_MS = 5 * 60 * 1000
const WINDOW_MS = 5 * 60 * 1000

type Db = NonNullable<typeof db>

function now() {
  return Date.now()
}

export async function checkLockout(userId?: string, ip?: string): Promise<boolean> {
  if (!isLiveDatabase || !db || !userId) {
    // Without the DB we can't enforce account lockouts — still block a hot IP.
    return ip ? checkIpCounter(ip) : false
  }
  const rows = await db
    .select({ lockedUntil: schema.user.lockedUntil })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)
  if (rows[0]?.lockedUntil && new Date(rows[0].lockedUntil).getTime() > now()) {
    return true
  }
  return ip ? checkIpCounter(ip) : false
}

async function checkIpCounter(ip: string): Promise<boolean> {
  if (!db) return false
  const rows = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, `ip:${ip}`))
    .limit(1)
  const row = rows[0]
  return Boolean(row && row.count >= MAX_ATTEMPTS && new Date(row.resetAt).getTime() > now())
}

async function bumpCounter(db_: Db, key: string): Promise<number> {
  const rows = await db_
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .limit(1)
  const existing = rows[0]
  const windowActive = existing && new Date(existing.resetAt).getTime() > now()

  if (windowActive) {
    const count = existing.count + 1
    await db_
      .update(schema.rateLimits)
      .set({ count })
      .where(eq(schema.rateLimits.key, key))
    return count
  }

  const resetAt = new Date(now() + WINDOW_MS)
  await db_
    .insert(schema.rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count: 1, resetAt },
    })
  return 1
}

export async function recordLoginFailure(userId?: string, ip?: string, phoneDigits?: string) {
  if (!db) return
  // Per-phone and per-IP throttles (independent of whether the account exists)
  if (phoneDigits) await bumpCounter(db, `phone:${phoneDigits}`)
  if (ip) await bumpCounter(db, `ip:${ip}`)

  if (!userId) return

  const rows = await db
    .select({
      failedLoginAttempts: schema.user.failedLoginAttempts,
      lockoutCount: schema.user.lockoutCount,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)
  const current = rows[0]
  if (!current) return

  const attempts = current.failedLoginAttempts + 1
  const patch: Record<string, unknown> = { failedLoginAttempts: attempts }

  if (attempts >= MAX_ATTEMPTS) {
    const lockouts = current.lockoutCount + 1
    const lockMs = Math.min(BASE_LOCK_MS * Math.pow(2, Math.min(lockouts - 1, 3)), 40 * 60 * 1000)
    patch.lockedUntil = new Date(now() + lockMs)
    patch.lockoutCount = lockouts
    patch.failedLoginAttempts = 0 // count the lockout, not the tries
  }

  await db.update(schema.user).set(patch).where(eq(schema.user.id, userId))
}

export async function recordLoginSuccess(userId: string, ip?: string, phoneDigits?: string) {
  if (!db) return
  await db
    .update(schema.user)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lockoutCount: 0 })
    .where(eq(schema.user.id, userId))

  if (ip) {
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, `ip:${ip}`))
  }
  if (phoneDigits) {
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, `phone:${phoneDigits}`))
  }
}
