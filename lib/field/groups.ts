/**
 * Server-side group lookup shared by duty, day-plan and admin routes.
 * Never trust a user-supplied group id: resolve it from the officer's own
 * group name and posting region, then use the canonical field_groups.id.
 */

import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { chooseGroupId, normalizeGroupName } from './group-assignment'

export interface OfficerGroup {
  id: string
  name: string
  regionName: string | null
}

async function loadGroupIdentities() {
  if (!isLiveDatabase || !db) return []
  return db
    .select({
      id: schema.fieldGroups.id,
      name: schema.fieldGroups.name,
      regionId: schema.fieldGroups.regionId,
    })
    .from(schema.fieldGroups)
}

/** Resolve a human group name to the canonical group row. */
export async function resolveGroupId(
  groupName?: string | null,
  regionId?: string | null
): Promise<string | null> {
  if (!normalizeGroupName(groupName)) return null
  const groups = await loadGroupIdentities()
  return chooseGroupId(groups, groupName, regionId)
}

/** The group an officer actually belongs to, with its region — or null. */
export async function loadOfficerGroup(officerId: string): Promise<OfficerGroup | null> {
  if (!isLiveDatabase || !db) return null

  const officerRows = await db
    .select({
      groupName: schema.user.groupName,
      regionId: schema.user.regionId,
    })
    .from(schema.user)
    .where(eq(schema.user.id, officerId))
    .limit(1)

  const officer = officerRows[0]
  const groupId = await resolveGroupId(officer?.groupName, officer?.regionId)
  if (!groupId) return null

  const groupRows = await db
    .select({
      id: schema.fieldGroups.id,
      name: schema.fieldGroups.name,
      regionName: schema.regions.name,
    })
    .from(schema.fieldGroups)
    .leftJoin(schema.regions, eq(schema.regions.id, schema.fieldGroups.regionId))
    .where(eq(schema.fieldGroups.id, groupId))
    .limit(1)

  return groupRows[0] || null
}

/** Case-insensitive duplicate check used when creating/renaming admin groups. */
export async function findGroupByNameAndRegion(
  name: string,
  regionId: string
): Promise<string | null> {
  if (!isLiveDatabase || !db) return null
  const rows = await db
    .select({ id: schema.fieldGroups.id })
    .from(schema.fieldGroups)
    .where(
      sql`${schema.fieldGroups.regionId} = ${regionId} AND lower(${schema.fieldGroups.name}) = lower(${name})`
    )
    .limit(1)
  return rows[0]?.id || null
}
