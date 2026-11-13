/**
 * Phase 2 access guard. Deny by default.
 * Every API route must resolve its caller through this module.
 *
 * Roles in the DB: FIELD_OFFICER, REGIONAL_COORD, SUPERVISOR, ADMIN, SUPER_ADMIN
 *   officer     → FIELD_OFFICER, own data only
 *   controller  → REGIONAL_COORD or SUPERVISOR, their region
 *   admin       → ADMIN or SUPER_ADMIN
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromCookie } from '@/lib/auth/server-session'

export type GuardRole = 'officer' | 'controller' | 'admin'

export interface GuardUser {
  id: string
  name: string
  role: string
  regionId: string | null
  regionName: string | null
  status: string
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']
const CONTROLLER_ROLES = ['REGIONAL_COORD', 'SUPERVISOR']
const OFFICER_ROLES = ['FIELD_OFFICER']

function classify(role: string): GuardRole | null {
  const r = (role || '').toUpperCase()
  if (ADMIN_ROLES.includes(r)) return 'admin'
  if (CONTROLLER_ROLES.includes(r)) return 'controller'
  if (OFFICER_ROLES.includes(r)) return 'officer'
  return null
}

async function loadUser(userId: string): Promise<GuardUser | null> {
  if (!isLiveDatabase || !db) return null
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      role: schema.user.role,
      status: schema.user.status,
      regionId: schema.user.regionId,
      regionName: schema.regions.name,
    })
    .from(schema.user)
    .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
    .where(eq(schema.user.id, userId))
    .limit(1)
  return rows[0] ? (rows[0] as GuardUser) : null
}

/** Returns the signed-in user or null. */
export async function getServerUser(request: NextRequest | Request): Promise<GuardUser | null> {
  const session = await getSessionFromCookie(request as NextRequest)
  if (!session) return null
  const user = await loadUser(session.userId)
  if (!user) return null
  if (user.status !== 'ACTIVE') return null
  return user
}

export type GuardResult =
  | { user: GuardUser; error?: never }
  | { user?: never; error: NextResponse }

function deny(status: number, message: string): GuardResult {
  return { error: NextResponse.json({ error: message }, { status }) }
}

/** Signed-in but nothing else required. */
export async function requireUser(request: NextRequest | Request): Promise<GuardResult> {
  const user = await getServerUser(request)
  if (!user) return deny(401, 'Please sign in again.')
  return { user }
}

/** Admins + controllers only. */
export async function requireCommand(request: NextRequest | Request): Promise<GuardResult> {
  const user = await getServerUser(request)
  if (!user) return deny(401, 'Please sign in again.')
  const kind = classify(user.role)
  if (kind === 'admin' || kind === 'controller') return { user }
  return deny(403, 'This area is restricted to command staff.')
}

/** Admins only. */
export async function requireAdmin(request: NextRequest | Request): Promise<GuardResult> {
  const user = await getServerUser(request)
  if (!user) return deny(401, 'Please sign in again.')
  if (classify(user.role) === 'admin') return { user }
  return deny(403, 'This area is restricted to administrators.')
}

/** Field officers only (self endpoints). */
export async function requireOfficer(request: NextRequest | Request): Promise<GuardResult> {
  const user = await getServerUser(request)
  if (!user) return deny(401, 'Please sign in again.')
  if (classify(user.role) === 'officer') return { user }
  return deny(403, 'This area is restricted to field officers.')
}

export function roleKind(role: string): GuardRole {
  return classify(role) ?? 'officer'
}
