import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-utils'
import { desc, eq, ne, and } from 'drizzle-orm'

export interface LiveNotificationItem {
  id: string
  sourceType: 'incident' | 'audit'
  sourceId: string
  category: 'sos' | 'geofence' | 'device' | 'checkin'
  type: 'critical' | 'warning' | 'success'
  title: string
  subtitle: string
  time: string
  read: boolean
  officerId?: string
  officerName?: string
  centerName?: string
  battery?: string
}

export async function GET() {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        settings: DEFAULT_SYSTEM_SETTINGS,
      })
    }

    const settingsRows = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.id, 'default-ashanti'))
      .limit(1)
    const settings = settingsRows[0] || DEFAULT_SYSTEM_SETTINGS

    // 1. Fetch open incidents (especially SOS / Critical alerts)
    const openIncidents = await db
      .select({
        id: schema.incidents.id,
        incidentNumber: schema.incidents.incidentNumber,
        title: schema.incidents.title,
        category: schema.incidents.category,
        severity: schema.incidents.severity,
        status: schema.incidents.status,
        reportedAt: schema.incidents.reportedAt,
        isRead: schema.incidents.isRead,
        reportedBy: schema.incidents.reportedBy,
        reporterName: schema.user.name,
        reporterBattery: schema.user.lastBattery,
        centerName: schema.examinationCenters.centerName,
      })
      .from(schema.incidents)
      .leftJoin(schema.user, eq(schema.incidents.reportedBy, schema.user.id))
      .leftJoin(schema.examinationCenters, eq(schema.incidents.centerId, schema.examinationCenters.id))
      .where(
        and(
          ne(schema.incidents.status, 'RESOLVED'),
          ne(schema.incidents.status, 'CLOSED')
        )
      )
      .orderBy(desc(schema.incidents.reportedAt))
      .limit(20)

    const items: LiveNotificationItem[] = []
    const activeSosReporterIds = new Set<string>()

    for (const inc of openIncidents) {
      const isSos = inc.severity === 'CRITICAL' || inc.category === 'SOS'
      if (isSos && inc.reportedBy) activeSosReporterIds.add(inc.reportedBy)

      const timeStr = inc.reportedAt
        ? new Date(inc.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
        : ''
      const batteryStr = inc.reporterBattery !== null && inc.reporterBattery !== undefined ? `${inc.reporterBattery}%` : undefined

      items.push({
        id: `inc-${inc.id}`,
        sourceType: 'incident',
        sourceId: inc.id,
        category: isSos ? 'sos' : 'geofence',
        type: isSos ? 'critical' : 'warning',
        title: isSos
          ? `${inc.reporterName || 'Field Officer'} triggered an SOS`
          : inc.title,
        subtitle: [inc.centerName || 'Regional Command', batteryStr ? `battery ${batteryStr}` : null]
          .filter(Boolean)
          .join(' · '),
        time: timeStr,
        read: Boolean(inc.isRead),
        officerId: inc.reportedBy,
        officerName: inc.reporterName || undefined,
        centerName: inc.centerName || undefined,
        battery: batteryStr,
      })
    }

    // 2. Fetch recent operational audit logs
    const recentLogs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(25)

    for (const log of recentLogs) {
      // Avoid duplicating active SOS card
      if (log.action === 'SOS_TRIGGERED' && activeSosReporterIds.has(log.actorId)) {
        continue
      }

      const details = (log.details as Record<string, any>) || {}
      const timeStr = log.createdAt
        ? new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : ''

      if (log.action === 'LOW_BATTERY_ALERT') {
        items.push({
          id: `aud-${log.id}`,
          sourceType: 'audit',
          sourceId: log.id,
          category: 'device',
          type: 'warning',
          title: 'Low battery',
          subtitle: details.message || `${log.actorName} device battery low`,
          time: timeStr,
          read: Boolean(log.isRead),
          officerId: log.actorId,
          officerName: log.actorName,
        })
      } else if (log.action === 'GEOFENCE_BREACH') {
        items.push({
          id: `aud-${log.id}`,
          sourceType: 'audit',
          sourceId: log.id,
          category: 'geofence',
          type: 'warning',
          title: 'Outside geofence',
          subtitle: details.message || `${log.actorName} outside perimeter`,
          time: timeStr,
          read: Boolean(log.isRead),
          officerId: log.actorId,
          officerName: log.actorName,
          centerName: details.centerName,
        })
      } else if (log.action === 'CHECK_IN_LOGGED') {
        items.push({
          id: `aud-${log.id}`,
          sourceType: 'audit',
          sourceId: log.id,
          category: 'checkin',
          type: 'success',
          title: 'Verified on site',
          subtitle: details.message || `${log.actorName} checked in at ${details.centerName || 'center'}`,
          time: timeStr,
          read: Boolean(log.isRead),
          officerId: log.actorId,
          officerName: log.actorName,
          centerName: details.centerName,
        })
      } else if (
        ['CHECK_OUT_LOGGED', 'PIN_RESET_REQUESTED', 'SOS_STAND_DOWN', 'USER_REVOKED', 'USER_RESTORED'].includes(
          log.action
        )
      ) {
        const labelMap: Record<string, { title: string; cat: 'device' | 'checkin' | 'geofence'; type: 'warning' | 'success' }> = {
          CHECK_OUT_LOGGED: { title: 'Shift concluded', cat: 'checkin', type: 'success' },
          PIN_RESET_REQUESTED: { title: 'PIN reset requested', cat: 'device', type: 'warning' },
          SOS_STAND_DOWN: { title: 'SOS alert stood down', cat: 'checkin', type: 'success' },
          USER_REVOKED: { title: 'Access revoked', cat: 'device', type: 'warning' },
          USER_RESTORED: { title: 'Access restored', cat: 'checkin', type: 'success' },
        }
        const meta = labelMap[log.action]
        items.push({
          id: `aud-${log.id}`,
          sourceType: 'audit',
          sourceId: log.id,
          category: meta.cat,
          type: meta.type,
          title: meta.title,
          subtitle: details.message || log.actorName,
          time: timeStr,
          read: Boolean(log.isRead),
          officerId: log.actorId,
          officerName: log.actorName,
        })
      }
    }

    const unreadCount = items.filter((n) => !n.read).length

    return NextResponse.json({
      notifications: items,
      unreadCount,
      settings,
    })
  } catch (error) {
    console.error('Failed to load live notifications:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, sourceType, sourceId } = body

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true })
    }

    if (action === 'MARK_ALL_READ') {
      await db.update(schema.incidents).set({ isRead: true })
      await db.update(schema.auditLogs).set({ isRead: true })
      return NextResponse.json({ success: true })
    }

    if (sourceType === 'incident' && sourceId) {
      await db.update(schema.incidents).set({ isRead: true }).where(eq(schema.incidents.id, sourceId))
    } else if (sourceType === 'audit' && sourceId) {
      await db.update(schema.auditLogs).set({ isRead: true }).where(eq(schema.auditLogs.id, sourceId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to mark notifications read:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

