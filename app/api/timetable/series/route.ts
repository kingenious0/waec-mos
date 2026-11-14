import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireCommand } from '@/lib/auth/guard'
import { eq, sql, desc } from 'drizzle-orm'

/**
 * GET /api/timetable/series
 * The four published 2026 WAEC series (the same cards WAEC lists on /timetable),
 * each carrying its timetable load state. Command staff only.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })
    }

    const ops = await db.select().from(schema.operations).orderBy(schema.operations.startDate)

    // Timetable load stats per series
    const stats = await db
      .select({
        operationId: schema.examTimetable.operationId,
        papers: sql<number>`count(*)::int`,
        firstPaper: sql<string>`min(${schema.examTimetable.examDate})`,
        lastPaper: sql<string>`max(${schema.examTimetable.examDate})`,
        needsTime: sql<number>`count(*) filter (where ${schema.examTimetable.needsCouncilTime})::int`,
      })
      .from(schema.examTimetable)
      .groupBy(schema.examTimetable.operationId)
    const statMap = new Map(stats.map((s) => [s.operationId, s]))

    // Last import per series
    const lastImports = await db
      .select({
        operationId: schema.timetableImports.operationId,
        fileName: schema.timetableImports.fileName,
        sourceFormat: schema.timetableImports.sourceFormat,
        importedCount: schema.timetableImports.importedCount,
        createdAt: schema.timetableImports.createdAt,
      })
      .from(schema.timetableImports)
      .orderBy(desc(schema.timetableImports.createdAt))
    const importMap = new Map<string, (typeof lastImports)[number]>()
    for (const imp of lastImports) {
      if (!importMap.has(imp.operationId)) importMap.set(imp.operationId, imp)
    }

    const series = ops.map((op) => {
      const stat = statMap.get(op.id)
      const lastImport = importMap.get(op.id)
      return {
        id: op.id,
        name: op.name,
        seriesYear: op.seriesYear,
        status: op.status,
        startDate: op.startDate,
        endDate: op.endDate,
        papers: stat?.papers ?? 0,
        firstPaper: stat?.firstPaper ?? null,
        lastPaper: stat?.lastPaper ?? null,
        needsCouncilTime: stat?.needsTime ?? 0,
        lastImport: lastImport
          ? {
              fileName: lastImport.fileName,
              sourceFormat: lastImport.sourceFormat,
              importedCount: lastImport.importedCount,
              createdAt: lastImport.createdAt,
            }
          : null,
      }
    })

    return NextResponse.json({ series })
  } catch (err) {
    console.error('series list failed:', err)
    return NextResponse.json({ error: 'Could not load the exam series.', status: 500 }, { status: 500 })
  }
}
