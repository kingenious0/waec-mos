/**
 * Field operations helper tests.
 *
 * These are the pure rules behind the P4 exception panel and the group-leader
 * attendance flow: distance maths, impossible-movement detection, fixed
 * attendance reasons, and the plain-language exceptions HQ sees.
 */
import { describe, it, expect } from 'vitest'
import {
  haversineMeters,
  impliedSpeedKmh,
  isImpossibleMovement,
  IMPOSSIBLE_SPEED_KMH,
} from '@/lib/field/geo'
import {
  clockToMinutes,
  evaluateOfficerDay,
  formatGmtTime,
  minutesOfDay,
  summarizeArrivals,
  UNCONFIRMED_GRACE_MS,
  type OfficerDayInput,
} from '@/lib/field/exceptions'
import { PRESENT_REASONS, isPresentReason } from '@/lib/field/present-reasons'
import { PROOF_REQUEST_REASONS, isProofRequestReason } from '@/lib/field/proof-reasons'
import { resolveEventMs, shouldRetryArrivalDelivery } from '@/lib/field/event-time'
import { roleKind } from '@/lib/auth/guard'

const baseDay = (overrides: Partial<OfficerDayInput> = {}): OfficerDayInput => ({
  officerName: 'Elliot',
  arrivalAtMs: null,
  arrivalConfirmed: false,
  departureAtMs: null,
  plannedSchool: 'Prempeh College',
  arrivalSchool: 'Prempeh College',
  nowMs: Date.parse('2026-11-21T12:00:00Z'),
  lastPaperEndMinutes: null,
  impossibleSpeedKmh: null,
  ...overrides,
})

describe('field geo maths', () => {
  it('measures a real Ghana journey in metres', () => {
    // Accra → Kumasi is roughly 205 km by great-circle distance.
    const meters = haversineMeters(5.6037, -0.187, 6.6885, -1.6244)
    expect(meters).toBeGreaterThan(195_000)
    expect(meters).toBeLessThan(215_000)
  })

  it('returns zero for the same point', () => {
    expect(haversineMeters(6.6885, -1.6244, 6.6885, -1.6244)).toBeCloseTo(0, 5)
  })

  it('ignores GPS noise inside 15 seconds', () => {
    expect(
      impliedSpeedKmh(
        { lat: 0, lng: 0, atMs: 0 },
        { lat: 0, lng: 0.09, atMs: 10_000 }
      )
    ).toBeNull()
  })

  it('flags a phone that teleports faster than any vehicle', () => {
    const a = { lat: 6.6885, lng: -1.6244, atMs: 0 }
    const b = { lat: 6.6885, lng: -1.5244, atMs: 180_000 } // ~10 km in 3 min
    expect(IMPOSSIBLE_SPEED_KMH).toBe(150)
    expect(isImpossibleMovement(a, b)?.speedKmh).toBeGreaterThan(150)
  })

  it('does not flag a normal drive between two centres', () => {
    const a = { lat: 6.6885, lng: -1.6244, atMs: 0 }
    const b = { lat: 6.6885, lng: -1.6244 + 0.05, atMs: 600_000 } // ~5 km in 10 min
    expect(isImpossibleMovement(a, b)).toBeNull()
  })
})

describe('fixed leader reasons', () => {
  it('accepts only the shared reasons', () => {
    expect(PRESENT_REASONS).toContain('Phone battery dead')
    expect(isPresentReason('No network signal')).toBe(true)
    expect(isPresentReason('trust me bro')).toBe(false)
  })
})

describe('clock helpers', () => {
  it('parses and formats GMT clock times', () => {
    expect(clockToMinutes('08:30')).toBe(510)
    expect(clockToMinutes('25:99')).toBeNull()
    expect(clockToMinutes(null)).toBeNull()
    expect(minutesOfDay(Date.parse('2026-11-21T07:58:00Z'))).toBe(478)
    expect(formatGmtTime(Date.parse('2026-11-21T07:58:00Z'))).toBe('07:58')
  })
})

