import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET() {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ centers: [] })
    }

    // Fetch centers joined with assignment counts
    const rawCenters = await db
      .select({
        id: schema.examinationCenters.id,
        name: schema.examinationCenters.centerName,
        code: schema.examinationCenters.centerCode,
        lat: schema.examinationCenters.latitude,
        lng: schema.examinationCenters.longitude,
        radius: schema.examinationCenters.geofenceRadiusMeters,
        supervisorContact: schema.examinationCenters.supervisorContact,
        totalMonitors: sql<number>`count(${schema.assignments.id})::int`,
      })
      .from(schema.examinationCenters)
      .leftJoin(
        schema.assignments,
        eq(schema.examinationCenters.id, schema.assignments.centerId)
      )
      .groupBy(schema.examinationCenters.id)

    const centers = rawCenters.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      lat: Number(c.lat),
      lng: Number(c.lng),
      radius: c.radius || 150,
      depotLocked: true,
      totalMonitors: Math.max(Number(c.totalMonitors) || 0, 1),
      supervisorContact: c.supervisorContact || '',
    }))

    return NextResponse.json({ centers })
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
    const { name, code, lat, lng, radius, districtId, supervisorContact } = body

    if (!name || !code || !lat || !lng) {
      return NextResponse.json({ error: 'Name, code, latitude, and longitude are required' }, { status: 400 })
    }

    const newCenterId = `cnt-${code || Date.now()}`

    const [created] = await db
      .insert(schema.examinationCenters)
      .values({
        id: newCenterId,
        centerName: name,
        centerCode: code,
        districtId: districtId || 'dist-kumasi-metro',
        latitude: String(lat),
        longitude: String(lng),
        geofenceRadiusMeters: Number(radius) || 150,
        supervisorContact: supervisorContact || '',
      })
      .returning()

    return NextResponse.json({ success: true, center: created }, { status: 201 })
  } catch (error) {
    console.error('Failed to create center:', error)
    return NextResponse.json({ error: 'Failed to create examination center' }, { status: 500 })
  }
}
