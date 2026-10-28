import { pgTable, text, timestamp, boolean, uuid, integer, decimal, jsonb } from 'drizzle-orm/pg-core'

// --- Better Auth Schema Tables ---

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  // Custom WAEC MOS fields
  staffId: text('staff_id').unique(),
  phone: text('phone'),
  role: text('role').notNull().default('FIELD_OFFICER'), // SUPER_ADMIN, ADMIN, REGIONAL_COORD, SUPERVISOR, FIELD_OFFICER
  status: text('status').notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, REVOKED, ARCHIVED
  regionId: text('region_id'),
  districtId: text('district_id'),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- Operational & Geographic Entities ---

export const regions = pgTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  countryCode: text('country_code').notNull().default('GH'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const districts = pgTable('districts', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => regions.id),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const examinationCenters = pgTable('examination_centers', {
  id: text('id').primaryKey(),
  centerCode: text('center_code').notNull().unique(),
  centerName: text('center_name').notNull(),
  districtId: text('district_id').notNull().references(() => districts.id),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  geofenceRadiusMeters: integer('geofence_radius_meters').notNull().default(100),
  supervisorContact: text('supervisor_contact'),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Examination Operations & Patrol Assignments ---

export const operations = pgTable('operations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. WASSCE SC 2026 - Main Series
  seriesYear: integer('series_year').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status').notNull().default('ACTIVE'), // PLANNING, ACTIVE, COMPLETED, ARCHIVED
  createdAt: timestamp('created_at').defaultNow(),
})

export const assignments = pgTable('assignments', {
  id: text('id').primaryKey(),
  operationId: text('operation_id').notNull().references(() => operations.id),
  centerId: text('center_id').notNull().references(() => examinationCenters.id),
  officerId: text('officer_id').notNull().references(() => user.id),
  date: text('date').notNull(), // YYYY-MM-DD
  paperName: text('paper_name').notNull(), // e.g. Core Mathematics Paper 1 & 2
  startTime: text('start_time').notNull(), // 08:30 GMT
  endTime: text('end_time').notNull(), // 12:00 GMT
  status: text('status').notNull().default('PENDING'), // PENDING, ACKNOWLEDGED, ON_SITE, COMPLETED, CANCELLED, OVERDUE
  checkInTime: timestamp('check_in_time'),
  checkInLatitude: decimal('check_in_latitude', { precision: 10, scale: 8 }),
  checkInLongitude: decimal('check_in_longitude', { precision: 11, scale: 8 }),
  checkInDistanceMeters: integer('check_in_distance_meters'),
  checkOutTime: timestamp('check_out_time'),
  supervisorApproval: boolean('supervisor_approval').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// --- Incident Management ---

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  incidentNumber: text('incident_number').notNull().unique(), // e.g. INC-2026-0042
  title: text('title').notNull(),
  category: text('category').notNull(), // MALPRACTICE, SECURITY_THREAT, LOGISTICS, MEDICAL, ENVIRONMENTAL, OTHER
  severity: text('severity').notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  status: text('status').notNull().default('REPORTED'), // REPORTED, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED
  centerId: text('center_id').references(() => examinationCenters.id),
  reportedBy: text('reported_by').notNull().references(() => user.id),
  assignedTo: text('assigned_to').references(() => user.id),
  description: text('description').notNull(),
  evidenceUrl: text('evidence_url'),
  resolutionNotes: text('resolution_notes'),
  reportedAt: timestamp('reported_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const incidentUpdates = pgTable('incident_updates', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => user.id),
  comment: text('comment').notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Audit & Compliance Trail ---

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(), // USER_CREATED, USER_REVOKED, USER_RESTORED, PASSWORD_ROTATED, INCIDENT_ESCALATED, CHECK_IN_LOGGED
  entityType: text('entity_type').notNull(), // users, incidents, assignments
  entityId: text('entity_id').notNull(),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
