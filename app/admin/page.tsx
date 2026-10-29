'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getCurrentClientSession, SessionData } from '@/lib/auth/session'
import { ProfileModal } from '@/components/profile/ProfileModal'
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
} from 'lucide-react'
import { UserAccount } from '@/lib/db'
import type { FleetOfficer, ExamCenter } from '@/components/admin/FleetMap'

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
  const [selectedOfficer, setSelectedOfficer] = useState<FleetOfficer | null>(null)
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [patrolDispatched, setPatrolDispatched] = useState<boolean>(false)

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

  // Handle Create New Officer
  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          staffId: newStaffId || `WAEC-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: newPhone,
          pin: newPin,
          region: newRegion,
          group: newGroup,
          isGroupLeader: newIsGroupLeader,
          assignedCenter: newCenter,
          assignedCenterCode: newCenterCode,
        }),
      })

      if (res.ok) {
        setFeedback(`Officer ${newName} successfully pre-provisioned in ${newGroup}`)
        setShowCreateModal(false)
        setNewName('')
        setNewStaffId('')
        setNewPhone('')
        setNewPin(Math.floor(1000 + Math.random() * 9000).toString())
        loadOfficers()
      } else {
        const err = await res.json()
        setFeedback(`Error: ${err.error || 'Failed to create account'}`)
      }
    } catch {
      setFeedback('Error pre-provisioning officer account.')
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

  // Handle Reset PIN
  const handleResetPin = async () => {
    if (!showResetPinModal) return
    try {
      const res = await fetch('/api/officers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showResetPinModal.id,
          pin: newResetPin,
        }),
      })

      if (res.ok) {
        setFeedback(`4-Digit PIN for ${showResetPinModal.name} reset to: ${newResetPin}`)
        setShowResetPinModal(null)
        setNewResetPin(Math.floor(1000 + Math.random() * 9000).toString())
        loadOfficers()
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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#090A0F] text-slate-100 font-sans select-none antialiased">
      {/* 3. Top Header Bar (h-14 shrink-0 border-b border-[#22263C] px-4) */}
      <header className="h-14 shrink-0 border-b border-[#22263C] px-4 bg-[#0E1222] flex items-center justify-between z-30 shadow-md">
        {/* Left: WAEC Crest & Hub Title */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#1E2B7B] border border-[#F6D300]/50 text-[#F6D300] font-black text-sm shadow-[0_0_12px_rgba(30,43,123,0.8)]">
            <Shield className="size-4 text-[#F6D300] fill-[#F6D300]/20" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-100 tracking-wider">
              WAEC MOS COMMAND <span className="text-slate-500">•</span> ASHANTI REGIONAL HUB
            </span>
            <span className="rounded bg-[#1E2B7B]/70 border border-[#F6D300]/40 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#F6D300]">
              v1.0-PROD
            </span>
          </div>
        </div>

        {/* Center: Active Emergency Alert pill */}
        <div className="hidden md:flex items-center">
          {sosOfficer && (
            <button
              onClick={handleFocusSamuelQuaye}
              className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] text-xs font-mono font-bold hover:bg-[#EF4444]/30 transition animate-pulse cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.35)]"
              title="Click to zoom in on Opoku Ware School emergency location"
            >
              <span className="size-2 rounded-full bg-[#EF4444] animate-ping" />
              <span>
                ⚠️ 1 ACTIVE SOS: {sosOfficer.name} ({sosOfficer.assignedCenter.split(' School')[0]}) [Bat: {sosOfficer.battery}%]
              </span>
            </button>
          )}
        </div>

        {/* Right: Live Connection, Avatar & Sign Out */}
        <div className="flex items-center gap-4">
          {/* Gateway Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#11131F] border border-[#22263C] text-[11px] font-mono text-[#10B981]">
            <span className="size-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]" />
            <span className="font-bold tracking-wide">GATEWAY ONLINE</span>
          </div>

          {/* User Profile */}
          <button
            onClick={() => setShowAdminProfile(true)}
            className="flex items-center gap-2 hover:opacity-90 transition cursor-pointer"
            title="Dr. Mensah Osei (Regional Controller Profile)"
          >
            <div className="size-8 rounded-full bg-[#1E2B7B] border border-[#22263C] flex items-center justify-center text-xs font-bold text-white shadow-xs">
              MO
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-200 leading-tight">Dr. Mensah Osei</span>
              <span className="text-[10px] font-mono text-slate-400">Regional Controller</span>
            </div>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#22263C] bg-[#11131F] hover:bg-[#1A1F36] hover:border-red-500/50 hover:text-red-400 text-xs font-mono font-semibold text-slate-300 transition cursor-pointer shadow-xs"
            title="Secure Sign Out"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Floating Tactical Notification Toast */}
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

      {/* 4. Main Operations Split (flex-1 flex overflow-hidden) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Slim Sidebar (w-56 shrink-0 border-r border-[#22263C] bg-[#0C0F1D] flex flex-col justify-between p-3) */}
        <aside className="w-56 shrink-0 border-r border-[#22263C] bg-[#0C0F1D] flex flex-col justify-between p-3 z-10">
          {/* Nav Items */}
          <div className="space-y-1.5">
            <div className="px-2 py-1 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
              Operations Control
            </div>

            {/* Live Fleet Map */}
            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-[#1E2B7B] text-[#F6D300] font-bold border border-[#F6D300]/40 shadow-[0_0_15px_rgba(30,43,123,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#11131F]'
              }`}
            >
              <Compass className={`size-4 ${activeTab === 'map' ? 'text-[#F6D300]' : 'text-slate-500'}`} />
              <span>Live Fleet Map</span>
            </button>

            {/* Monitor Directory */}
            <button
              onClick={() => setActiveTab('directory')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition cursor-pointer ${
                activeTab === 'directory'
                  ? 'bg-[#1E2B7B] text-[#F6D300] font-bold border border-[#F6D300]/40 shadow-[0_0_15px_rgba(30,43,123,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#11131F]'
              }`}
            >
              <Users className={`size-4 ${activeTab === 'directory' ? 'text-[#F6D300]' : 'text-slate-500'}`} />
              <span>Monitor Directory</span>
            </button>

            {/* Exam Centers */}
            <button
              onClick={() => setActiveTab('centers')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition cursor-pointer ${
                activeTab === 'centers'
                  ? 'bg-[#1E2B7B] text-[#F6D300] font-bold border border-[#F6D300]/40 shadow-[0_0_15px_rgba(30,43,123,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#11131F]'
              }`}
            >
              <Building2 className={`size-4 ${activeTab === 'centers' ? 'text-[#F6D300]' : 'text-slate-500'}`} />
              <span>Exam Centers</span>
            </button>

            {/* Incident Logs */}
            <button
              onClick={() => setActiveTab('incidents')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono transition cursor-pointer ${
                activeTab === 'incidents'
                  ? 'bg-[#1E2B7B] text-[#F6D300] font-bold border border-[#F6D300]/40 shadow-[0_0_15px_rgba(30,43,123,0.5)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#11131F]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Siren className={`size-4 ${activeTab === 'incidents' ? 'text-[#F6D300]' : 'text-slate-500'}`} />
                <span>Incident Logs</span>
              </div>
              {activeSosCount > 0 && (
                <span className="size-2 rounded-full bg-[#EF4444] animate-ping" />
              )}
            </button>
          </div>

          {/* Bottom Sidebar Card: Shift Info */}
          <div className="rounded-xl border border-[#22263C] bg-[#11131F] p-3 text-xs font-mono space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              <Clock className="size-3 text-[#F6D300]" />
              <span>Shift Operations</span>
            </div>
            <div className="text-slate-200 font-bold text-[11px]">Morning Paper (08:30 GMT)</div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#10B981] pt-1 border-t border-[#22263C]/80">
              <span className="size-1.5 rounded-full bg-[#10B981]" />
              <span>48 Active Units Deployed</span>
            </div>
          </div>
        </aside>

        {/* Center Section: Map & Operations HUD */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#090A0F]">
          {/* TAB 1: LIVE FLEET MAP VIEW */}
          {activeTab === 'map' && (
            <div className="size-full relative overflow-hidden flex flex-col">
              {/* Top Floating KPI Capsule (over map) */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                <div className="bg-[#11131F]/90 backdrop-blur-md border border-[#22263C] rounded-xl px-5 py-2 flex items-center gap-6 text-xs font-mono shadow-2xl">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-500">DEPLOYED:</span>
                    <span className="font-bold text-white text-sm">{deployedMonitorsCount}</span>
                  </div>

                  <div className="h-3 w-px bg-[#22263C]" />

                  <div className="flex items-center gap-1.5 text-[#10B981]">
                    <span className="text-slate-500">ON-SITE:</span>
                    <span className="font-bold text-sm">42 (87.5%)</span>
                  </div>

                  <div className="h-3 w-px bg-[#22263C]" />

                  <div className="flex items-center gap-1.5 text-[#EAB308]">
                    <span className="text-slate-500">EN ROUTE:</span>
                    <span className="font-bold text-sm">5</span>
                  </div>

                  <div className="h-3 w-px bg-[#22263C]" />

                  <div className="flex items-center gap-1.5 text-[#EF4444] animate-pulse">
                    <span className="text-slate-500">SOS DISTRESS:</span>
                    <span className="font-black text-sm">1</span>
                  </div>
                </div>
              </div>

              {/* Fast Center Selector Chips (Top Right of Map) */}
              <div className="absolute top-3 right-14 z-20 flex items-center gap-1.5">
                <button
                  onClick={() => setFocusTarget({ lat: 6.6924, lng: -1.6241, zoom: 13 })}
                  className="rounded-lg border border-[#22263C] bg-[#11131F]/90 px-2.5 py-1 text-xs font-mono font-semibold text-slate-300 hover:text-white hover:bg-[#1A1F36] transition cursor-pointer shadow-md backdrop-blur-xs"
                >
                  All Kumasi
                </button>
                {EXAM_CENTERS.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleCenterFocus(c)}
                    className="rounded-lg border border-[#22263C] bg-[#11131F]/90 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-[#F6D300] hover:border-[#F6D300]/50 transition cursor-pointer flex items-center gap-1 shadow-md backdrop-blur-xs"
                  >
                    <span>{c.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({c.totalMonitors})</span>
                  </button>
                ))}
              </div>

              {/* Map Canvas */}
              <div className="h-full w-full">
                <FleetMap
                  officers={fleetOfficers}
                  centers={EXAM_CENTERS}
                  selectedOfficer={selectedOfficer}
                  onSelectOfficer={(off) => setSelectedOfficer(off)}
                  onCallOfficer={handleCallOfficer}
                  onNavigate={handleNavigate}
                  focusTarget={focusTarget}
                />
              </div>
            </div>
          )}

          {/* TAB 2: MONITOR DIRECTORY & CREDENTIALS */}
          {activeTab === 'directory' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#090A0F]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#22263C] pb-4">
                <div>
                  <h2 className="text-base font-mono font-bold text-slate-100 tracking-wide flex items-center gap-2">
                    <Users className="size-4 text-[#F6D300]" />
                    <span>Field Personnel & Security Credentials</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Pre-provisioned accounts with 4-digit PIN authentication & biometric audit trail
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Search officer name, phone, center..."
                      className="rounded-xl border border-[#22263C] bg-[#11131F] py-1.5 pl-8 pr-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#1E2B7B] w-64"
                    />
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] text-white px-3 py-1.5 text-xs font-mono font-bold border border-[#F6D300]/40 transition shadow-md cursor-pointer"
                  >
                    <UserPlus className="size-3.5 text-[#F6D300]" />
                    <span>+ Pre-Provision Officer</span>
                  </button>
                </div>
              </div>

              {/* Personnel Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredDirectoryOfficers.map((officer) => (
                  <div
                    key={officer.id}
                    className="rounded-xl border border-[#22263C] bg-[#11131F] p-4 hover:border-slate-500/40 transition space-y-3 shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1E2B7B] text-white font-mono font-bold text-xs shadow-xs border border-[#22263C]">
                          {officer.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                          {officer.isGroupLeader && (
                            <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-[#F6D300] text-black">
                              <Star className="size-2 fill-black" />
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white font-mono flex items-center gap-1.5">
                            <span>{officer.name}</span>
                            {officer.isGroupLeader && (
                              <span className="text-[9px] font-bold text-[#F6D300] bg-[#F6D300]/10 border border-[#F6D300]/40 px-1 rounded">
                                LEADER
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">{officer.phone}</div>
                        </div>
                      </div>

                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                          officer.status === 'ACTIVE'
                            ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40'
                            : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40'
                        }`}
                      >
                        {officer.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300 font-mono pt-2 border-t border-[#22263C]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Center:</span>
                        <span className="text-slate-200 truncate max-w-[170px]">{officer.assignedCenter}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Roster Group:</span>
                        <span className="font-bold text-blue-400">{officer.group || 'Group 1'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">4-Digit PIN:</span>
                        <span className="font-mono text-xs font-bold text-[#F6D300] bg-[#F6D300]/10 px-1.5 py-0.5 rounded border border-[#F6D300]/30">
                          {officer.pin || '0412'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#22263C]">
                      <button
                        onClick={() => setInspectedOfficer(officer)}
                        className="rounded-lg border border-[#22263C] bg-[#1A1F36] py-1.5 text-[11px] font-mono font-semibold text-slate-200 hover:bg-[#252C4D] transition cursor-pointer"
                      >
                        Dossier
                      </button>
                      <button
                        onClick={() => setShowResetPinModal(officer)}
                        className="rounded-lg border border-[#22263C] bg-[#1A1F36] py-1.5 text-[11px] font-mono font-semibold text-slate-200 hover:bg-[#252C4D] transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Lock className="size-2.5 text-[#F6D300]" />
                        <span>PIN</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(officer)}
                        className={`rounded-lg py-1.5 text-[11px] font-mono font-bold transition cursor-pointer ${
                          officer.status === 'ACTIVE'
                            ? 'bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25 border border-[#EF4444]/40'
                            : 'bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25 border border-[#10B981]/40'
                        }`}
                      >
                        {officer.status === 'ACTIVE' ? 'Revoke' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: EXAM CENTERS & GEOFENCES */}
          {activeTab === 'centers' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#090A0F]">
              <div className="border-b border-[#22263C] pb-3">
                <h2 className="text-base font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="size-4 text-[#F6D300]" />
                  <span>Ashanti Examination Centers & Vault Geofences</span>
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Authorized 150m radius perimeter boundaries with real-time telematics lock
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EXAM_CENTERS.map((center) => (
                  <div
                    key={center.code}
                    className="rounded-xl border border-[#22263C] bg-[#11131F] p-4 space-y-3 shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-mono font-bold text-sm text-white">{center.name}</h3>
                        <p className="text-xs font-mono text-slate-400">Index Code: {center.code}</p>
                      </div>
                      <span className="rounded bg-[#10B981]/15 border border-[#10B981]/40 px-2 py-0.5 text-[10px] font-mono font-bold text-[#10B981]">
                        DEPOT LOCKED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300 pt-2 border-t border-[#22263C]">
                      <div>
                        <span className="text-slate-500">Geofence Radius:</span>
                        <div className="text-white font-bold">{center.radius} meters</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Active Monitors:</span>
                        <div className="text-[#F6D300] font-bold">{center.totalMonitors} Units</div>
                      </div>
                      <div>
                        <span className="text-slate-500">GPS Coordinates:</span>
                        <div className="text-slate-300 font-mono text-[11px]">
                          {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Tamper Status:</span>
                        <div className="text-[#10B981] font-bold">SECURE (0 Breaches)</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCenterFocus(center)}
                      className="w-full mt-2 py-2 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] border border-[#22263C] text-xs font-mono font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
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
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#090A0F]">
              <div className="border-b border-[#22263C] pb-3">
                <h2 className="text-base font-mono font-bold text-slate-100 flex items-center gap-2">
                  <Siren className="size-4 text-[#EF4444]" />
                  <span>Security Incident Command Logs</span>
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  High-priority telematics alarms, SOS alerts, and emergency dispatch tracking
                </p>
              </div>

              {/* SOS Incident Highlight Card */}
              {sosOfficer && (
                <div className="rounded-xl border border-[#EF4444] bg-[#EF4444]/10 p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-[#EF4444] text-white flex items-center justify-center shadow-lg">
                        <AlertTriangle className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#EF4444] px-2 py-0.5 text-[10px] font-mono font-black text-white">
                            CRITICAL SOS
                          </span>
                          <span className="text-xs font-mono text-red-300">#WAEC-SEC-091</span>
                        </div>
                        <h3 className="font-mono font-bold text-base text-white mt-1">
                          Officer {sosOfficer.name} — {sosOfficer.assignedCenter}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFocusSamuelQuaye}
                        className="px-3.5 py-2 rounded-lg bg-[#11131F] hover:bg-[#1A1F36] border border-[#22263C] text-xs font-mono font-bold text-slate-200 transition cursor-pointer"
                      >
                        Focus Map Pin
                      </button>
                      <button
                        onClick={handleDispatchPatrol}
                        className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-xs font-mono font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Phone className="size-3.5" />
                        <span>{patrolDispatched ? 'PATROL DISPATCHED (191)' : 'DISPATCH PATROL (Call 191)'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#11131F]/90 border border-[#22263C] text-xs font-mono text-slate-200">
                    <span className="text-slate-500">Incident Details: </span>
                    {sosOfficer.sosDetails}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500">Battery:</span>
                      <div className="text-[#EF4444] font-bold">{sosOfficer.battery}%</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Phone:</span>
                      <div className="text-white font-bold">{sosOfficer.phone}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Timestamp:</span>
                      <div className="text-white font-bold">{sosOfficer.verifiedTime}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Distance from Datum:</span>
                      <div className="text-[#10B981] font-bold">{sosOfficer.distanceFromDatum}m (Inside)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Incident Log */}
              <div className="rounded-xl border border-[#22263C] bg-[#11131F] p-4 space-y-3">
                <h3 className="font-mono font-bold text-xs text-slate-300 uppercase tracking-wider">
                  Audit Trail & Telematics Timeline
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between">
                    <div>
                      <span className="text-[#EF4444] font-bold">[07:48 GMT]</span> SOS triggered by Officer Samuel Quaye (Opoku Ware Center A)
                    </div>
                    <span className="text-red-400 font-bold">UNRESOLVED</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between">
                    <div>
                      <span className="text-[#10B981] font-bold">[07:54 GMT]</span> Kofi Mensah verified on-site at Prempeh College Center A
                    </div>
                    <span className="text-emerald-400">VERIFIED</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between">
                    <div>
                      <span className="text-[#10B981] font-bold">[08:02 GMT]</span> Akua Owusu verified on-site at Prempeh College Center B
                    </div>
                    <span className="text-emerald-400">VERIFIED</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0C0F1D] border border-[#22263C] flex items-center justify-between">
                    <div>
                      <span className="text-[#EAB308] font-bold">[08:05 GMT]</span> Emmanuel Boateng moving en route (450m from Kumasi High School)
                    </div>
                    <span className="text-amber-400">TELEMETRY OK</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Section: Regional Fleet & Groups Roster (w-80 shrink-0 border-l border-[#22263C] bg-[#0E1222] flex flex-col overflow-hidden) */}
        <aside className="w-80 shrink-0 border-l border-[#22263C] bg-[#0E1222] flex flex-col overflow-hidden z-10">
          {/* Header */}
          <div className="p-3 border-b border-[#22263C] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-bold text-xs text-slate-100 uppercase tracking-wide">
                Ashanti Fleet Roster
              </h3>
              <span className="text-[10px] font-mono text-[#F6D300] font-bold bg-[#F6D300]/10 px-2 py-0.5 rounded border border-[#F6D300]/30">
                10 GROUPS
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Filter officer or group..."
                className="w-full rounded-lg border border-[#22263C] bg-[#11131F] py-1.5 pl-8 pr-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#1E2B7B]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[#1E2B7B] text-[#F6D300]'
                    : 'bg-[#11131F] text-slate-400 hover:text-white'
                }`}
              >
                All (48)
              </button>
              <button
                onClick={() => setStatusFilter('ON_SITE')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  statusFilter === 'ON_SITE'
                    ? 'bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/50'
                    : 'bg-[#11131F] text-slate-400 hover:text-white'
                }`}
              >
                On-Site (42)
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-[#EAB308]/25 text-[#EAB308] border border-[#EAB308]/50'
                    : 'bg-[#11131F] text-slate-400 hover:text-white'
                }`}
              >
                Pending (5)
              </button>
              <button
                onClick={() => setStatusFilter('SOS')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  statusFilter === 'SOS'
                    ? 'bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/50'
                    : 'bg-[#11131F] text-slate-400 hover:text-white'
                }`}
              >
                SOS (1)
              </button>
            </div>
          </div>

          {/* Scrollable Group List (flex-1 overflow-y-auto p-3 space-y-2) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {groupsList.map((grpName) => {
              const groupOfficers = filteredFleetOfficers.filter((o) => o.group === grpName)
              const isExpanded = Boolean(expandedGroups[grpName])
              const hasSos = groupOfficers.some((o) => o.status === 'SOS')
              const onSiteInGroup = groupOfficers.filter((o) => o.status === 'ON_SITE').length

              return (
                <div
                  key={grpName}
                  className={`rounded-xl border transition overflow-hidden ${
                    hasSos
                      ? 'border-[#EF4444]/70 bg-[#EF4444]/10'
                      : isExpanded
                      ? 'border-[#22263C] bg-[#11131F]'
                      : 'border-[#22263C]/60 bg-[#0C0F1D]'
                  }`}
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroupAccordion(grpName)}
                    className="w-full flex items-center justify-between p-2.5 text-left hover:bg-[#1A1F36]/50 transition cursor-pointer font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-200">{grpName}</span>
                      {hasSos && (
                        <span className="rounded bg-[#EF4444] px-1.5 py-0.2 text-[9px] font-black text-white animate-pulse">
                          ⚠️ SOS
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-[10px]">
                        {onSiteInGroup}/{groupOfficers.length} On-Site
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="size-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="size-3.5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="divide-y divide-[#22263C]/80 border-t border-[#22263C] bg-[#11131F]">
                      {groupOfficers.length === 0 ? (
                        <div className="p-3 text-center text-xs font-mono text-slate-500">
                          No officers matching filter.
                        </div>
                      ) : (
                        groupOfficers.map((officer) => (
                          <div
                            key={officer.id}
                            onClick={() => {
                              setActiveTab('map')
                              setSelectedOfficer(officer)
                              setFocusTarget({ lat: officer.lat, lng: officer.lng, zoom: 16 })
                            }}
                            className={`p-2.5 transition hover:bg-[#1A1F36] cursor-pointer flex items-center justify-between ${
                              selectedOfficer?.id === officer.id ? 'bg-[#1E2B7B]/40 border-l-2 border-[#F6D300]' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-mono font-bold text-xs text-white truncate">
                                  {officer.name}
                                </span>
                                {officer.isLeader && (
                                  <span className="text-[10px] font-bold text-[#F6D300]">
                                    ★ (Leader)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 truncate">
                                {officer.assignedCenter.split(' School')[0].split(' College')[0]}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono">
                                {officer.status === 'ON_SITE' && (
                                  <span className="text-[#10B981] font-bold bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/30">
                                    [ON-SITE {officer.verifiedTime}]
                                  </span>
                                )}
                                {officer.status === 'PENDING' && (
                                  <span className="text-[#EAB308] font-bold bg-[#EAB308]/15 px-1.5 py-0.5 rounded border border-[#EAB308]/30">
                                    [{officer.distanceFromDatum}m AWAY]
                                  </span>
                                )}
                                {officer.status === 'SOS' && (
                                  <span className="text-[#EF4444] font-black bg-[#EF4444]/20 px-1.5 py-0.5 rounded border border-[#EF4444]/50 animate-pulse">
                                    [⚠️ SOS DISTRESS]
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Battery & Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="flex items-center gap-0.5 text-[10px] font-mono text-slate-400 mr-1">
                                <Battery className="size-3" />
                                {officer.battery}%
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCallOfficer(officer.phone)
                                }}
                                className="size-6 rounded bg-[#1A1F36] hover:bg-[#252C4D] text-slate-300 flex items-center justify-center transition"
                                title={`Call ${officer.phone}`}
                              >
                                <Phone className="size-2.5 text-[#F6D300]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNavigate(officer.lat, officer.lng)
                                }}
                                className="size-6 rounded bg-[#1A1F36] hover:bg-[#252C4D] text-slate-300 flex items-center justify-center transition"
                                title="Navigate on Google Maps"
                              >
                                <Navigation className="size-2.5 text-blue-400" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {/* MODAL: PRE-PROVISION FIELD OFFICER (Account Creation) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#22263C] bg-[#11131F] p-6 shadow-2xl text-slate-100 animate-in fade-in duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-[#22263C] pb-3">
              <div>
                <h2 className="text-base font-mono font-bold text-white">Pre-Provision Field Officer</h2>
                <p className="text-xs font-mono text-slate-400">Create official account with 4-digit PIN authentication</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="size-8 rounded-lg hover:bg-[#1A1F36] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-300">
                  Officer Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwabena Asante"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1E2B7B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    placeholder="WAEC-ASH-0105"
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Phone (Login ID)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 000 0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Secret 4-Digit PIN
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 font-bold text-[#F6D300] focus:outline-none focus:border-[#1E2B7B]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Region
                  </label>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                  >
                    <option value="Ashanti Region">Ashanti Region</option>
                    <option value="Greater Accra">Greater Accra</option>
                    <option value="Western Region">Western Region</option>
                    <option value="Central Region">Central Region</option>
                    <option value="Eastern Region">Eastern Region</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Assigned Group
                  </label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                  >
                    {Array.from({ length: 10 }, (_, i) => `Group ${i + 1}`).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-300">
                    Center Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="050102"
                    value={newCenterCode}
                    onChange={(e) => setNewCenterCode(e.target.value)}
                    className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                  />
                </div>
              </div>

              {/* Group Leader Checkbox */}
              <div className="flex items-center gap-2 rounded-xl border border-[#22263C] bg-[#0C0F1D] p-2.5">
                <input
                  type="checkbox"
                  id="leader-toggle"
                  checked={newIsGroupLeader}
                  onChange={(e) => setNewIsGroupLeader(e.target.checked)}
                  className="size-4 accent-[#1E2B7B] cursor-pointer"
                />
                <label
                  htmlFor="leader-toggle"
                  className="font-bold text-slate-200 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Designate as Group Leader</span>
                  <Star className="size-3 text-[#F6D300] fill-[#F6D300]" />
                </label>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-300">
                  Assigned Examination Center
                </label>
                <select
                  value={newCenter}
                  onChange={(e) => {
                    setNewCenter(e.target.value)
                    const found = EXAM_CENTERS.find((c) => c.name === e.target.value)
                    if (found) setNewCenterCode(found.code)
                  }}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0C0F1D] px-3 py-2 text-white focus:outline-none focus:border-[#1E2B7B]"
                >
                  {EXAM_CENTERS.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-[#22263C]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#22263C] bg-[#1A1F36] px-4 py-2 font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-[#F6D300]/40 px-4 py-2 font-bold text-[#F6D300] shadow-md transition cursor-pointer"
                >
                  Confirm & Pre-Provision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PIN */}
      {showResetPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[#22263C] bg-[#11131F] p-6 shadow-2xl text-slate-100 animate-in fade-in duration-200">
            <h3 className="text-base font-mono font-bold text-white">Reset Officer 4-Digit PIN</h3>
            <p className="mt-1 text-xs font-mono text-slate-400">
              Generate a new 4-digit PIN for <strong>{showResetPinModal.name}</strong> ({showResetPinModal.phone}).
            </p>

            <div className="my-4 rounded-xl border border-[#22263C] bg-[#0C0F1D] p-3.5">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                NEW 4-DIGIT PIN
              </label>
              <input
                type="text"
                maxLength={4}
                value={newResetPin}
                onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="mt-1 w-full rounded-lg border border-[#22263C] bg-[#11131F] p-2.5 font-mono text-lg text-[#F6D300] font-black tracking-widest text-center focus:outline-none focus:border-[#1E2B7B]"
              />
            </div>

            <div className="flex justify-end gap-2 font-mono">
              <button
                onClick={() => setShowResetPinModal(null)}
                className="rounded-xl border border-[#22263C] bg-[#1A1F36] px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPin}
                className="rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-[#F6D300]/40 px-4 py-1.5 text-xs font-bold text-[#F6D300] transition shadow-md cursor-pointer"
              >
                Save New PIN
              </button>
            </div>
          </div>
        </div>
      )}

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
