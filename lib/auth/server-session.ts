/**
 * Server-side sessions. The cookie holds ONLY a random opaque token; the
 * database stores its SHA-256 hash. 12-hour absolute limit, 30-minute
 * idle timeout, new ID on every sign-in.
 */
import crypto, { createHash, randomBytes } from 'crypto'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import type { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'mos_session'
const ABSOLUTE_MS = 12 * 60 * 60 * 1000
const IDLE_MS = 30 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

function getClientIp(req: NextRequest | Request): string {
  const h = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  return h.split(',')[0]?.trim() || 'unknown'
}

const isProd = process.env.NODE_ENV === 'production'

export function setSessionCookie(res: NextResponse, rawToken: string) {
  res.cookies.set(COOKIE, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_MS / 1000,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 0 })
}

/** Create a new session row and return the raw token (cookie value). */
export async function createSession(
  userId: string,
  req: NextRequest | Request
): Promise<string | null> {
  if (!isLiveDatabase || !db) return null
  const raw = newToken()
  const now = Date.now()
  await db.insert(schema.session).values({
    id: `ses-${now}-${randomBytes(4).toString('hex')}`,
    expiresAt: new Date(now + ABSOLUTE_MS),
    token: hashToken(raw),
    createdAt: new Date(now),
    updatedAt: new Date(now),
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') || '',
    userId,
  })
  return raw
}

export interface ServerSession {
  id: string
  userId: string
}

export async function getSessionFromCookie(req: NextRequest | Request): Promise<ServerSession | null> {
  if (!isLiveDatabase || !db) return null
  const raw =
    req instanceof Object && 'cookies' in req
      ? (req as NextRequest).cookies.get(COOKIE)?.value
      : undefined
  if (!raw) return null

  const rows = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.token, hashToken(raw)))
    .limit(1)
  const row = rows[0]
  if (!row) return null

  const now = Date.now()
  if (new Date(row.expiresAt).getTime() <= now) {
    await db.delete(schema.session).where(eq(schema.session.id, row.id))
    return null
  }
  if (now - new Date(row.updatedAt).getTime() > IDLE_MS) {
    await db.delete(schema.session).where(eq(schema.session.id, row.id))
    return null
  }

  // Touch idle timer (30 min) — the absolute limit stays expiresAt (12 h)
  await db
    .update(schema.session)
    .set({ updatedAt: new Date(now) })
    .where(eq(schema.session.id, row.id))

  return { id: row.id, userId: row.userId }
}

export async function destroySession(req: NextRequest | Request): Promise<void> {
  if (!isLiveDatabase || !db) return
  const raw =
    req instanceof Object && 'cookies' in req
      ? (req as NextRequest).cookies.get(COOKIE)?.value
      : undefined
  if (!raw) return
  await db.delete(schema.session).where(eq(schema.session.token, hashToken(raw)))
}

export async function destroyAllSessions(userId: string, exceptId?: string): Promise<number> {
  if (!isLiveDatabase || !db) return 0
  const where = exceptId
    ? and(eq(schema.session.userId, userId), ne(schema.session.id, exceptId))
    : eq(schema.session.userId, userId)
  const deleted = await db.delete(schema.session).where(where).returning({ id: schema.session.id })
  return deleted.length
}

/** Needed for logout-all (everywhere except this device). */
export function sessionCookieName(): string {
  return COOKIE
}
