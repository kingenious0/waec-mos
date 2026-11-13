import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'

export interface AuditEntryInput {
  actorId: string
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  details?: Record<string, unknown>
}

export async function recordAuditLog(entry: AuditEntryInput): Promise<void> {
  if (!isLiveDatabase || !db) return
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await db.insert(schema.auditLogs).values({
      id,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details ?? {},
      isRead: false,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('Failed to record audit log:', err)
  }
}

export interface SecurityEventInput {
  action: string
  actorId?: string
  actorName?: string
  actorRole?: string
  targetUserId?: string
  targetUserName?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/** Append-only security ledger — no update/delete route exists anywhere in the app. */
export async function recordSecurityEvent(entry: SecurityEventInput): Promise<void> {
  if (!isLiveDatabase || !db) return
  try {
    const id = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await db.insert(schema.securityEvents).values({
      id,
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      targetUserId: entry.targetUserId,
      targetUserName: entry.targetUserName,
      details: entry.details ?? {},
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('Failed to record security event:', err)
  }
}

