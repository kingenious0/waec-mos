/**
 * Who may act on whose duty.
 *
 * A group leader sets schools and marks attendance for the officers in their
 * own group — nobody else's. Command roles (HQ, controllers) can act on anyone.
 * One rule, used by the day-plan API, the arrival API and anything else that
 * writes to another officer's record.
 */

import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { roleKind } from '@/lib/auth/guard'

export interface ActingUser {
  id: string
  role: string
}

export async function canActOnOfficer(
  caller: ActingUser,
  targetOfficerId: string
): Promise<boolean> {
  // Acting on yourself is always fine.
  if (targetOfficerId === caller.id) return true
  if (roleKind(caller.role) !== 'officer') return true

  if (!db) return false

  const rows = await db
    .select({
      id: schema.user.id,
      isGroupLeader: schema.user.isGroupLeader,
      groupName: schema.user.groupName,
    })
    .from(schema.user)
    .where(and(eq(schema.user.id, caller.id)))
    .limit(1)
  const me = rows[0]
  if (!me?.isGroupLeader || !me.groupName) return false

  const targets = await db
    .select({ groupName: schema.user.groupName })
    .from(schema.user)
    .where(eq(schema.user.id, targetOfficerId))
    .limit(1)

  return Boolean(targets[0]?.groupName) && targets[0].groupName === me.groupName
}
