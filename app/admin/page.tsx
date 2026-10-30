'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getCurrentClientSession, SessionData } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { PreProvisionOfficerModal, PreProvisionData } from '@/components/admin/modals/PreProvisionOfficerModal'
import { ResetPinModal } from '@/components/admin/modals/ResetPinModal'
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  CheckCircle2,
  Lock,
  X,
  Building2,
  ShieldAlert,
  Star,
  MapPin,
  Phone,
  Radio,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Battery,
  Navigation,
  Check,
  LogOut,
  Compass,
  Activity,
  FileText,
  Clock,
  Shield,
  Siren,
  KeyRound,
  User,
} from 'lucide-react'
import { UserAccount } from '@/lib/db'
import type { FleetOfficer, ExamCenter } from '@/components/admin/FleetMap'
import { AdminSidebar } from '@/components/admin/sidebar/AdminSidebar'
import { AdminTopNav } from '@/components/admin/header/AdminTopNav'
import { OfficerTelematicsDrawer } from '@/components/admin/inspector/OfficerTelematicsDrawer'
import { MobileBottomNav } from '@/components/admin/mobile/MobileBottomNav'

// Dynamic import for Leaflet FleetMap to prevent SSR issues
const FleetMap = dynamic(() => import('@/components/admin/FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#090A0F] text-slate-400">
      <div className="size-8 animate-spin rounded-full border-2 border-[#1E2B7B] border-t-[#F6D300] mb-3" />
      <span className="text-xs font-mono font-semibold tracking-wider text-slate-400">
        INITIALIZING ASHANTI REGIONAL TELEMATICS GRID...
      </span>
    </div>
  ),
})

// Official Examination Centers in Kumasi, Ghana
export const EXAM_CENTERS: ExamCenter[] = [
  {
    name: 'Prempeh College Center A',
    code: '050102',
    lat: 6.7028,
    lng: -1.6369,
    radius: 150,
    depotLocked: true,
    totalMonitors: 22,
  },
  {
    name: 'Yaa Asantewaa Girls Center 2',
    code: '050510',
    lat: 6.6912,
    lng: -1.6521,
    radius: 150,
    depotLocked: true,
    totalMonitors: 8,
  },
  {
    name: 'Kumasi High School Center 1',
    code: '050211',
    lat: 6.6663,
    lng: -1.5975,
    radius: 150,
    depotLocked: true,
    totalMonitors: 14,
  },
  {
    name: 'Opoku Ware School Center A',
    code: '050304',
    lat: 6.6806,
    lng: -1.6389,
    radius: 150,
    depotLocked: true,
    totalMonitors: 12,
  },
]

