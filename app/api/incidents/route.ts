import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { verifyPin } from '@/lib/auth/pin'
import { requireCommand, requireUser, getServerUser, roleKind } from '@/lib/auth/guard'
import { incidentCreateSchema } from '@/lib/validation-schemas'
import { and, desc, eq, ne, or } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({
        incidents: [],
        auditLogs: [],
        summary: {
          activeSosCount: 0,
          openIncidentsCount: 0,
          totalIncidents: 0,
          breachCount: 0,
        },
      })
    }

    const rawIncidents = await db
      .select({
        id: schema.incidents.id,
        incidentNumber: schema.incidents.incidentNumber,
        title: schema.incidents.title,
        category: schema.incidents.category,
        severity: schema.incidents.severity,
        status: schema.incidents.status,
        description: schema.incidents.description,
        resolutionNotes: schema.incidents.resolutionNotes,
        reportedAt: schema.incidents.reportedAt,
        resolvedAt: schema.incidents.resolvedAt,
        isRead: schema.incidents.isRead,
        reportedBy: schema.incidents.reportedBy,
        reporterName: schema.user.name,
        reporterPhone: schema.user.phone,
        reporterStaffId: schema.user.staffId,
        reporterBattery: schema.user.lastBattery,
        reporterLat: schema.user.lastLatitude,
        reporterLng: schema.user.lastLongitude,
        reporterDistance: schema.user.lastDistanceMeters,
        centerId: schema.incidents.centerId,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
      })
      .from(schema.incidents)
      .leftJoin(schema.user, eq(schema.incidents.reportedBy, schema.user.id))
      .leftJoin(schema.examinationCenters, eq(schema.incidents.centerId, schema.examinationCenters.id))
      .orderBy(desc(schema.incidents.reportedAt))

    const updates = await db
      .select({
        id: schema.incidentUpdates.id,
        incidentId: schema.incidentUpdates.incidentId,
        actorName: schema.user.name,
        comment: schema.incidentUpdates.comment,
        previousStatus: schema.incidentUpdates.previousStatus,
        newStatus: schema.incidentUpdates.newStatus,
        createdAt: schema.incidentUpdates.createdAt,
      })
      .from(schema.incidentUpdates)
      .leftJoin(schema.user, eq(schema.incidentUpdates.actorId, schema.user.id))
      .orderBy(desc(schema.incidentUpdates.createdAt))

    const updatesByIncident: Record<string, any[]> = {}
    for (const u of updates) {
      if (!updatesByIncident[u.incidentId]) updatesByIncident[u.incidentId] = []
      updatesByIncident[u.incidentId].push({
        ...u,
        timeFormatted: u.createdAt
          ? new Date(u.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
          : '',
      })
    }

    const rawAuditLogs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(50)

    const incidents = rawIncidents.map((inc) => ({
      id: inc.id,
      incidentNumber: inc.incidentNumber,
      title: inc.title,
      category: inc.category,
      severity: inc.severity,
      status: inc.status,
      description: inc.description,
      resolutionNotes: inc.resolutionNotes || '',
      reportedAt: inc.reportedAt ? new Date(inc.reportedAt).toISOString() : null,
      reportedTimeFormatted: inc.reportedAt
        ? new Date(inc.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
        : '',
      resolvedAt: inc.resolvedAt ? new Date(inc.resolvedAt).toISOString() : null,
      isRead: inc.isRead,
      reportedBy: inc.reportedBy,
      reporterName: inc.reporterName || 'System',
      reporterPhone: inc.reporterPhone || '',
      reporterStaffId: inc.reporterStaffId || '',
      reporterBattery: inc.reporterBattery,
      reporterLat: inc.reporterLat ? Number(inc.reporterLat) : null,
      reporterLng: inc.reporterLng ? Number(inc.reporterLng) : null,
      reporterDistance: inc.reporterDistance,
      centerId: inc.centerId,
      centerName: inc.centerName || 'Regional Command',
      centerCode: inc.centerCode || '',
      updates: updatesByIncident[inc.id] || [],
    }))

    const auditLogs = rawAuditLogs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: (log.details as Record<string, any>) || {},
      isRead: log.isRead,
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : null,
      timeFormatted: log.createdAt
        ? new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
        : '',
    }))

    const unresolved = incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status))
    const activeSosCount = unresolved.filter(
      (i) => i.severity === 'CRITICAL' || i.category === 'SOS'
    ).length
    const breachCount = rawAuditLogs.filter((l) => l.action === 'GEOFENCE_BREACH').length

    return NextResponse.json({
      incidents,
      auditLogs,
      summary: {
        activeSosCount,
        openIncidentsCount: unresolved.length,
        totalIncidents: incidents.length,
        breachCount,
      },
    })
  } catch (error) {
    console.error('Failed to fetch incidents:', error)
    return NextResponse.json({ error: 'Failed to load incidents and audit logs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireUser(request as any)
    if (gate.error) return gate.error
    const raw = await request.json()
    const parsed = incidentCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const {
      title,
      category,
      severity,
      description,
      centerId,
      centerCode,
      centerName,
      lat,
      lng,
      battery,
      distanceMeters,
      isSos,
    } = parsed.data
    // Never trust a client-supplied reporter — use the caller
    const reportedBy = gate.user.id

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true })
    }

    const reporters = await db
      .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, reportedBy))
      .limit(1)

    if (reporters.length === 0) {
      return NextResponse.json({ error: 'Reporter account not found' }, { status: 404 })
    }
    const reporter = reporters[0]

    // Resolve centerId cleanly
    let resolvedCenterId: string | null = centerId || null
    let resolvedCenterName = centerName || 'Regional Operations'

    if (!resolvedCenterId && (centerCode || centerName)) {
      const matchedCenters = await db
        .select()
        .from(schema.examinationCenters)
        .where(
          centerCode
            ? eq(schema.examinationCenters.centerCode, centerCode)
            : eq(schema.examinationCenters.centerName, centerName as string)
        )
        .limit(1)
      if (matchedCenters.length > 0) {
        resolvedCenterId = matchedCenters[0].id
        resolvedCenterName = matchedCenters[0].centerName
      }
    }

    if (!resolvedCenterId) {
      const asgRows = await db
        .select({
          centerId: schema.assignments.centerId,
          centerName: schema.examinationCenters.centerName,
        })
        .from(schema.assignments)
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .where(eq(schema.assignments.officerId, reporter.id))
        .orderBy(desc(schema.assignments.updatedAt))
        .limit(1)
      if (asgRows.length > 0) {
        resolvedCenterId = asgRows[0].centerId
        resolvedCenterName = asgRows[0].centerName || resolvedCenterName
      }
    }

    const now = new Date()
    const isEmergencySos = Boolean(isSos || severity === 'CRITICAL' || category === 'SOS')
    const effectiveSeverity = severity || (isEmergencySos ? 'CRITICAL' : 'MEDIUM')
    const effectiveCategory = category || (isEmergencySos ? 'SECURITY_THREAT' : 'OTHER')
    const prefix = isEmergencySos ? 'SOS' : 'INC'
    const incidentNumber = `WAEC-${prefix}-${now.getFullYear()}-${String(Date.now()).slice(-4)}`
    const incidentId = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const effectiveTitle =
      title?.trim() ||
      (isEmergencySos
        ? `Emergency SOS Alert — ${reporter.name} at ${resolvedCenterName}`
        : `Field Incident at ${resolvedCenterName}`)

    const [created] = await db
      .insert(schema.incidents)
      .values({
        id: incidentId,
        incidentNumber,
        title: effectiveTitle,
        category: effectiveCategory,
        severity: effectiveSeverity,
        status: 'REPORTED',
        centerId: resolvedCenterId,
        reportedBy: reporter.id,
        description: String(description).trim(),
        reportedAt: now,
        isRead: false,
        updatedAt: now,
      })
      .returning()

    await db.insert(schema.incidentUpdates).values({
      id: `incupd-${Date.now()}`,
      incidentId,
      actorId: reporter.id,
      comment: isEmergencySos ? 'Emergency SOS beacon activated from field terminal' : 'Incident logged in operations command',
      previousStatus: null,
      newStatus: 'REPORTED',
      createdAt: now,
    })

    if (isEmergencySos) {
      const userUpdates: Record<string, unknown> = {
        isSosActive: true,
        lastPingAt: now,
        updatedAt: now,
      }
      if (typeof lat === 'number') userUpdates.lastLatitude = lat.toFixed(8)
      if (typeof lng === 'number') userUpdates.lastLongitude = lng.toFixed(8)
      if (typeof battery === 'number') userUpdates.lastBattery = Math.round(battery)
      if (typeof distanceMeters === 'number') userUpdates.lastDistanceMeters = Math.round(distanceMeters)

      await db.update(schema.user).set(userUpdates).where(eq(schema.user.id, reporter.id))
    }

    await recordAuditLog({
      actorId: reporter.id,
      actorName: reporter.name,
      actorRole: reporter.role,
      action: isEmergencySos ? 'SOS_TRIGGERED' : 'INCIDENT_REPORTED',
      entityType: 'incidents',
      entityId: incidentId,
      details: {
        message: isEmergencySos
          ? `SOS triggered by ${reporter.name} at ${resolvedCenterName}`
          : `${effectiveTitle} (${incidentNumber})`,
        incidentNumber,
        centerName: resolvedCenterName,
        severity: effectiveSeverity,
        battery: typeof battery === 'number' ? Math.round(battery) : null,
        distanceMeters: typeof distanceMeters === 'number' ? Math.round(distanceMeters) : null,
      },
    })

    return NextResponse.json({ success: true, incident: created }, { status: 201 })
  } catch (error) {
    console.error('Failed to create incident:', error)
    return NextResponse.json({ error: 'Failed to create incident report' }, { status: 500 })
  }
}

