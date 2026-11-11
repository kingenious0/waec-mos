import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { desc, eq } from 'drizzle-orm'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Resolve a center's district without being limited to a hardcoded list:
 * 1. use the given districtId when it exists,
 * 2. else match an existing district by name (exact, then loose),
 * 3. else auto-create the district — and its region from the geocoded
 *    address — so admins only ever review the auto-filled name.
 */
async function resolveDistrictId(opts: {
  districtId?: string
  districtName?: string
  regionName?: string
}): Promise<string> {
  if (!db) throw new Error('Database not connected')
  const { districtId, districtName, regionName } = opts

  const allDistricts = await db.select().from(schema.districts)
  const trimmedId = (districtId || '').trim()
  if (trimmedId && allDistricts.some((d) => d.id === trimmedId)) return trimmedId

  const name = (districtName || '').trim()
  if (!name) return 'dist-kumasi-metro'
  const target = normName(name)

  const exact = allDistricts.find((d) => normName(d.name) === target)
  if (exact) return exact.id
  const loose = allDistricts.find(
    (d) => normName(d.name).includes(target) || target.includes(normName(d.name))
  )
  if (loose) return loose.id

  // Unknown district → make sure the region exists first
  const regName = (regionName || 'Ashanti Region').trim()
  const allRegions = await db.select().from(schema.regions)
  const regTarget = normName(regName)
  let region =
    allRegions.find((r) => normName(r.name) === regTarget) ||
    allRegions.find(
      (r) => normName(r.name).includes(regTarget) || regTarget.includes(normName(r.name))
    )

  if (!region) {
    let base =
      regName
        .replace(/[^A-Za-z ]/g, '')
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase() || 'GH'
    let code = base
    let suffix = 2
    while (allRegions.some((r) => r.code === code)) {
      code = `${base}${suffix}`
      suffix += 1
    }
    let regionId = `reg-${slugify(regName)}`
    let idSuffix = 2
    while (allRegions.some((r) => r.id === regionId)) {
      regionId = `reg-${slugify(regName)}-${idSuffix}`
      idSuffix += 1
    }
    const [createdRegion] = await db
      .insert(schema.regions)
      .values({ id: regionId, name: regName, code })
      .returning()
    region = createdRegion
  }

  // Finally create the district itself
  let newDistrictId = `dist-${slugify(name)}`
  let idSuffix = 2
  while (allDistricts.some((d) => d.id === newDistrictId)) {
    newDistrictId = `dist-${slugify(name)}-${idSuffix}`
    idSuffix += 1
  }
  const codeBase = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DST'
  let code = codeBase
  let codeSuffix = 2
  while (allDistricts.some((d) => d.code === code)) {
    code = `${codeBase}${codeSuffix}`
    codeSuffix += 1
  }

  await db
    .insert(schema.districts)
    .values({ id: newDistrictId, regionId: region.id, name, code })

  return newDistrictId
}

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
    const { name, code, lat, lng, radius, districtId, districtName, regionName, supervisorContact, actorId, actorName } = body

    if (!name || !code || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Name, code, latitude, and longitude are required' }, { status: 400 })
    }

    const resolvedDistrictId = await resolveDistrictId({ districtId, districtName, regionName })

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
        districtId: resolvedDistrictId,
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
    const { id, name, code, lat, lng, radius, districtId, districtName, regionName, supervisorContact, actorId, actorName } = body

    if (!id) {
      return NextResponse.json({ error: 'Center ID is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined && String(name).trim()) updates.centerName = String(name).trim()
    if (code !== undefined && String(code).trim()) updates.centerCode = String(code).trim()
    if (lat !== undefined && !Number.isNaN(Number(lat))) updates.latitude = Number(lat).toFixed(8)
    if (lng !== undefined && !Number.isNaN(Number(lng))) updates.longitude = Number(lng).toFixed(8)
    if (radius !== undefined && !Number.isNaN(Number(radius))) updates.geofenceRadiusMeters = Math.max(25, Number(radius))
    if ((districtId && String(districtId).trim()) || (districtName && String(districtName).trim())) {
      updates.districtId = await resolveDistrictId({
        districtId: districtId ? String(districtId) : undefined,
        districtName,
        regionName,
      })
    }
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