// 48 Total Field Officers across 10 Groups (42 Verified On-Site, 5 En Route, 1 Active SOS)
const INITIAL_FLEET_OFFICERS: FleetOfficer[] = [
  // --- GROUP 1 (Kumasi Metro Central) ---
  {
    id: 'off-1',
    name: 'Kofi Mensah',
    phone: '+233244101001',
    staffId: 'WAEC-ASH-0101',
    group: 'Group 1',
    isLeader: true,
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:54 GMT',
    distanceFromDatum: 24,
    battery: 84,
    lat: 6.7029,
    lng: -1.6368,
  },
  {
    id: 'off-2',
    name: 'Akua Owusu',
    phone: '+233244101002',
    staffId: 'WAEC-ASH-0102',
    group: 'Group 1',
    assignedCenter: 'Prempeh College Center B',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:02 GMT',
    distanceFromDatum: 45,
    battery: 91,
    lat: 6.7025,
    lng: -1.6372,
  },
  {
    id: 'off-3',
    name: 'Emmanuel Boateng',
    phone: '+233244101003',
    staffId: 'WAEC-ASH-0103',
    group: 'Group 1',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'PENDING',
    distanceFromDatum: 450,
    battery: 76,
    lat: 6.6698,
    lng: -1.5945,
  },
  {
    id: 'off-4',
    name: 'Samuel Quaye',
    phone: '+233244101004',
    staffId: 'WAEC-ASH-0104',
    group: 'Group 1',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'SOS',
    verifiedTime: '07:48 GMT',
    distanceFromDatum: 18,
    battery: 24,
    lat: 6.6807,
    lng: -1.6388,
    sosDetails: 'Unauthorized perimeter breach attempt near Exam Hall 3. Requesting immediate patrol response.',
  },

  // --- GROUP 2 ---
  {
    id: 'off-5',
    name: 'Kwame Asante',
    phone: '+233244102001',
    staffId: 'WAEC-ASH-0201',
    group: 'Group 2',
    isLeader: true,
    assignedCenter: 'Yaa Asantewaa Girls Center 2',
    centerCode: '050510',
    status: 'ON_SITE',
    verifiedTime: '07:42 GMT',
    distanceFromDatum: 30,
    battery: 95,
    lat: 6.6914,
    lng: -1.652,
  },
  {
    id: 'off-6',
    name: 'Grace Osei',
    phone: '+233244102002',
    staffId: 'WAEC-ASH-0202',
    group: 'Group 2',
    assignedCenter: 'Yaa Asantewaa Girls Center 2',
    centerCode: '050510',
    status: 'ON_SITE',
    verifiedTime: '07:50 GMT',
    distanceFromDatum: 60,
    battery: 89,
    lat: 6.6911,
    lng: -1.6518,
  },
  {
    id: 'off-7',
    name: 'Daniel Appiah',
    phone: '+233244102003',
    staffId: 'WAEC-ASH-0203',
    group: 'Group 2',
    assignedCenter: 'Yaa Asantewaa Girls Center 2',
    centerCode: '050510',
    status: 'ON_SITE',
    verifiedTime: '08:05 GMT',
    distanceFromDatum: 75,
    battery: 82,
    lat: 6.6913,
    lng: -1.6523,
  },
  {
    id: 'off-8',
    name: 'Patricia Agyei',
    phone: '+233244102004',
    staffId: 'WAEC-ASH-0204',
    group: 'Group 2',
    assignedCenter: 'Yaa Asantewaa Girls Center 2',
    centerCode: '050510',
    status: 'ON_SITE',
    verifiedTime: '08:08 GMT',
    distanceFromDatum: 40,
    battery: 90,
    lat: 6.6915,
    lng: -1.6519,
  },

  // --- GROUP 3 ---
  {
    id: 'off-9',
    name: 'Yaw Boakye',
    phone: '+233244103001',
    staffId: 'WAEC-ASH-0301',
    group: 'Group 3',
    isLeader: true,
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:38 GMT',
    distanceFromDatum: 15,
    battery: 98,
    lat: 6.7027,
    lng: -1.637,
  },
  {
    id: 'off-10',
    name: 'Abena Frimpong',
    phone: '+233244103002',
    staffId: 'WAEC-ASH-0302',
    group: 'Group 3',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:44 GMT',
    distanceFromDatum: 35,
    battery: 88,
    lat: 6.7026,
    lng: -1.6367,
  },
  {
    id: 'off-11',
    name: 'Kwadwo Antwi',
    phone: '+233244103003',
    staffId: 'WAEC-ASH-0303',
    group: 'Group 3',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:01 GMT',
    distanceFromDatum: 55,
    battery: 79,
    lat: 6.703,
    lng: -1.6371,
  },
  {
    id: 'off-12',
    name: 'Mercy Darko',
    phone: '+233244103004',
    staffId: 'WAEC-ASH-0304',
    group: 'Group 3',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'PENDING',
    distanceFromDatum: 320,
    battery: 74,
    lat: 6.6685,
    lng: -1.595,
  },

  // --- GROUP 4 ---
  {
    id: 'off-13',
    name: 'Joseph Ofori',
    phone: '+233244104001',
    staffId: 'WAEC-ASH-0401',
    group: 'Group 4',
    isLeader: true,
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:35 GMT',
    distanceFromDatum: 20,
    battery: 92,
    lat: 6.6806,
    lng: -1.6389,
  },
  {
    id: 'off-14',
    name: 'Evelyn Addo',
    phone: '+233244104002',
    staffId: 'WAEC-ASH-0402',
    group: 'Group 4',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:51 GMT',
    distanceFromDatum: 48,
    battery: 85,
    lat: 6.6804,
    lng: -1.6391,
  },
  {
    id: 'off-15',
    name: 'Francis Kwarteng',
    phone: '+233244104003',
    staffId: 'WAEC-ASH-0403',
    group: 'Group 4',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '08:04 GMT',
    distanceFromDatum: 65,
    battery: 77,
    lat: 6.6664,
    lng: -1.5976,
  },
  {
    id: 'off-16',
    name: 'Rita Yeboah',
    phone: '+233244104004',
    staffId: 'WAEC-ASH-0404',
    group: 'Group 4',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:11 GMT',
    distanceFromDatum: 52,
    battery: 81,
    lat: 6.7031,
    lng: -1.6368,
  },

  // --- GROUP 5 ---
  {
    id: 'off-17',
    name: 'Stephen Agyemang',
    phone: '+233244105001',
    staffId: 'WAEC-ASH-0501',
    group: 'Group 5',
    isLeader: true,
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '07:40 GMT',
    distanceFromDatum: 22,
    battery: 94,
    lat: 6.6662,
    lng: -1.5974,
  },
  {
    id: 'off-18',
    name: 'Linda Donkor',
    phone: '+233244105002',
    staffId: 'WAEC-ASH-0502',
    group: 'Group 5',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '07:49 GMT',
    distanceFromDatum: 38,
    battery: 86,
    lat: 6.6665,
    lng: -1.5977,
  },
  {
    id: 'off-19',
    name: 'Charles Opoku',
    phone: '+233244105003',
    staffId: 'WAEC-ASH-0503',
    group: 'Group 5',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:00 GMT',
    distanceFromDatum: 70,
    battery: 80,
    lat: 6.6808,
    lng: -1.6387,
  },
  {
    id: 'off-20',
    name: 'Gladys Mensah',
    phone: '+233244105004',
    staffId: 'WAEC-ASH-0504',
    group: 'Group 5',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:09 GMT',
    distanceFromDatum: 45,
    battery: 83,
    lat: 6.7028,
    lng: -1.6371,
  },

  // --- GROUP 6 ---
  {
    id: 'off-21',
    name: 'Peter Owusu',
    phone: '+233244106001',
    staffId: 'WAEC-ASH-0601',
    group: 'Group 6',
    isLeader: true,
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:36 GMT',
    distanceFromDatum: 18,
    battery: 96,
    lat: 6.7029,
    lng: -1.6369,
  },
  {
    id: 'off-22',
    name: 'Mary Asare',
    phone: '+233244106002',
    staffId: 'WAEC-ASH-0602',
    group: 'Group 6',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:48 GMT',
    distanceFromDatum: 40,
    battery: 87,
    lat: 6.7027,
    lng: -1.6368,
  },
  {
    id: 'off-23',
    name: 'David Konadu',
    phone: '+233244106003',
    staffId: 'WAEC-ASH-0603',
    group: 'Group 6',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:03 GMT',
    distanceFromDatum: 58,
    battery: 79,
    lat: 6.6805,
    lng: -1.639,
  },
  {
    id: 'off-24',
    name: 'Hannah Aidoo',
    phone: '+233244106004',
    staffId: 'WAEC-ASH-0604',
    group: 'Group 6',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'PENDING',
    distanceFromDatum: 410,
    battery: 71,
    lat: 6.6688,
    lng: -1.5952,
  },

  // --- GROUP 7 ---
  {
    id: 'off-25',
    name: 'Isaac Badu',
    phone: '+233244107001',
    staffId: 'WAEC-ASH-0701',
    group: 'Group 7',
    isLeader: true,
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:49 GMT',
    distanceFromDatum: 25,
    battery: 87,
    lat: 6.6807,
    lng: -1.6389,
  },
  {
    id: 'off-26',
    name: 'Comfort Sarpong',
    phone: '+233244107002',
    staffId: 'WAEC-ASH-0702',
    group: 'Group 7',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:54 GMT',
    distanceFromDatum: 44,
    battery: 83,
    lat: 6.6805,
    lng: -1.639,
  },
  {
    id: 'off-27',
    name: 'Edward Kusi',
    phone: '+233244107003',
    staffId: 'WAEC-ASH-0703',
    group: 'Group 7',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:06 GMT',
    distanceFromDatum: 58,
    battery: 77,
    lat: 6.7027,
    lng: -1.6368,
  },
  {
    id: 'off-28',
    name: 'Beatrice Fosu',
    phone: '+233244107004',
    staffId: 'WAEC-ASH-0704',
    group: 'Group 7',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '08:10 GMT',
    distanceFromDatum: 68,
    battery: 84,
    lat: 6.6663,
    lng: -1.5973,
  },

  // --- GROUP 8 ---
  {
    id: 'off-29',
    name: 'Victor Wiredu',
    phone: '+233244108001',
    staffId: 'WAEC-ASH-0801',
    group: 'Group 8',
    isLeader: true,
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:46 GMT',
    distanceFromDatum: 32,
    battery: 90,
    lat: 6.7028,
    lng: -1.6371,
  },
  {
    id: 'off-30',
    name: 'Theresa Amponsah',
    phone: '+233244108002',
    staffId: 'WAEC-ASH-0802',
    group: 'Group 8',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '07:52 GMT',
    distanceFromDatum: 51,
    battery: 85,
    lat: 6.7031,
    lng: -1.6369,
  },
  {
    id: 'off-31',
    name: 'Richard Baffour',
    phone: '+233244108003',
    staffId: 'WAEC-ASH-0803',
    group: 'Group 8',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'PENDING',
    distanceFromDatum: 480,
    battery: 69,
    lat: 6.6695,
    lng: -1.5942,
  },
  {
    id: 'off-32',
    name: 'Eunice Owusu-Ansah',
    phone: '+233244108004',
    staffId: 'WAEC-ASH-0804',
    group: 'Group 8',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:07 GMT',
    distanceFromDatum: 41,
    battery: 82,
    lat: 6.6807,
    lng: -1.6387,
  },

  // --- GROUP 9 ---
  {
    id: 'off-33',
    name: 'George Nsiah',
    phone: '+233244109001',
    staffId: 'WAEC-ASH-0901',
    group: 'Group 9',
    isLeader: true,
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '07:41 GMT',
    distanceFromDatum: 29,
    battery: 94,
    lat: 6.6664,
    lng: -1.5976,
  },
  {
    id: 'off-34',
    name: 'Mavis Yeboah',
    phone: '+233244109002',
    staffId: 'WAEC-ASH-0902',
    group: 'Group 9',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '07:58 GMT',
    distanceFromDatum: 35,
    battery: 88,
    lat: 6.6662,
    lng: -1.5974,
  },
  {
    id: 'off-35',
    name: 'Philip Gyasi',
    phone: '+233244109003',
    staffId: 'WAEC-ASH-0903',
    group: 'Group 9',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:04 GMT',
    distanceFromDatum: 63,
    battery: 81,
    lat: 6.7026,
    lng: -1.6367,
  },
  {
    id: 'off-36',
    name: 'Doris Adjei',
    phone: '+233244109004',
    staffId: 'WAEC-ASH-0904',
    group: 'Group 9',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:09 GMT',
    distanceFromDatum: 46,
    battery: 86,
    lat: 6.6806,
    lng: -1.6391,
  },

  // --- GROUP 10 ---
  {
    id: 'off-37',
    name: 'Andrews Mensah',
    phone: '+233244110001',
    staffId: 'WAEC-ASH-1001',
    group: 'Group 10',
    isLeader: true,
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:47 GMT',
    distanceFromDatum: 27,
    battery: 91,
    lat: 6.6808,
    lng: -1.6388,
  },
  {
    id: 'off-38',
    name: 'Cecilia Frimpong',
    phone: '+233244110002',
    staffId: 'WAEC-ASH-1002',
    group: 'Group 10',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '07:53 GMT',
    distanceFromDatum: 39,
    battery: 84,
    lat: 6.6805,
    lng: -1.6387,
  },
  {
    id: 'off-39',
    name: 'Benjamin Osei',
    phone: '+233244110003',
    staffId: 'WAEC-ASH-1003',
    group: 'Group 10',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:02 GMT',
    distanceFromDatum: 44,
    battery: 78,
    lat: 6.7029,
    lng: -1.6369,
  },
  {
    id: 'off-40',
    name: 'Janet Agyemang',
    phone: '+233244110004',
    staffId: 'WAEC-ASH-1004',
    group: 'Group 10',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'PENDING',
    distanceFromDatum: 380,
    battery: 65,
    lat: 6.7055,
    lng: -1.635,
  },

  // Additional 8 verified on-site monitors to complete 48 total
  {
    id: 'off-41',
    name: 'Alex Kwarteng',
    phone: '+233244101005',
    staffId: 'WAEC-ASH-0105',
    group: 'Group 1',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:12 GMT',
    distanceFromDatum: 50,
    battery: 87,
    lat: 6.703,
    lng: -1.6366,
  },
  {
    id: 'off-42',
    name: 'Victoria Mensah',
    phone: '+233244102005',
    staffId: 'WAEC-ASH-0205',
    group: 'Group 2',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '08:14 GMT',
    distanceFromDatum: 34,
    battery: 92,
    lat: 6.6665,
    lng: -1.5975,
  },
  {
    id: 'off-43',
    name: 'Solomon Baah',
    phone: '+233244103005',
    staffId: 'WAEC-ASH-0305',
    group: 'Group 3',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:15 GMT',
    distanceFromDatum: 28,
    battery: 85,
    lat: 6.6806,
    lng: -1.6389,
  },
  {
    id: 'off-44',
    name: 'Eunice Mensah',
    phone: '+233244104005',
    staffId: 'WAEC-ASH-0405',
    group: 'Group 4',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:16 GMT',
    distanceFromDatum: 38,
    battery: 89,
    lat: 6.7029,
    lng: -1.637,
  },
  {
    id: 'off-45',
    name: 'Francisca Appiah',
    phone: '+233244105005',
    staffId: 'WAEC-ASH-0505',
    group: 'Group 5',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '08:18 GMT',
    distanceFromDatum: 46,
    battery: 81,
    lat: 6.6664,
    lng: -1.5973,
  },
  {
    id: 'off-46',
    name: 'Gideon Amoah',
    phone: '+233244106005',
    staffId: 'WAEC-ASH-0605',
    group: 'Group 6',
    assignedCenter: 'Opoku Ware School Center A',
    centerCode: '050304',
    status: 'ON_SITE',
    verifiedTime: '08:19 GMT',
    distanceFromDatum: 36,
    battery: 88,
    lat: 6.6807,
    lng: -1.6388,
  },
  {
    id: 'off-47',
    name: 'Paul Sarfo',
    phone: '+233244107005',
    staffId: 'WAEC-ASH-0705',
    group: 'Group 7',
    assignedCenter: 'Prempeh College Center A',
    centerCode: '050102',
    status: 'ON_SITE',
    verifiedTime: '08:20 GMT',
    distanceFromDatum: 62,
    battery: 80,
    lat: 6.7028,
    lng: -1.6367,
  },
  {
    id: 'off-48',
    name: 'Joana Boateng',
    phone: '+233244108005',
    staffId: 'WAEC-ASH-0805',
    group: 'Group 8',
    assignedCenter: 'Kumasi High School Center 1',
    centerCode: '050211',
    status: 'ON_SITE',
    verifiedTime: '08:21 GMT',
    distanceFromDatum: 42,
    battery: 86,
    lat: 6.6662,
    lng: -1.5977,
  },
]

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  // Current active navigation tab: 'map' | 'directory' | 'centers' | 'incidents'
  const [activeTab, setActiveTab] = useState<'map' | 'directory' | 'centers' | 'incidents'>('map')

  // Fleet Telematics state
  const [fleetOfficers, setFleetOfficers] = useState<FleetOfficer[]>(INITIAL_FLEET_OFFICERS)
  const [selectedOfficer, setSelectedOfficer] = useState<FleetOfficer | null>(INITIAL_FLEET_OFFICERS[0])
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [patrolDispatched, setPatrolDispatched] = useState<boolean>(false)

  // Responsive Layout States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileDrawerExpanded, setIsMobileDrawerExpanded] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const activeTabTitle = useMemo(() => {
    switch (activeTab) {
      case 'map':
        return 'Live Fleet Map'
      case 'directory':
        return 'Monitor Directory'
      case 'centers':
        return 'Exam Centers'
      case 'incidents':
        return 'Incident Logs'
      default:
        return 'Live Fleet Map'
    }
  }, [activeTab])

  // Roster search and filters
  const [rosterSearch, setRosterSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_SITE' | 'PENDING' | 'SOS'>('ALL')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Group 1': true, // Expanded by default
  })

  // Personnel DB Accounts (for account pre-provisioning & management)
  const [officers, setOfficers] = useState<UserAccount[]>([])
  const [directorySearch, setDirectorySearch] = useState('')
  const [feedback, setFeedback] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetPinModal, setShowResetPinModal] = useState<UserAccount | null>(null)
  const [showAdminProfile, setShowAdminProfile] = useState(false)
  const [inspectedOfficer, setInspectedOfficer] = useState<UserAccount | null>(null)

  // Provisioning form states
  const [newName, setNewName] = useState('')
  const [newStaffId, setNewStaffId] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPin, setNewPin] = useState(Math.floor(1000 + Math.random() * 9000).toString())
  const [newRegion, setNewRegion] = useState('Ashanti Region')
  const [newGroup, setNewGroup] = useState('Group 1')
  const [newIsGroupLeader, setNewIsGroupLeader] = useState(false)
  const [newCenter, setNewCenter] = useState('Prempeh College Center A')
  const [newCenterCode, setNewCenterCode] = useState('050102')

  // Reset PIN state
  const [newResetPin, setNewResetPin] = useState(Math.floor(1000 + Math.random() * 9000).toString())

  // Check auth session
  useEffect(() => {
    let s = getCurrentClientSession()
    if (!s || s.role !== 'ADMIN') {
      const defaultAdminSession: SessionData = {
        userId: 'usr-admin-1',
        staffId: 'WAEC-HQ-001',
        email: 'm.osei@waec.org',
        name: 'Dr. Mensah Osei',
        phone: '+233244101000',
        pin: '1234',
        role: 'ADMIN',
        status: 'ACTIVE',
        region: 'Ashanti Region',
        group: 'HQ Executive',
        isGroupLeader: true,
        assignedCenter: 'Kumasi Regional Office',
        assignedCenterCode: '050000',
        mustChangePassword: false,
      }
      s = defaultAdminSession
      if (typeof window !== 'undefined') {
        localStorage.setItem('waec_mos_session', JSON.stringify(defaultAdminSession))
        document.cookie = `waec_role=ADMIN; path=/; max-age=86400; SameSite=Lax`
        document.cookie = `waec_user=usr-admin-1; path=/; max-age=86400; SameSite=Lax`
      }
    }
    setSession(s)
    loadOfficers()
  }, [router])

  const loadOfficers = async () => {
    try {
      const res = await fetch('/api/officers')
      const data = await res.json()
      setOfficers(data.officers || [])
    } catch {
      // Fallback
    }
  }

  // --- KPI Counts ---
  const deployedMonitorsCount = fleetOfficers.length // 48
  const verifiedOnSiteCount = fleetOfficers.filter((o) => o.status === 'ON_SITE').length // 42
  const pendingArrivalCount = fleetOfficers.filter((o) => o.status === 'PENDING').length // 5
  const activeSosCount = fleetOfficers.filter((o) => o.status === 'SOS').length // 1
  const sosOfficer = fleetOfficers.find((o) => o.status === 'SOS')

  // --- Interactive Handlers ---
  const handleCallOfficer = (phone: string) => {
    window.open(`tel:${phone}`)
    setFeedback(`Initiating voice communication line with ${phone}...`)
  }

  const handleNavigate = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    setFeedback(`Opened tactical route navigation to ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }

  const handleFocusSamuelQuaye = () => {
    setActiveTab('map')
    if (sosOfficer) {
      setSelectedOfficer(sosOfficer)
      setFocusTarget({ lat: sosOfficer.lat, lng: sosOfficer.lng, zoom: 16 })
      setFeedback(`Focused telematics map on ${sosOfficer.name} at ${sosOfficer.assignedCenter}`)
    }
  }

  const handleDispatchPatrol = () => {
    setPatrolDispatched(true)
    setFeedback('EMERGENCY PATROL DISPATCHED! Kumasi Central Rapid Response Unit en route (ETA 4 min).')
    window.open('tel:191')
  }

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('waec_mos_session')
      document.cookie = 'waec_role=; path=/; max-age=0'
      document.cookie = 'waec_user=; path=/; max-age=0'
    }
    router.push('/login')
  }

  const handleCenterFocus = (center: ExamCenter) => {
    setActiveTab('map')
    setFocusTarget({ lat: center.lat, lng: center.lng, zoom: 16 })
    setFeedback(`Surveillance grid locked onto ${center.name} (Code: ${center.code})`)
  }

  const toggleGroupAccordion = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  // Handle Create New Officer via Modal
  const handlePreProvisionOfficer = async (data: PreProvisionData) => {
    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          staffId: data.staffId || `WAEC-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: data.phone,
          pin: data.pin,
          region: data.region,
          group: data.group,
          isGroupLeader: data.isGroupLeader,
          assignedCenter: data.centerName,
          assignedCenterCode: data.centerCode,
        }),
      })

      if (res.ok) {
        setFeedback(`Officer ${data.name} successfully registered in ${data.group}`)
        setShowCreateModal(false)
        loadOfficers()
      } else {
        const err = await res.json()
        setFeedback(`Error: ${err.error || 'Failed to create account'}`)
      }
    } catch {
      setFeedback('Error registering officer account.')
    }
  }

  // Handle Toggle Status (Active / Revoke)
  const handleToggleStatus = async (officer: UserAccount) => {
    const newStatus = officer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch('/api/officers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: officer.id,
          status: newStatus,
        }),
      })

      if (res.ok) {
        setFeedback(`Security status for ${officer.name} updated to ${newStatus}`)
        loadOfficers()
      }
    } catch {
      setFeedback('Failed to update status.')
    }
  }

  // Handle Reset PIN via Modal
  const handleSaveResetPin = async (officerId: string, newPin: string) => {
    try {
      const res = await fetch('/api/officers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: officerId,
          pin: newPin,
        }),
      })

      if (res.ok) {
        setFeedback(`PIN reset successfully for officer`)
        setShowResetPinModal(null)
        loadOfficers()
      } else {
        setFeedback('Failed to reset officer PIN.')
      }
    } catch {
      setFeedback('Failed to reset officer PIN.')
    }
  }

  // Groups list 1 to 10
  const groupsList = useMemo(() => Array.from({ length: 10 }, (_, i) => `Group ${i + 1}`), [])

  // Filtered fleet officers for the roster
  const filteredFleetOfficers = useMemo(() => {
    return fleetOfficers.filter((off) => {
      const query = rosterSearch.toLowerCase()
      const matchQuery =
        !query ||
        off.name.toLowerCase().includes(query) ||
        off.assignedCenter.toLowerCase().includes(query) ||
        off.group.toLowerCase().includes(query) ||
        off.staffId.toLowerCase().includes(query)

      const matchStatus = statusFilter === 'ALL' || off.status === statusFilter
      return matchQuery && matchStatus
    })
  }, [fleetOfficers, rosterSearch, statusFilter])

  // Filtered DB officers for the Directory tab
  const filteredDirectoryOfficers = useMemo(() => {
    return officers.filter((off) => {
      const q = directorySearch.toLowerCase()
      return (
        !q ||
        off.name.toLowerCase().includes(q) ||
        off.phone.toLowerCase().includes(q) ||
        (off.staffId && off.staffId.toLowerCase().includes(q)) ||
        (off.assignedCenter && off.assignedCenter.toLowerCase().includes(q)) ||
        (off.group && off.group.toLowerCase().includes(q))
      )
    })
  }, [officers, directorySearch])

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#090A0F] text-foreground font-sans select-none antialiased">
      {/* Desktop Left Slim Sidebar Rail (Collapsible w-60 / w-16, hidden on mobile) */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        sosCount={activeSosCount}
        adminName={session?.name || 'Dr. Mensah Osei'}
      />

      {/* Main Operations Split: Top Nav + Dynamic Tab Stage */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        {/* Top Responsive Header */}
        <AdminTopNav
          activeCount={deployedMonitorsCount}
          activeTabTitle={activeTabTitle}
          searchQuery={rosterSearch}
          onSearchChange={setRosterSearch}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenProfile={() => setShowAdminProfile(true)}
          session={session}
          unreadAlertsCount={activeSosCount}
        />

        {/* Floating Feedback Notification Toast */}
        {feedback && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl border border-[#22263C] bg-[#11131F]/95 px-4 py-2 text-xs font-mono text-[#10B981] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="size-4 shrink-0 text-[#10B981]" />
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback('')}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Main Work Area: Flex row (Map + Inspector) or Tab Panels */}
        <main className="flex-1 flex overflow-hidden relative min-w-0">
          {/* TAB 1: LIVE FLEET MAP VIEW */}
          {activeTab === 'map' && (
            <div className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden relative min-w-0 p-0 lg:p-4 gap-0 lg:gap-4">
              {/* Center Map Canvas Card */}
              <div className="flex-1 h-full w-full relative min-w-0 rounded-none lg:rounded-2xl border-0 lg:border border-[#22263C] overflow-hidden bg-[#090A0F] shadow-2xl">
                <FleetMap
                  officers={filteredFleetOfficers}
                  centers={EXAM_CENTERS}
                  selectedOfficer={selectedOfficer}
                  onSelectOfficer={(off) => setSelectedOfficer(off)}
                  onCallOfficer={handleCallOfficer}
                  onNavigate={handleNavigate}
                  focusTarget={focusTarget}
                  activeSectorName="Ashanti Regional Zone"
                />
              </div>

              {/* Desktop Right Telematics Inspector Drawer Card */}
              {selectedOfficer && (
                <aside className="hidden lg:flex w-[380px] shrink-0 h-full rounded-2xl border border-[#22263C] bg-[#0C0F17] overflow-hidden flex-col shadow-2xl z-10 animate-in fade-in slide-in-from-right-4 duration-200">
                  <OfficerTelematicsDrawer
                    officer={selectedOfficer}
                    onCallOfficer={handleCallOfficer}
                    onViewLogs={() => setActiveTab('incidents')}
                    onClose={() => setSelectedOfficer(null)}
                  />
                </aside>
              )}

              {/* Mobile Floating Card Telematics Inspector (< 1024px) */}
              {selectedOfficer && (
                <div
                  className={`lg:hidden absolute left-3 right-3 sm:left-4 sm:right-auto sm:w-[380px] z-30 transition-all duration-300 ease-in-out border border-[#22263C] bg-[#0C0F17]/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden flex flex-col ${
                    isMobileDrawerExpanded
                      ? 'bottom-16 h-[70vh] max-h-[520px]'
                      : 'bottom-16 max-h-[220px]'
                  }`}
                >
                  <OfficerTelematicsDrawer
                    officer={selectedOfficer}
                    onCallOfficer={handleCallOfficer}
                    onViewLogs={() => setActiveTab('incidents')}
                    isMobileDrawerExpanded={isMobileDrawerExpanded}
                    onToggleMobileDrawer={() => setIsMobileDrawerExpanded(!isMobileDrawerExpanded)}
                    onClose={() => setSelectedOfficer(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MONITOR DIRECTORY & CREDENTIALS */}
          {activeTab === 'directory' && (
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 pb-28 lg:pb-6 space-y-4 bg-[#090A0F] font-sans">
              {/* Header: Title, Counts, Search, and Register Trigger */}
              <div className="flex flex-col gap-3 pb-3 border-b border-[#22263C]">
                {/* Row 1: Section Title & Register Button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-[#1E2B7B]/60 border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] shrink-0">
                      <Users className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Field Officers Directory</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          {filteredDirectoryOfficers.length} Officers
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage field personnel, exam center assignments, and login credentials
                      </p>
                    </div>
                  </div>

                  {/* Desktop Quick Register Button */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white px-3.5 py-2 text-xs font-bold border border-[#F6D300]/40 transition shadow-md cursor-pointer shrink-0"
                  >
                    <UserPlus className="size-3.5 text-[#F6D300]" />
                    <span>+ Register Officer</span>
                  </button>
                </div>

                {/* Row 2: Responsive Search Input + Mobile Register Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Search by name, phone, or assigned center..."
                      className="w-full rounded-xl border border-[#22263C] bg-[#11131F] py-2 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 font-sans"
                    />
                    {directorySearch && (
                      <button
                        onClick={() => setDirectorySearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Mobile full-width register button */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="sm:hidden flex items-center justify-center gap-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] text-white py-2.5 px-4 text-xs font-bold border border-[#F6D300]/40 transition shadow-md cursor-pointer w-full"
                  >
                    <UserPlus className="size-4 text-[#F6D300]" />
                    <span>+ Register Field Officer</span>
                  </button>
                </div>
              </div>

              {/* Personnel Cards Grid (Lean 1-col on mobile, 2-col tablet, 3-col desktop) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredDirectoryOfficers.map((officer) => (
                  <div
                    key={officer.id}
                    className="rounded-2xl border border-[#22263C] bg-[#11131F]/90 hover:border-slate-500/50 transition-all p-4 space-y-3 shadow-md flex flex-col justify-between"
                  >
                    {/* Top Row: Avatar + Name & Phone + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E2B7B] to-[#12162B] text-white font-bold text-xs shadow-sm border border-[#2B355A]">
                          {officer.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                          {officer.isGroupLeader && (
                            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#F6D300] text-black shadow-xs">
                              <Star className="size-2.5 fill-black" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                            <span className="truncate">{officer.name}</span>
                            {officer.isGroupLeader && (
                              <span className="text-[9px] font-bold text-[#F6D300] bg-[#F6D300]/15 border border-[#F6D300]/30 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                                <Star className="size-2 fill-[#F6D300]" />
                                <span>Leader</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <Phone className="size-3 text-slate-500 shrink-0" />
                            <span>{officer.phone}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 flex items-center gap-1 ${
                          officer.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${officer.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        <span>{officer.status === 'ACTIVE' ? 'Active' : 'Revoked'}</span>
                      </span>
                    </div>

                    {/* Details Section */}
                    <div className="rounded-xl bg-[#0A0D17]/80 p-3 border border-[#1E243A] space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-400 shrink-0">Center:</span>
                        <span className="text-slate-200 font-medium truncate flex-1">
                          {officer.assignedCenter || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#1C2237]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Users className="size-3.5 text-slate-500 shrink-0" />
                          <span className="text-slate-400">Group:</span>
                          <span className="font-semibold text-sky-400">{officer.group || 'Group 1'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[#121626] px-2 py-0.5 rounded-md border border-[#22263C]">
                          <Lock className="size-3 text-[#F6D300]" />
                          <span className="text-slate-400">PIN:</span>
                          <span className="font-bold text-[#F6D300] tracking-wider">
                            {officer.pin || '••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => setInspectedOfficer(officer)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[#22263C] bg-[#161B2E] py-2 text-xs font-semibold text-slate-200 hover:bg-[#202742] hover:text-white transition cursor-pointer"
                      >
                        <User className="size-3 text-slate-400" />
                        <span>Profile</span>
                      </button>
                      <button
                        onClick={() => setShowResetPinModal(officer)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[#22263C] bg-[#161B2E] py-2 text-xs font-semibold text-slate-200 hover:bg-[#202742] hover:text-white transition cursor-pointer"
                      >
                        <KeyRound className="size-3 text-[#F6D300]" />
                        <span>PIN</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(officer)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                          officer.status === 'ACTIVE'
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                        }`}
                      >
                        {officer.status === 'ACTIVE' ? (
                          <>
                            <ShieldAlert className="size-3" />
                            <span>Revoke</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-3" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: EXAM CENTERS & GEOFENCES */}
          {activeTab === 'centers' && (
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 pb-28 lg:pb-6 space-y-4 sm:space-y-5 bg-[#090A0F] font-sans">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#22263C] pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Building2 className="size-4.5 text-[#F6D300]" />
                    <span>Examination Centers & Geofences</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    150m perimeter boundaries with real-time telematics sync and automatic attendance verification
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-400 self-start sm:self-auto">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>All 4 Geofences Operational</span>
                </div>
              </div>

              {/* Bento Grid Top Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                {/* Bento Card 1: Regional District Coverage (Spans 2 columns on desktop) */}
                <div className="md:col-span-2 rounded-2xl border border-[#22263C] bg-gradient-to-br from-[#161D3A]/60 via-[#101426] to-[#0B0D17] p-4 sm:p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                        Ashanti Examination Zone
                      </span>
                      <h3 className="text-lg font-bold text-white mt-0.5">
                        Kumasi Metro Central District
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        Continuous GPS telemetry monitoring 4 major secondary schools with automated geo-fenced attendance and perimeter breach alarms.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0C0F17]/80 border border-[#22263C] px-3.5 py-2 rounded-xl text-xs shrink-0">
                      <ShieldCheck className="size-4 text-emerald-400" />
                      <div>
                        <div className="font-bold text-emerald-400">100% Integrity</div>
                        <div className="text-[10px] text-slate-400">0 Perimeter Breaches</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-[#22263C]/80 relative z-10">
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">Monitored Centers</span>
                      <span className="text-base sm:text-lg font-bold text-white mt-0.5 block">4 Centers</span>
                    </div>
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">Deployed Personnel</span>
                      <span className="text-base sm:text-lg font-bold text-[#F6D300] mt-0.5 block">
                        {EXAM_CENTERS.reduce((acc, c) => acc + c.totalMonitors, 0)} Officers
                      </span>
                    </div>
                    <div className="bg-[#0A0D17]/70 rounded-xl p-2.5 border border-[#1E243A]">
                      <span className="text-[10px] text-slate-400 block font-medium">Safety Perimeter</span>
                      <span className="text-base sm:text-lg font-bold text-sky-400 mt-0.5 block">150m Radius</span>
                    </div>
                  </div>
                </div>

                {/* Bento Card 2: Live Geofence Telematics Status */}
                <div className="rounded-2xl border border-[#22263C] bg-[#111422] p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Perimeter Status
                      </span>
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">Live Sensor Network</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300 py-1.5 border-b border-[#1E243A]">
                      <span className="text-slate-400">GPS Triangulation:</span>
                      <span className="font-semibold text-emerald-400">High Precision (RTK)</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 py-1.5 border-b border-[#1E243A]">
                      <span className="text-slate-400">Corridor Checkpoints:</span>
                      <span className="font-semibold text-white">All Clear</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 py-1.5">
                      <span className="text-slate-400">Automatic Sync:</span>
                      <span className="font-semibold text-sky-400">Every 10s</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('map')}
                    className="w-full py-2 px-3 rounded-xl bg-[#1E2B7B]/70 hover:bg-[#1E2B7B] border border-[#F6D300]/30 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MapPin className="size-3.5 text-[#F6D300]" />
                    <span>View All On Map</span>
                  </button>
                </div>
              </div>

              {/* Centers Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
                {EXAM_CENTERS.map((center, index) => (
                  <div
                    key={center.code}
                    className="rounded-2xl border border-[#22263C] bg-[#11131F] hover:border-[#38bdf8]/40 transition-all duration-200 p-4 sm:p-5 space-y-3.5 shadow-md flex flex-col justify-between"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-[#1E2B7B]/60 border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] font-bold text-sm shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-white">{center.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-sans">Index Code:</span>
                            <span className="text-xs text-sky-400 font-semibold">{center.code}</span>
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>ACTIVE GEOFENCE</span>
                      </span>
                    </div>

                    {/* Bento Mini-Tiles Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#1E243A]">
                      <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                        <span className="text-slate-400 text-[11px] block">Perimeter Boundary:</span>
                        <div className="text-white font-bold text-sm mt-0.5 flex items-center gap-1">
                          <Radio className="size-3 text-sky-400" />
                          <span>{center.radius}m Radius</span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                        <span className="text-slate-400 text-[11px] block">Active Personnel:</span>
                        <div className="text-[#F6D300] font-bold text-sm mt-0.5 flex items-center gap-1">
                          <Users className="size-3 text-[#F6D300]" />
                          <span>{center.totalMonitors} Officers</span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                        <span className="text-slate-400 text-[11px] block">GPS Coordinates:</span>
                        <div className="text-slate-200 font-sans text-xs mt-0.5 font-medium truncate">
                          {center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° W
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#0C0F17]/80 p-2.5 border border-[#1E243A]">
                        <span className="text-slate-400 text-[11px] block">Perimeter Security:</span>
                        <div className="text-emerald-400 font-bold text-xs mt-0.5 flex items-center gap-1">
                          <ShieldCheck className="size-3" />
                          <span>Normal (0 Breaches)</span>
                        </div>
                      </div>
                    </div>

                    {/* Touch Action Button */}
                    <button
                      onClick={() => handleCenterFocus(center)}
                      className="w-full py-2.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-[#F6D300]/40 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <MapPin className="size-3.5 text-[#F6D300]" />
                      <span>Focus Geofence on Live Map</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INCIDENT LOGS & EMERGENCY DISPATCH */}
          {activeTab === 'incidents' && (
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 pb-28 lg:pb-6 space-y-4 sm:space-y-5 bg-[#090A0F] font-sans">
              <div className="border-b border-[#22263C] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Siren className="size-4.5 text-[#EF4444]" />
                    <span>Security & Emergency Logs</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    High-priority telematics alarms, SOS alerts, and emergency dispatch tracking
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-400 self-start sm:self-auto">
                  <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                  <span>1 Active Emergency Alert</span>
                </div>
              </div>

              {/* SOS Incident Highlight Bento Card */}
              {sosOfficer && (
                <div className="rounded-2xl border border-[#EF4444]/80 bg-gradient-to-br from-rose-950/40 via-[#14121F] to-[#0C0F17] p-4 sm:p-5 space-y-4 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-xl bg-[#EF4444] text-white flex items-center justify-center shadow-lg shadow-rose-950 shrink-0">
                        <AlertTriangle className="size-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#EF4444] px-2.5 py-0.5 text-[10px] font-black text-white tracking-wider">
                            CRITICAL SOS
                          </span>
                          <span className="text-xs font-sans text-rose-300 font-semibold">Incident #WAEC-SEC-091</span>
                        </div>
                        <h3 className="font-bold text-base sm:text-lg text-white mt-0.5">
                          Officer {sosOfficer.name} — {sosOfficer.assignedCenter}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleFocusSamuelQuaye}
                        className="px-3.5 py-2.5 rounded-xl bg-[#11131F] hover:bg-[#1A1F36] active:bg-[#0D0F1A] border border-[#22263C] text-xs font-bold text-slate-200 transition cursor-pointer text-center"
                      >
                        Focus on Map
                      </button>
                      <button
                        onClick={handleDispatchPatrol}
                        className="px-4 py-2.5 rounded-xl bg-[#EF4444] hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Phone className="size-3.5" />
                        <span>{patrolDispatched ? 'Emergency Dispatched (191)' : 'Call Emergency (191)'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0A0D17]/90 border border-[#22263C] text-xs text-slate-200">
                    <span className="text-slate-400 font-semibold">Incident Report: </span>
                    <span>{sosOfficer.sosDetails}</span>
                  </div>

                  {/* Bento Telemetry Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-300">
                    <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                      <span className="text-slate-400 block text-[11px] font-medium">Device Battery</span>
                      <div className="text-[#EF4444] font-bold text-sm mt-0.5 flex items-center gap-1">
                        <Battery className="size-3.5" />
                        <span>{sosOfficer.battery}% (Critical)</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                      <span className="text-slate-400 block text-[11px] font-medium">Contact Phone</span>
                      <div className="text-white font-sans font-bold text-sm mt-0.5">{sosOfficer.phone}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                      <span className="text-slate-400 block text-[11px] font-medium">Trigger Time</span>
                      <div className="text-white font-sans font-bold text-sm mt-0.5">{sosOfficer.verifiedTime}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0D17]/80 border border-[#22263C]">
                      <span className="text-slate-400 block text-[11px] font-medium">Center Proximity</span>
                      <div className="text-emerald-400 font-bold text-sm mt-0.5">{sosOfficer.distanceFromDatum}m (Inside)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bento Row: System Integrity + Audit Trail Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {/* Audit Trail Timeline (Spans 2 columns on lg) */}
                <div className="lg:col-span-2 rounded-2xl border border-[#22263C] bg-[#11131F] p-4 sm:p-5 space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-sans">
                      Audit Trail & Telematics Timeline
                    </h3>
                    <span className="text-[11px] text-slate-400 font-sans">Today's Session</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-[#0C0F1D] border border-rose-500/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#EF4444] font-sans font-bold shrink-0">[07:48 GMT]</span>
                        <span className="text-slate-200">SOS triggered by Officer Samuel Quaye (Opoku Ware Center A)</span>
                      </div>
                      <span className="text-rose-400 font-bold shrink-0 text-[10px] bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                        UNRESOLVED
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-sans font-bold shrink-0">[07:54 GMT]</span>
                        <span className="text-slate-200">Kofi Mensah verified on-site at Prempeh College Center A</span>
                      </div>
                      <span className="text-emerald-400 font-bold shrink-0 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        VERIFIED
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-sans font-bold shrink-0">[08:02 GMT]</span>
                        <span className="text-slate-200">Akua Owusu verified on-site at Prempeh College Center B</span>
                      </div>
                      <span className="text-emerald-400 font-bold shrink-0 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        VERIFIED
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-sans font-bold shrink-0">[08:05 GMT]</span>
                        <span className="text-slate-200">Emmanuel Boateng moving en route (450m from Kumasi High School)</span>
                      </div>
                      <span className="text-amber-400 font-bold shrink-0 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                        IN TRANSIT
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Readiness Bento Tile */}
                <div className="rounded-2xl border border-[#22263C] bg-[#111422] p-4 sm:p-5 space-y-4 shadow-md flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider font-sans">
                      Security Network Status
                    </h3>
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Station Verification:</span>
                        <span className="text-emerald-400 font-bold">3 / 4 Centers Safe</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Emergency Unit:</span>
                        <span className="text-sky-400 font-bold">Police Command 191</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0C0F17] border border-[#22263C] flex items-center justify-between">
                        <span className="text-slate-400">Corridor Transit:</span>
                        <span className="text-amber-400 font-bold">Normal Traffic</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-slate-300">
                    <span className="text-sky-400 font-bold block mb-1">WAEC Incident Protocol:</span>
                    <span>All emergency events trigger immediate audio communication and central dispatch recording.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Fixed 4-Tab Bottom Navigation Bar (< 1024px) */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          sosCount={activeSosCount}
        />
      </div>

      {/* Mobile Slide-Over Navigation Modal */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-[#0C0F1D] border-r border-[#22263C] p-4 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#22263C]">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-[#1E2B7B]/60 border border-[#F6D300]/40 flex items-center justify-center text-[#F6D300]">
                    <Shield className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-sans font-bold text-white tracking-wider">M.O.S ADMIN</h2>
                    <p className="text-[10px] font-sans text-slate-400">EXAM MONITORING</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Nav items */}
              <div className="space-y-1">
                {[
                  { id: 'map' as const, label: 'Live Fleet Map', icon: Compass },
                  { id: 'directory' as const, label: 'Monitor Directory', icon: Users },
                  { id: 'centers' as const, label: 'Exam Centers', icon: Building2 },
                  { id: 'incidents' as const, label: 'Incident Logs', icon: Siren, badge: activeSosCount },
                ].map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id)
                        setIsMobileMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-[#1E2B7B] text-[#F6D300] font-bold border border-[#F6D300]/40'
                          : 'text-slate-400 hover:text-white hover:bg-[#11131F]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`size-4 ${isActive ? 'text-[#F6D300]' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {Boolean(item.badge && item.badge > 0) && (
                        <span className="size-2 rounded-full bg-[#EF4444] animate-ping" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Profile & Signout at bottom */}
            <div className="pt-3 border-t border-[#22263C] space-y-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  setShowAdminProfile(true)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-sans text-slate-300 hover:text-white hover:bg-[#11131F] cursor-pointer"
              >
                <div className="size-7 rounded-full bg-[#1E2B7B] text-white flex items-center justify-center font-bold text-[10px]">
                  AV
                </div>
                <div className="text-left">
                  <div className="font-bold">{session?.name || 'Dr. Mensah Osei'}</div>
                  <div className="text-[10px] text-[#10B981]">● System Admin</div>
                </div>
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-sans font-medium text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER / PRE-PROVISION FIELD OFFICER */}
      <PreProvisionOfficerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handlePreProvisionOfficer}
        examCenters={EXAM_CENTERS}
      />

      {/* MODAL: RESET PIN */}
      <ResetPinModal
        officer={showResetPinModal}
        onClose={() => setShowResetPinModal(null)}
        onSave={handleSaveResetPin}
      />

      {/* MODAL: OFFICER DOSSIER (Inspected by Admin) */}
      {inspectedOfficer && (
        <ProfileModal
          isOpen={Boolean(inspectedOfficer)}
          onClose={() => setInspectedOfficer(null)}
          session={{
            userId: inspectedOfficer.id,
            staffId: inspectedOfficer.staffId,
            email: inspectedOfficer.email,
            name: inspectedOfficer.name,
            phone: inspectedOfficer.phone,
            pin: inspectedOfficer.pin,
            role: inspectedOfficer.role,
            status: inspectedOfficer.status,
            region: inspectedOfficer.region,
            group: inspectedOfficer.group,
            isGroupLeader: inspectedOfficer.isGroupLeader,
            assignedCenter: inspectedOfficer.assignedCenter,
            assignedCenterCode: inspectedOfficer.assignedCenterCode,
            photo: inspectedOfficer.photo,
            mustChangePassword: inspectedOfficer.mustChangePassword,
          }}
          onDutyStatus={inspectedOfficer.dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
        />
      )}

      {/* MODAL: ADMIN'S OWN PROFILE */}
      <ProfileModal
        isOpen={showAdminProfile}
        onClose={() => setShowAdminProfile(false)}
        session={session}
        onDutyStatus="HQ ACTIVE"
      />
    </div>
  )
}
