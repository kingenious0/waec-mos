/**
 * Emergency SMS fan-out.
 *
 * When an officer raises an SOS, the console is not enough: the people who can
 * actually do something in that region get a text message. Best-effort by
 * design — a failed SMS must never fail the SOS itself, so every error is
 * swallowed and logged.
 */

import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { and, inArray, eq } from 'drizzle-orm'
import { sendSms } from '@/lib/sms'

const CONTROLLER_ROLES = ['REGIONAL_COORD', 'SUPERVISOR']
const FALLBACK_ROLES = ['ADMIN', 'SUPER_ADMIN']

/** Hard cap so one alert can never fan out to an unbounded list. */
const MAX_RECIPIENTS = 6

export interface RegionAlertInput {
  /** Region the emergency happened in; null falls back to command roles. */
  regionId: string | null
  officerName: string
  centerName: string
  incidentNumber: string
}

/**
 * Text every controller responsible for a region. Returns how many messages
 * were handed to the gateway (0 in development log mode still counts as a
 * delivery attempt — see lib/sms).
 */
export async function notifyRegionControllers(input: RegionAlertInput): Promise<number> {
  if (!isLiveDatabase || !db) return 0

  try {
    const recipients: { id: string; name: string; phone: string | null }[] = []

    if (input.regionId) {
      const regional = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          phone: schema.user.phone,
        })
        .from(schema.user)
        .where(
          and(
            inArray(schema.user.role, CONTROLLER_ROLES),
            eq(schema.user.regionId, input.regionId)
          )
        )
      recipients.push(...regional)
    }

    if (recipients.length === 0) {
      const fallback = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          phone: schema.user.phone,
        })
        .from(schema.user)
        .where(inArray(schema.user.role, FALLBACK_ROLES))
      recipients.push(...fallback)
    }

    const targets = recipients.filter((r) => r.phone).slice(0, MAX_RECIPIENTS)
    if (targets.length === 0) return 0

    const message =
      `WAEC MOS EMERGENCY: ${input.officerName} raised an SOS at ` +
      `${input.centerName}. Incident ${input.incidentNumber}. ` +
      `Open the command console now.`

    let sent = 0
    for (const target of targets) {
      if (!target.phone) continue
      const result = await sendSms(target.phone, message)
      if (result.ok) sent += 1
      else console.error(`SOS SMS failed for ${target.name}:`, result.error)
    }
    return sent
  } catch (error) {
    // The SOS is already recorded — never let the text blast break it.
    console.error('notifyRegionControllers failed:', error)
    return 0
  }
}
