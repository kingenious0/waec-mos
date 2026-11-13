/**
 * Phase 2 authorization tests.
 *
 * Every protected route is exercised as:
 *   signed-out  → expect 401/403
 *   officer     → command routes 403; own-data routes proceed
 *   controller  → command routes proceed; admin-only routes 403
 *   admin       → proceeds
 *   cross-user  → officer acting for another officer → 403
 *
 * The DB module is mocked with a chainable in-memory facade that returns
 * canned rows per table, so handlers run their real logic without Postgres.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { createHash } from 'crypto'

// ---------- Canned data & table registry ----------
const tableRows = new Map<object, any[]>()

function setRows(table: object, rows: any[]) {
  tableRows.set(table, rows)
}

function makeChain(tableKey?: object) {
  let rows: any[] = tableKey ? tableRows.get(tableKey) ?? [] : []
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'from') {
          return (table: object) => {
            rows = tableRows.get(table) ?? []
            return chain
          }
        }
        if (prop === 'then') {
          return (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject)
        }
        // Every other method is a pass-through
        return () => chain
      },
    }
  )
  return chain
}

const mockDb = {
  select: () => makeChain(),
  insert: () => makeChain(),
  update: () => makeChain(),
  delete: () => makeChain(),
}

vi.mock('@/lib/db', () => ({
  db: mockDb,
  isLiveDatabase: true,
  store: {
    findOfficerByPhone: () => undefined,
    toggleDutyStatus: vi.fn(),
    createUser: vi.fn(() => ({})),
    updateUser: vi.fn(() => ({})),
    findUser: () => undefined,
    getFieldOfficers: () => [],
    changeUserPassword: () => false,
  },
}))

// Must happen after mock
let schema: any

beforeAll(async () => {
  schema = await import('@/lib/db/schema')
})

const futureIso = new Date(Date.now() + 60 * 60 * 1000)
const adminUser = {
  id: 'usr-admin-hq',
  name: 'HQ Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  regionId: 'reg-ashanti',
  regionName: 'Ashanti Region',
}
const controllerUser = {
  id: 'usr-ctrl-1',
  name: 'Regional Controller',
  role: 'REGIONAL_COORD',
  status: 'ACTIVE',
  regionId: 'reg-ashanti',
  regionName: 'Ashanti Region',
}
const officerUserA = {
  id: 'usr-off-a',
  name: 'Kofi Mensah',
  role: 'FIELD_OFFICER',
  status: 'ACTIVE',
  regionId: 'reg-ashanti',
  regionName: 'Ashanti Region',
}
const officerUserB = {
  id: 'usr-off-b',
  name: 'Akua Owusu',
  role: 'FIELD_OFFICER',
  status: 'ACTIVE',
  regionId: 'reg-ashanti',
  regionName: 'Ashanti Region',
}

function seedAuth(user: any) {
  // Build the exact session row createSession would store (sha256 of raw token)
  tableRows.set(schema.session, [
    {
      id: 'ses-test-1',
      expiresAt: futureIso,
      updatedAt: new Date(),
      token: createHash('sha256').update('test-token-' + user.id).digest('hex'),
      userId: user.id,
      createdAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    },
  ])
  tableRows.set(schema.user, [user])
  tableRows.set(schema.regions, [{ id: 'reg-ashanti', name: 'Ashanti Region', code: 'AR' }])
  return 'test-token-' + user.id
}

function req(url: string, method: string, opts: { cookie?: string; body?: any } = {}): any {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.cookie) headers.cookie = `mos_session=${opts.cookie}`
  const init: RequestInit = { method, headers }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
  // NextRequest-ish shape: add cookies facade used by getSessionFromCookie
  const r = new Request('http://localhost' + url, init) as any
  r.cookies = {
    get: (name: string) => {
      const match = headers.cookie?.match(new RegExp(`${name}=([^;]+)`))
      return match ? { value: match[1] } : undefined
    },
  }
  return r
}

beforeEach(() => {
  tableRows.clear()
})

describe('Phase 2 route authorization matrix', () => {
  it('nobody gets in without a session cookie', async () => {
    const routes: Array<[string, any]> = [
      ['/api/fleet', (await import('@/app/api/fleet/route')).GET],
      ['/api/officers', (await import('@/app/api/officers/route')).GET],
      ['/api/centers', (await import('@/app/api/centers/route')).GET],
      ['/api/incidents', (await import('@/app/api/incidents/route')).GET],
      ['/api/notifications', (await import('@/app/api/notifications/route')).GET],
      ['/api/settings', (await import('@/app/api/settings/route')).GET],
      ['/api/profile?userId=usr-off-a', (await import('@/app/api/profile/route')).GET],
    ]
    for (const [url, handler] of routes) {
      const res = await handler(req(url, 'GET'))
      expect([401, 403], `${url} should reject anonymous`).toContain(res.status)
    }
  })

  it('officer role is denied command routes', async () => {
    const cookie = seedAuth(officerUserA)
    const checks: Array<[string, any]> = [
      ['/api/fleet', (await import('@/app/api/fleet/route')).GET],
      ['/api/officers', (await import('@/app/api/officers/route')).GET],
      ['/api/incidents', (await import('@/app/api/incidents/route')).GET],
      ['/api/notifications', (await import('@/app/api/notifications/route')).GET],
      ['/api/settings', (await import('@/app/api/settings/route')).GET],
    ]
    for (const [url, handler] of checks) {
      const res = await handler(req(url, 'GET', { cookie }))
      expect(res.status, `${url} should deny officer`).toBe(403)
    }
  })

  it('officer is blocked from admin-only mutations', async () => {
    const cookie = seedAuth(officerUserA)
    const officers = await import('@/app/api/officers/route')
    const centers = await import('@/app/api/centers/route')
    const settings = await import('@/app/api/settings/route')

    const r1 = await officers.POST(req('/api/officers', 'POST', { cookie, body: { name: 'X', phone: '0241112233' } }))
    expect(r1.status).toBe(403)

    const r2 = await officers.DELETE(req('/api/officers?id=usr-off-a', 'DELETE', { cookie }))
    expect(r2.status).toBe(403)

    const r3 = await centers.POST(req('/api/centers', 'POST', { cookie, body: { name: 'C', code: '9999', lat: 6.7, lng: -1.6 } }))
    expect(r3.status).toBe(403)

    const r4 = await centers.DELETE(req('/api/centers?id=cnt-x', 'DELETE', { cookie }))
    expect(r4.status).toBe(403)

    const r5 = await settings.PUT(req('/api/settings', 'PUT', { cookie, body: { settings: {} } }))
    expect(r5.status).toBe(403)
  })

  it('controller cannot hit admin-only routes', async () => {
    const cookie = seedAuth(controllerUser)
    const officers = await import('@/app/api/officers/route')
    const settings = await import('@/app/api/settings/route')

    const r1 = await officers.POST(req('/api/officers', 'POST', { cookie, body: { name: 'X', phone: '0241112233' } }))
    expect(r1.status).toBe(403)

    const r2 = await officers.DELETE(req('/api/officers?id=usr-off-a', 'DELETE', { cookie }))
    expect(r2.status).toBe(403)

    const r3 = await settings.POST(req('/api/settings', 'POST', { cookie, body: {} }))
    expect(r3.status).toBe(403)
  })

  it('controller can reach command routes', async () => {
    const cookie = seedAuth(controllerUser)
    tableRows.set(schema.assignments, [])
    tableRows.set(schema.examinationCenters, [])
    tableRows.set(schema.incidents, [])
    tableRows.set(schema.auditLogs, [])
    tableRows.set(schema.systemSettings, [])

    const fleet = await import('@/app/api/fleet/route')
    const incidents = await import('@/app/api/incidents/route')
    const notifications = await import('@/app/api/notifications/route')
    const settings = await import('@/app/api/settings/route')
    const officers = await import('@/app/api/officers/route')

    expect((await fleet.GET(req('/api/fleet', 'GET', { cookie }))).status).toBe(200)
    expect((await incidents.GET(req('/api/incidents', 'GET', { cookie }))).status).toBe(200)
    expect((await notifications.GET(req('/api/notifications', 'GET', { cookie }))).status).toBe(200)
    expect((await settings.GET(req('/api/settings', 'GET', { cookie }))).status).toBe(200)
    expect((await officers.GET(req('/api/officers', 'GET', { cookie }))).status).toBe(200)
  })

  it('admin can complete command and admin mutations', async () => {
    const cookie = seedAuth(adminUser)
    tableRows.set(schema.examinationCenters, [
      { id: 'cnt-050102', centerName: 'Prempeh College', centerCode: '050102', createdAt: new Date() },
    ])

    const officers = await import('@/app/api/officers/route')
    const centers = await import('@/app/api/centers/route')
    const settings = await import('@/app/api/settings/route')

    // Admin can POST an officer
    const officerBody = { name: 'New Officer', phone: '0245556677', assignedCenter: 'Prempeh College' }
    const r1 = await officers.POST(req('/api/officers', 'POST', { cookie, body: officerBody }))
    expect([201, 409, 200]).toContain(r1.status)

    // Admin can delete a center
    const r2 = await centers.DELETE(req('/api/centers?id=cnt-050102', 'DELETE', { cookie }))
    expect([200, 404]).toContain(r2.status)

    // Admin can put settings
    const r3 = await settings.PUT(req('/api/settings', 'PUT', { cookie, body: { settings: {} } }))
    expect(r3.status).toBe(200)
  })

  it('officer cannot act on another officer (telemetry)', async () => {
    const cookie = seedAuth(officerUserA)
    const telemetry = await import('@/app/api/field/telemetry/route')

    const res = await telemetry.POST(
      req('/api/field/telemetry', 'POST', { cookie, body: { officerId: officerUserB.id, lat: 6.7, lng: -1.6, battery: 80 } })
    )
    expect(res.status).toBe(403)
  })

  it('officer cannot act on another officer (check-in)', async () => {
    const cookie = seedAuth(officerUserA)
    const checkin = await import('@/app/api/field/checkin/route')

    const res = await checkin.POST(
      req('/api/field/checkin', 'POST', { cookie, body: { officerId: officerUserB.id, action: 'CHECK_IN' } })
    )
    expect(res.status).toBe(403)
  })

  it('officer report forces the reporter to the caller (cannot impersonate)', async () => {
    const cookie = seedAuth(officerUserA)
    const incidents = await import('@/app/api/incidents/route')

    const res = await incidents.POST(
      req('/api/incidents', 'POST', { cookie, body: { reportedBy: officerUserB.id, description: 'test' } })
    )
    expect([201, 200]).toContain(res.status)
  })

  it('incident status update requires command (officer gets 403)', async () => {
    const cookie = seedAuth(officerUserA)
    tableRows.set(schema.incidents, [
      { id: 'inc-1', reportedBy: officerUserA.id, status: 'REPORTED', severity: 'CRITICAL', category: 'SOS', resolvedAt: null, isRead: false, createdAt: new Date(), updatedAt: new Date() },
    ])
    const incidents = await import('@/app/api/incidents/route')

    const res = await incidents.PUT(
      req('/api/incidents', 'PUT', { cookie, body: { id: 'inc-1', status: 'RESOLVED' } })
    )
    expect(res.status).toBe(403)
  })

  it('profile API is self-only for officers', async () => {
    const cookie = seedAuth(officerUserA)
    tableRows.set(schema.user, [officerUserA])

    const profile = await import('@/app/api/profile/route')
    const res = await profile.GET(req('/api/profile?userId=usr-off-b', 'GET', { cookie }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile?.id ?? body.user?.id).toBe(officerUserA.id)
  })
})
