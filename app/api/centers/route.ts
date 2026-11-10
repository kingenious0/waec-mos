import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ centers: [], districts: [] })
    }

    const rawCenters = await db
      .select({
        id: schema.examinationCenters.id,
        name: schema.examinationCenters.centerName,
        code: schema.examinationCenters.centerCode,
        lat: schema.examinationCenters.latitude,
        lng: schema.examinationCenters.longitude,
        radius: schema.examinationCenters.geofenceRadiusMeters,
        supervisorContact: schema.examinationCenters.supervisorContact,
        districtId: schema.examinationCenters.districtId,
        districtName: schema.districts.name,
        regionName: schema.regions.name,
      })
      .from(schema.examinationCenters)
      .leftJoin(schema.districts, eq(schema.examinationCenters.districtId, schema.districts.id))
      .leftJoin(schema.regions, eq(schema.districts.regionId, schema.regions.id))

    const rawAssignments = await db
      .select({
        officerId: schema.assignments.officerId,
        centerId: schema.assignments.centerId,
        status: schema.assignments.status,
      })
      .from(schema.assignments)
      .innerJoin(schema.user, eq(schema.assignments.officerId, schema.user.id))
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
      .orderBy(desc(schema.assignments.updatedAt))

    // Count each field officer only once using their latest assignment
    const seenOfficers = new Set<string>()
    const officerAssignments: typeof rawAssignments = []
    for (const a of rawAssignments) {
      if (seenOfficers.has(a.officerId)) continue
      seenOfficers.add(a.officerId)
      officerAssignments.push(a)
    }

    const allIncidents = await db
      .select({
        centerId: schema.incidents.centerId,
        status: schema.incidents.status,
      })
      .from(schema.incidents)

    const districts = await db
      .select({
        id: schema.districts.id,
        name: schema.districts.name,
        code: schema.districts.code,
        regionId: schema.districts.regionId,
      })
      .from(schema.districts)

    const settingsRows = await db
      .select({ geofenceRadius: schema.systemSettings.geofenceRadius })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.id, 'default-ashanti'))
      .limit(1)
    const defaultRadius = parseGeofenceRadiusMeters(settingsRows[0]?.geofenceRadius)

    const centers = rawCenters.map((c) => {
      const assigned = officerAssignments.filter((a) => a.centerId === c.id)
      const onSiteCount = assigned.filter((a) => a.status === 'ON_SITE').length
      const openIncidentsCount = allIncidents.filter(
        (i) => i.centerId === c.id && !['RESOLVED', 'CLOSED'].includes(i.status)
      ).length

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        lat: Number(c.lat),
        lng: Number(c.lng),
        radius: c.radius || defaultRadius,
        depotLocked: true,
        totalMonitors: assigned.length,
        onSiteMonitors: onSiteCount,
        openIncidentsCount,
        supervisorContact: c.supervisorContact || '',
        districtId: c.districtId,
        districtName: c.districtName || 'Kumasi Metropolitan',
        regionName: c.regionName || 'Ashanti Region',
      }
    })

    return NextResponse.json({ centers, districts })
  } catch (error) {
    console.error('Failed to fetch centers:', error)
    return NextResponse.json({ error: 'Failed to fetch examination centers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 })
    }

    const body = await request.json()
    const { name, code, lat, lng, radius, districtId, supervisorContact, actorId, actorName } = body

    if (!name || !code || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Name, code, latitude, and longitude are required' }, { status: 400 })
    }

    const existing = await db
      .select({ id: schema.examinationCenters.id })
      .from(schema.examinationCenters)
      .where(eq(schema.examinationCenters.centerCode, String(code).trim()))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ error: 'An examination center with this index code already exists' }, { status: 409 })
    }

    const newCenterId = `cnt-${String(code).trim()}`

    const [created] = await db
      .insert(schema.examinationCenters)
      .values({
        id: newCenterId,
        centerName: String(name).trim(),
        centerCode: String(code).trim(),
        districtId: districtId || 'dist-kumasi-metro',
        latitude: Number(lat).toFixed(8),
        longitude: Number(lng).toFixed(8),
        geofenceRadiusMeters: Number(radius) || 150,
        supervisorContact: supervisorContact || '',
      })
      .returning()

    await recordAuditLog({
      actorId: actorId || 'usr-admin-hq',
      actorName: actorName || 'HQ Command',
      actorRole: 'ADMIN',
      action: 'CENTER_CREATED',
      entityType: 'examination_centers',
      entityId: newCenterId,
      details: {
        message: `${actorName || 'Command'} registered center ${created.centerName} (${created.centerCode}) with ${created.geofenceRadiusMeters}m geofence`,
        centerName: created.centerName,
      },
    })

    return NextResponse.json({ success: true, center: created }, { status: 201 })
  } catch (error) {
    console.error('Failed to create center:', error)
    return NextResponse.json({ error: 'Failed to create examination center' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 })
    }

    const body = await request.json()
    const { id, name, code, lat, lng, radius, districtId, supervisorContact, actorId, actorName } = body

    if (!id) {
      return NextResponse.json({ error: 'Center ID is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined && String(name).trim()) updates.centerName = String(name).trim()
    if (code !== undefined && String(code).trim()) updates.centerCode = String(code).trim()
    if (lat !== undefined && !Number.isNaN(Number(lat))) updates.latitude = Number(lat).toFixed(8)
    if (lng !== undefined && !Number.isNaN(Number(lng))) updates.longitude = Number(lng).toFixed(8)
    if (radius !== undefined && !Number.isNaN(Number(radius))) updates.geofenceRadiusMeters = Math.max(25, Number(radius))
    if (districtId !== undefined && districtId) updates.districtId = districtId
    if (supervisorContact !== undefined) updates.supervisorContact = supervisorContact

    const [updated] = await db
      .update(schema.examinationCenters)
      .set(updates)
      .where(eq(schema.examinationCenters.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Examination center not found' }, { status: 404 })
    }

    await recordAuditLog({
      actorId: actorId || 'usr-admin-hq',
      actorName: actorName || 'HQ Command',
      actorRole: 'ADMIN',
      action: 'CENTER_UPDATED',
      entityType: 'examination_centers',
      entityId: id,
      details: {
        message: `${actorName || 'Command'} updated geofence for ${updated.centerName} (${updated.geofenceRadiusMeters}m radius)`,
        centerName: updated.centerName,
      },
    })

    return NextResponse.json({ success: true, center: updated })
  } catch (error) {
    console.error('Failed to update center:', error)
    return NextResponse.json({ error: 'Failed to update examination center' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const actorId = searchParams.get('actorId') || 'usr-admin-hq'
    const actorName = searchParams.get('actorName') || 'HQ Command'

    if (!id) {
      return NextResponse.json({ error: 'Center ID is required' }, { status: 400 })
    }

    const existing = await db
      .select({
        id: schema.examinationCenters.id,
        name: schema.examinationCenters.centerName,
        code: schema.examinationCenters.centerCode,
      })
      .from(schema.examinationCenters)
      .where(eq(schema.examinationCenters.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Examination center not found' }, { status: 404 })
    }

    const center = existing[0]

    // 1. Remove assignments associated with this center
    await db.delete(schema.assignments).where(eq(schema.assignments.centerId, id))

    // 2. Unlink any incidents linked to this center
    await db.update(schema.incidents).set({ centerId: null }).where(eq(schema.incidents.centerId, id))

    // 3. Delete the examination center record
    await db.delete(schema.examinationCenters).where(eq(schema.examinationCenters.id, id))

    await recordAuditLog({
      actorId,
      actorName,
      actorRole: 'ADMIN',
      action: 'CENTER_DELETED',
      entityType: 'examination_centers',
      entityId: id,
      details: {
        message: `${actorName} decommissioned examination center ${center.name} (${center.code})`,
        centerName: center.name,
        centerCode: center.code,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Center ${center.name} decommissioned successfully`,
    })
  } catch (error) {
    console.error('Failed to delete center:', error)
    return NextResponse.json({ error: 'Failed to delete examination center' }, { status: 500 })
  }
}

