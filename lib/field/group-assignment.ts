/**
 * Pure rules for the group → region → school workflow.
 *
 * WAEC field groups are stored in `field_groups` with a real id, while officers
 * carry the human-readable group name. These helpers keep the two consistent
 * and let two regions safely use a familiar name like "Group 1" without one
 * group stealing another group's daily school plan.
 */

export interface GroupIdentity {
  id: string
  name: string
  regionId?: string | null
}

export interface OfficerGroupMembership {
  id: string
  groupName?: string | null
  regionId?: string | null
}

export function normalizeGroupName(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isSameGroupName(a?: string | null, b?: string | null): boolean {
  const left = normalizeGroupName(a)
  const right = normalizeGroupName(b)
  return left.length > 0 && left === right
}

/**
 * Officers carry the human group name, while groups carry a real region id.
 * Both must agree before an officer may receive that group's school plan —
 * otherwise two regions with a "Group 1" would share each other's officers.
 */
export function officerBelongsToGroup(
  officer: OfficerGroupMembership,
  group: GroupIdentity
): boolean {
  if (!isSameGroupName(officer.groupName, group.name)) return false
  if (officer.regionId && group.regionId && officer.regionId !== group.regionId) return false
  return true
}

export function filterGroupOfficers<T extends OfficerGroupMembership>(
  officers: T[],
  group: GroupIdentity,
  officerId?: string | null
): T[] {
  return officers.filter(
    (officer) =>
      officerBelongsToGroup(officer, group) && (!officerId || officer.id === officerId)
  )
}

/** YYYY-MM-DD, GMT — the same date key used by the daily school plan. */
export function isValidAssignmentDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function todayGmt(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Resolve the officer's group name (plus their posting region) to the actual
 * field_groups.id. Region is the tie-breaker when two groups share a name.
 */
export function chooseGroupId(
  groups: GroupIdentity[],
  groupName?: string | null,
  regionId?: string | null
): string | null {
  const wanted = normalizeGroupName(groupName)
  if (!wanted) return null

  const matches = groups.filter((g) => normalizeGroupName(g.name) === wanted)
  if (matches.length === 0) return null

  if (regionId) {
    const inRegion = matches.find((g) => g.regionId === regionId)
    if (inRegion) return inRegion.id
  }

  return matches[0]?.id || null
}