async function handleUpdateIncident(request: Request) {
  const body = await request.json()
  const { action, officerId, pin, id, status, resolutionNotes } = body

  if (!isLiveDatabase || !db) {
    return NextResponse.json({ success: true })
  }

  const now = new Date()

  // 1. Field Officer PIN-verified SOS Stand Down — requires signed-in officer
  if (action === 'STAND_DOWN') {
    const caller = await getServerUser(request as any)
    if (!caller) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    }
    if (roleKind(caller.role) === 'officer' && officerId !== caller.id) {
      return NextResponse.json({ error: 'You can only stand down your own SOS.' }, { status: 403 })
    }

    const officers = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        role: schema.user.role,
        pin: schema.user.pin,
      })
      .from(schema.user)
      .where(eq(schema.user.id, officerId))
      .limit(1)

    if (officers.length === 0) {
      return NextResponse.json({ error: 'Officer not found' }, { status: 404 })
    }

    const officer = officers[0]
    const cleanPin = String(pin).trim()
    if (!officer.pin || !verifyPin(cleanPin, officer.pin)) {
      return NextResponse.json(
        { error: 'Invalid 4-digit security PIN. Emergency alert remains active.' },
        { status: 401 }
      )
    }

    const activeIncidents = await db
      .select()
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.reportedBy, officerId),
          ne(schema.incidents.status, 'RESOLVED'),
          ne(schema.incidents.status, 'CLOSED'),
          or(
            eq(schema.incidents.severity, 'CRITICAL'),
            eq(schema.incidents.category, 'SOS')
          )
        )
      )

    for (const inc of activeIncidents) {
      await db
        .update(schema.incidents)
        .set({
          status: 'RESOLVED',
          resolvedAt: now,
          resolutionNotes: 'Stood down by field officer via verified PIN',
          isRead: true,
          updatedAt: now,
        })
        .where(eq(schema.incidents.id, inc.id))

      await db.insert(schema.incidentUpdates).values({
        id: `incupd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        incidentId: inc.id,
        actorId: officer.id,
        comment: 'Emergency alert stood down by officer using verified security PIN',
        previousStatus: inc.status,
        newStatus: 'RESOLVED',
        createdAt: now,
      })
    }

    await db
      .update(schema.user)
      .set({ isSosActive: false, updatedAt: now })
      .where(eq(schema.user.id, officerId))

    await recordAuditLog({
      actorId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      action: 'SOS_STAND_DOWN',
      entityType: 'users',
      entityId: officer.id,
      details: {
        message: `${officer.name} stood down active SOS distress beacon via verified PIN`,
      },
    })

    return NextResponse.json({ success: true })
  }

  // 2. Admin status / resolution workflow update — command staff only
  const command = await requireCommand(request as any)
  if (command.error) return command.error
  const actorId = command.user.id
  const actorName = command.user.name

  if (!id || !status) {
    return NextResponse.json({ error: 'Incident id and status are required' }, { status: 400 })
  }

  const existingRows = await db
    .select()
    .from(schema.incidents)
    .where(eq(schema.incidents.id, id))
    .limit(1)

  if (existingRows.length === 0) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
  }

  const inc = existingRows[0]
  const isClosing = ['RESOLVED', 'CLOSED'].includes(status)

  await db
    .update(schema.incidents)
    .set({
      status,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : inc.resolutionNotes,
      resolvedAt: isClosing ? now : inc.resolvedAt,
      isRead: true,
      updatedAt: now,
    })
    .where(eq(schema.incidents.id, id))

  await db.insert(schema.incidentUpdates).values({
    id: `incupd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    incidentId: id,
    actorId,
    comment: resolutionNotes || `Status updated to ${status}`,
    previousStatus: inc.status,
    newStatus: status,
    createdAt: now,
  })

  // Clear officer's SOS active flag if no other critical unresolved SOS remains
  if (isClosing && inc.reportedBy) {
    const remainingSos = await db
      .select({ id: schema.incidents.id })
      .from(schema.incidents)
      .where(
        and(
          eq(schema.incidents.reportedBy, inc.reportedBy),
          ne(schema.incidents.id, id),
          ne(schema.incidents.status, 'RESOLVED'),
          ne(schema.incidents.status, 'CLOSED'),
          or(
            eq(schema.incidents.severity, 'CRITICAL'),
            eq(schema.incidents.category, 'SOS')
          )
        )
      )
      .limit(1)

    if (remainingSos.length === 0) {
      await db
        .update(schema.user)
        .set({ isSosActive: false, updatedAt: now })
        .where(eq(schema.user.id, inc.reportedBy))
    }
  }

  await recordAuditLog({
    actorId,
    actorName,
    actorRole: 'ADMIN',
    action: isClosing ? 'INCIDENT_RESOLVED' : 'INCIDENT_UPDATED',
    entityType: 'incidents',
    entityId: id,
    details: {
      message: `${actorName} marked ${inc.incidentNumber} as ${status}`,
      incidentNumber: inc.incidentNumber,
      status,
    },
  })

  return NextResponse.json({ success: true })
}

export async function PUT(request: Request) {
  try {
    return await handleUpdateIncident(request)
  } catch (error) {
    console.error('Failed to update incident (PUT):', error)
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    return await handleUpdateIncident(request)
  } catch (error) {
    console.error('Failed to update incident (PATCH):', error)
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 })
  }
}

