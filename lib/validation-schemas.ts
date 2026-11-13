import { z } from 'zod'

/** Shared server-side input contracts. Every API validates with these. */

export const loginSchema = z.object({
  phone: z.string().trim().optional(),
  pin: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().optional(),
  mode: z.string().optional(),
})

export const officerCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  staffId: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ]{7,20}$/, 'Invalid phone number'),
  pin: z.string().trim().optional(),
  group: z.string().trim().max(60).optional(),
  isGroupLeader: z.boolean().optional(),
  region: z.string().trim().max(80).optional(),
  assignedCenter: z.string().trim().max(120),
  assignedCenterCode: z.string().trim().max(30).optional(),
})

export const officerUpdateSchema = z.object({
  id: z.string().min(1),
  action: z.string().optional(),
  status: z.string().optional(),
  newStatus: z.string().optional(),
  pin: z.string().optional(),
  newPin: z.string().optional(),
  name: z.string().trim().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  group: z.string().optional(),
  groupName: z.string().optional(),
  isGroupLeader: z.boolean().optional(),
  assignedCenter: z.string().optional(),
  assignedCenterCode: z.string().optional(),
  photo: z.string().optional(),
  image: z.string().optional(),
  bio: z.string().max(500).optional(),
  dutyStatus: z.string().optional(),
  paperName: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
})

export const centerCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(1).max(30),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(25).max(5000).optional(),
  districtId: z.string().optional(),
  districtName: z.string().optional(),
  regionName: z.string().optional(),
  supervisorContact: z.string().optional(),
})

export const centerUpdateSchema = centerCreateSchema.partial().extend({
  id: z.string().min(1),
})

export const incidentCreateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().max(60).optional(),
  severity: z.string().trim().max(40).optional(),
  description: z.string().trim().min(3).max(2000),
  centerId: z.string().optional(),
  centerCode: z.string().optional(),
  centerName: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  battery: z.coerce.number().optional(),
  distanceMeters: z.coerce.number().optional(),
  isSos: z.boolean().optional(),
})

export const telemetrySchema = z.object({
  officerId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  battery: z.coerce.number().int().min(0).max(100).optional(),
  speedKmh: z.coerce.number().min(0).optional(),
  accuracyMeters: z.coerce.number().min(0).optional(),
  distanceMeters: z.coerce.number().int().min(0).optional(),
  isSimulated: z.boolean().optional(),
})

export const checkinSchema = telemetrySchema.extend({
  action: z.enum(['CHECK_IN', 'CHECK_OUT']),
  isTestMode: z.boolean().optional(),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().trim().optional(),
  pin: z.string().optional(),
  photo: z.string().optional(),
  bio: z.string().max(500).optional(),
})
