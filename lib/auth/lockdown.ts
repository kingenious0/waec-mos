/**
 * Lockdown — the "Lock everything now" switch. While active:
 *   - All non-admin sessions are invalidated (read-as-401)
 *   - Non-admin sign-ins are blocked
 *   - Admins may still sign in to turn it off
 * Cached for 5s to avoid a DB hit on every authenticated request.
 */
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface LockdownState {
  active: boolean
  enabledBy: string | null
  enabledAt: string | null
}

let cached: { state: LockdownState; expiresAt: number } | null = null
const CACHE_TTL_MS = 5_000

export async function getLockdownState(): Promise<LockdownState> {
  if (cached && cached.expiresAt > Date.now()) return cached.state

  if (!isLiveDatabase || !db) {
    cached = { state: { active: false, enabledBy: null, enabledAt: null }, expiresAt: Date.now() + CACHE_TTL_MS }
    return cached.state
  }

  const rows = await db
    .select({
      lockdownActive: schema.systemSettings.lockdownActive,
      lockdownEnabledBy: schema.systemSettings.lockdownEnabledBy,
      lockdownEnabledAt: schema.systemSettings.lockdownEnabledAt,
    })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.id, 'default-ashanti'))
    .limit(1)

  const lock = rows[0]
  const state: LockdownState = {
    active: Boolean(lock?.lockdownActive),
    enabledBy: lock?.lockdownEnabledBy || null,
    enabledAt: lock?.lockdownEnabledAt ? new Date(lock.lockdownEnabledAt).toISOString() : null,
  }
  cached = { state, expiresAt: Date.now() + CACHE_TTL_MS }
  return state
}

export async function setLockdown(active: boolean, actorId?: string, actorName?: string): Promise<void> {
  if (!isLiveDatabase || !db) return
  await db
    .update(schema.systemSettings)
    .set({
      lockdownActive: active,
      lockdownEnabledBy: active ? actorId || null : null,
      lockdownEnabledAt: active ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.systemSettings.id, 'default-ashanti'))
  cached = null // bust cache
}

export function invalidateLockdownCache() {
  cached = null
}