describe('HQ day exceptions', () => {
  it('flags an arrival nobody confirmed within ten minutes', () => {
    const arrivalAtMs = Date.parse('2026-11-21T07:50:00Z')
    const result = evaluateOfficerDay(
      baseDay({ arrivalAtMs, nowMs: arrivalAtMs + UNCONFIRMED_GRACE_MS })
    )
    expect(result.map((e) => e.kind)).toEqual(['unconfirmed_arrival'])
    expect(result[0].message).toContain('still not confirmed')
  })

  it('stays quiet once the officer confirms', () => {
    const arrivalAtMs = Date.parse('2026-11-21T07:50:00Z')
    expect(
      evaluateOfficerDay(
        baseDay({ arrivalAtMs, arrivalConfirmed: true, nowMs: arrivalAtMs + 60 * 60_000 })
      )
    ).toEqual([])
  })

  it('flags a planned-versus-actual school mismatch', () => {
    const result = evaluateOfficerDay(
      baseDay({ hasPlan: true, arrivalSchool: 'University of Skills Training', arrivalAtMs: Date.parse('2026-11-21T07:50:00Z'), arrivalConfirmed: true })
    )
    expect(result.map((e) => e.kind)).toEqual(['planned_vs_actual'])
    expect(result[0].message).toContain('planned Prempeh College')
  })

  it('does not call a wrong centre an exception when HQ never made a plan', () => {
    const result = evaluateOfficerDay(
      baseDay({
        hasPlan: false,
        arrivalSchool: 'University of Skills Training',
        arrivalAtMs: Date.parse('2026-11-21T07:50:00Z'),
        arrivalConfirmed: true,
      })
    )
    expect(result).toEqual([])
  })

  it('flags a missing departure only after the papers and grace period are over', () => {
    const arrivalAtMs = Date.parse('2026-11-21T07:50:00Z')
    const officer = baseDay({ arrivalAtMs, arrivalConfirmed: true, lastPaperEndMinutes: 11 * 60 })
    // 17:14 — papers ended at 11:00, 15-minute grace not yet up.
    expect(evaluateOfficerDay({ ...officer, nowMs: Date.parse('2026-11-21T11:14:00Z') })).toEqual([])
    // 17:16 — grace is up.
    const late = evaluateOfficerDay({ ...officer, nowMs: Date.parse('2026-11-21T11:16:00Z') })
    expect(late.map((e) => e.kind)).toEqual(['departure_missing'])
  })

  it('reports a teleported phone as critical', () => {
    const result = evaluateOfficerDay(baseDay({ impossibleSpeedKmh: 412 }))
    expect(result[0]).toMatchObject({ kind: 'impossible_movement', tone: 'critical' })
    expect(result[0].message).toContain('412 km/h')
  })
})

describe('role classification', () => {
  it('lets every command role see evidence and ask for proof', () => {
    expect(roleKind('SUPER_ADMIN')).toBe('admin')
    expect(roleKind('ADMIN')).toBe('admin')
    expect(roleKind('REGIONAL_COORD')).toBe('controller')
    expect(roleKind('SUPERVISOR')).toBe('controller')
  })

  it('keeps field officers in their own lane', () => {
    expect(roleKind('FIELD_OFFICER')).toBe('officer')
    expect(roleKind('')).toBe('officer')
  })
})

describe('rare proof requests', () => {
  it('keeps the reason list short and fixed', () => {
    expect(PROOF_REQUEST_REASONS).toHaveLength(3)
    expect(isProofRequestReason(PROOF_REQUEST_REASONS[0])).toBe(true)
    expect(isProofRequestReason('send me anything')).toBe(false)
  })
})

describe('dual event clocks', () => {
  const server = '2026-11-21T07:58:00.000Z'
  const phone = '2026-11-21T07:50:00.000Z'

  it('uses server time for ordering when both clocks exist', () => {
    expect(resolveEventMs(server, phone)).toBe(Date.parse(server))
  })

  it('falls back to the device time when the connection delayed the event', () => {
    expect(resolveEventMs(null, phone)).toBe(Date.parse(phone))
    expect(resolveEventMs('', phone)).toBe(Date.parse(phone))
  })

  it('survives an empty or corrupt pair', () => {
    expect(resolveEventMs(null, null)).toBeNull()
    expect(resolveEventMs('not-a-date', 'also-bad')).toBeNull()
  })
})

describe('offline arrival queue', () => {
  it('drops bad payloads but keeps auth, timeout and server failures', () => {
    expect(shouldRetryArrivalDelivery(400)).toBe(false)
    expect(shouldRetryArrivalDelivery(422)).toBe(false)
    expect(shouldRetryArrivalDelivery(401)).toBe(true)
    expect(shouldRetryArrivalDelivery(408)).toBe(true)
    expect(shouldRetryArrivalDelivery(429)).toBe(true)
    expect(shouldRetryArrivalDelivery(500)).toBe(true)
  })
})

describe('arrivals summary', () => {
  it('counts confirmed and unconfirmed arrivals without going negative', () => {
    expect(summarizeArrivals({ assigned: 8, arrived: 5, confirmed: 3 })).toEqual({
      assigned: 8,
      arrived: 5,
      confirmed: 3,
      unconfirmed: 2,
      enRoute: 3,
    })
    expect(summarizeArrivals({ assigned: 8, arrived: 20, confirmed: 20 })).toEqual({
      assigned: 8,
      arrived: 8,
      confirmed: 8,
      unconfirmed: 0,
      enRoute: 0,
    })
  })
})
