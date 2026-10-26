'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BatteryCharging,
  Bell,
  CarFront,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Crosshair,
  ExternalLink,
  Filter,
  Headphones,
  LocateFixed,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Radio,
  ShieldCheck,
  Siren,
  Smartphone,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react'

const officers = [
  { name: 'K. Mensah', initials: 'KM', group: '03', center: 'Prempeh College', battery: 24, distance: '32m', status: 'SOS', color: 'red' },
  { name: 'A. Owusu', initials: 'AO', group: '03', center: 'Prempeh College', battery: 78, distance: '45m', status: 'ON SITE', color: 'green' },
  { name: 'E. Boateng', initials: 'EB', group: '03', center: 'Kumasi High School', battery: 61, distance: '850m', status: 'EN ROUTE', color: 'amber' },
  { name: 'S. Quaye', initials: 'SQ', group: '03', center: 'Opoku Ware School', battery: 92, distance: '118m', status: 'ON SITE', color: 'green' },
]

function StatusBadge({ status, color }: { status: string; color: string }) {
  const colors = { red: 'border-red-500/30 bg-red-500/10 text-red-400', green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400', amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400' }
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold tracking-wider ${colors[color as keyof typeof colors]}`}><span className={`size-1.5 rounded-full ${color === 'red' ? 'bg-red-400 animate-pulse' : color === 'green' ? 'bg-emerald-400' : 'bg-amber-400'}`} />{status}</span>
}

function Header({ view, setView }: { view: 'hq' | 'mobile'; setView: (v: 'hq' | 'mobile') => void }) {
  return <header className="flex min-h-16 items-center justify-between border-b border-[#22263c] bg-[#0d0f18]/95 px-4 md:px-6">
    <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-white"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WAEC%20Logo%20Download%20%28PNG%2C%20SVG%2C%20PSD%2C%20AI%29%20Free-4UhAUd3WiZxP0cPJDI2bMs4swwszGa.jpg" alt="West African Examinations Council logo" className="size-full object-cover" /></div><div><div className="text-sm font-black tracking-[0.18em] text-white">WAEC <span className="text-[#f6d300]">MOS</span></div><div className="hidden text-[9px] tracking-[0.16em] text-slate-500 sm:block">NATIONAL OPERATIONS SUITE · v1.0-PROD</div></div></div>
    <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-emerald-400 md:flex"><Wifi size={13} /> SECURE LINK <span className="text-slate-500">• 24ms</span></div>
    <button onClick={() => setView(view === 'hq' ? 'mobile' : 'hq')} className="flex items-center gap-2 rounded-md border border-[#303654] bg-[#15192b] px-3 py-2 text-[10px] font-bold tracking-wide text-slate-300 transition hover:border-[#5365d4] hover:text-white"><Smartphone size={14} className="text-[#8290ff]" /><span className="hidden sm:inline">{view === 'hq' ? 'MOBILE FIELD CLIENT' : 'HQ COMMAND CONSOLE'}</span><ChevronDown size={13} /></button>
  </header>
}

function MapPanel() {
  return <div className="relative min-h-[430px] flex-1 overflow-hidden rounded-xl border border-[#22263c] bg-[#111827]" style={{ backgroundImage: 'linear-gradient(rgba(81, 95, 157, .09) 1px, transparent 1px), linear-gradient(90deg, rgba(81, 95, 157, .09) 1px, transparent 1px)', backgroundSize: '44px 44px' }}>
    <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 52% 46%, rgba(46,65,182,.28), transparent 34%), radial-gradient(circle at 78% 62%, rgba(16,185,129,.10), transparent 24%)' }} />
    <div className="absolute left-[41%] top-[33%] size-40 rounded-full border border-[#f6d300]/60 bg-[#1e2b7b]/25 shadow-[0_0_35px_rgba(30,43,123,.35)]"><div className="absolute inset-4 rounded-full border border-dashed border-[#8290ff]/50" /></div>
    <div className="absolute left-[67%] top-[52%] size-32 rounded-full border border-[#f6d300]/50 bg-[#1e2b7b]/20" />
    <div className="absolute left-[22%] top-[61%] size-28 rounded-full border border-[#f6d300]/40 bg-[#1e2b7b]/20" />
    <MapPin className="absolute left-[52%] top-[47%] fill-emerald-500 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,.8)]" size={29} /><MapPin className="absolute left-[74%] top-[64%] fill-amber-500 text-amber-300" size={27} /><MapPin className="absolute left-[31%] top-[68%] fill-emerald-500 text-emerald-300" size={27} /><div className="absolute left-[25%] top-[25%] flex size-11 items-center justify-center rounded-full border-2 border-red-400 bg-red-500/20 text-red-300 shadow-[0_0_25px_rgba(239,68,68,.7)]"><Siren size={21} className="animate-pulse" /></div>
    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-[#303654] bg-[#0d0f18]/90 px-3 py-2 text-[10px] font-bold tracking-widest text-slate-300"><LocateFixed size={13} className="text-[#f6d300]" /> ASHANTI REGION · LIVE TELEMETRY</div>
    <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-md border border-[#303654] bg-[#0d0f18]/90 px-3 py-2 text-[10px] text-slate-400"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-400" /> ON SITE</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-amber-400" /> EN ROUTE</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-red-400" /> DISTRESS</span></div>
    <div className="absolute right-4 top-4 flex flex-col gap-1"><button className="flex size-8 items-center justify-center rounded bg-[#0d0f18]/90 text-slate-300 hover:text-white">+</button><button className="flex size-8 items-center justify-center rounded bg-[#0d0f18]/90 text-slate-300 hover:text-white">−</button></div>
  </div>
}

function Dashboard() {
  const [groupOpen, setGroupOpen] = useState(true)
  const [dispatchState, setDispatchState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function dispatchPatrol() {
    setDispatchState('sending')
    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerName: 'K. Mensah', groupNumber: '03', centerName: 'Prempeh College', type: 'dispatch', message: 'Patrol dispatched from HQ console' }),
      })
      if (!response.ok) throw new Error('Dispatch failed')
      setDispatchState('sent')
    } catch {
      setDispatchState('idle')
    }
  }

  return <div className="flex-1 overflow-auto p-4 md:p-6"><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-1 text-[10px] font-bold tracking-[0.25em] text-[#8290ff]">COMMAND OVERVIEW / 26 OCT 2026</p><h1 className="text-2xl font-black tracking-tight text-white">Field Operations <span className="text-slate-500">/ Ashanti</span></h1></div><div className="flex gap-2"><button className="flex items-center gap-2 rounded-md border border-[#303654] bg-[#15192b] px-3 py-2 text-[10px] font-bold text-slate-300"><Filter size={13} /> FILTER FLEET</button><button className="flex items-center gap-2 rounded-md bg-[#1e2b7b] px-3 py-2 text-[10px] font-bold text-white"><Radio size={13} /> DISPATCH CHANNEL</button></div></div>
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{[['TOTAL DEPLOYED', '48', Users, 'text-[#8290ff]'], ['VERIFIED ON-SITE', '42', ShieldCheck, 'text-emerald-400'], ['PENDING / EN ROUTE', '06', Navigation, 'text-amber-400'], ['ACTIVE DISTRESS', '01', Siren, 'text-red-400']].map(([label, value, Icon, color]) => <div key={label as string} className="rounded-xl border border-[#22263c] bg-[#11131f] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest text-slate-500">{label as string}</span><Icon size={16} className={color as string} /></div><div className="text-3xl font-black text-white">{value as string}</div><div className="mt-2 text-[10px] text-slate-500"><span className={label === 'ACTIVE DISTRESS' ? 'text-red-400' : 'text-emerald-400'}>{label === 'ACTIVE DISTRESS' ? 'REQUIRES ACTION' : '↑ 8.4%'}</span> vs last sync</div></div>)}</div>
    <div className="mb-5 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3 shadow-[0_0_28px_rgba(239,68,68,.08)]"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-red-500/20 text-red-400"><Siren size={18} className="animate-pulse" /></div><div><div className="text-[11px] font-black tracking-wider text-red-300">EMERGENCY: OFFICER K. MENSAH · GROUP 3 TRIGGERED SOS</div><div className="mt-0.5 text-[10px] text-red-200/60">Prempeh College · Battery 24% · Signal received 09:31:04 GMT</div></div></div><div className="hidden gap-2 sm:flex"><button className="rounded-md border border-red-400/30 px-3 py-2 text-[10px] font-bold text-red-300">FOCUS ON MAP</button><button onClick={dispatchPatrol} disabled={dispatchState === 'sending'} className="rounded-md bg-red-500 px-3 py-2 text-[10px] font-bold text-white disabled:cursor-wait disabled:opacity-60">{dispatchState === 'sent' ? 'PATROL DISPATCHED' : dispatchState === 'sending' ? 'DISPATCHING…' : 'DISPATCH PATROL'}</button></div></div>
    <div className="grid gap-5 xl:grid-cols-[250px_1fr_285px]"><aside className="rounded-xl border border-[#22263c] bg-[#11131f] p-4"><div className="mb-4 flex items-center justify-between"><div className="text-[10px] font-bold tracking-widest text-slate-400">REGIONAL FLEET</div><Menu size={15} className="text-slate-500" /></div><div className="mb-4 flex items-center justify-between rounded-md border border-[#303654] bg-[#15192b] px-3 py-2 text-[11px] text-white">Ashanti Region <ChevronDown size={14} className="text-slate-500" /></div><div className="flex flex-col gap-1">{Array.from({ length: 10 }, (_, i) => i + 1).map((group) => <div key={group}><button onClick={() => group === 3 && setGroupOpen(!groupOpen)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] ${group === 3 ? 'bg-[#1e2b7b]/40 text-white' : 'text-slate-500 hover:bg-[#15192b]'}`}><span className="flex items-center gap-2"><Users size={13} /> GROUP {String(group).padStart(2, '0')}</span>{group === 3 ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>{group === 3 && groupOpen && <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-[#303654] pl-2">{officers.slice(1).map((officer) => <div key={officer.name} className="flex items-center justify-between rounded px-2 py-2 text-[10px] hover:bg-[#15192b]"><span className="flex items-center gap-2 text-slate-300"><span className={`size-1.5 rounded-full ${officer.color === 'green' ? 'bg-emerald-400' : 'bg-amber-400'}`} />{officer.name}</span><span className="font-mono text-slate-500">{officer.battery}%</span></div>)}</div>}</div>)}</div></aside><MapPanel /><aside className="flex flex-col gap-4"><div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4"><div className="mb-4 flex items-center justify-between"><div className="text-[10px] font-bold tracking-widest text-slate-400">ACTIVE INSPECTOR</div><span className="flex items-center gap-1 text-[9px] text-red-400"><CircleDot size={11} /> LIVE</span></div><div className="mb-4 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-lg bg-red-500/15 text-sm font-black text-red-300">KM</div><div><div className="font-bold text-white">K. Mensah</div><div className="text-[10px] text-slate-500">Field Officer · Group 03</div></div></div><div className="flex flex-col gap-3 border-y border-[#22263c] py-3 text-[11px]"><div className="flex justify-between"><span className="text-slate-500">Assigned center</span><span className="text-right text-slate-200">Prempeh College</span></div><div className="flex justify-between"><span className="text-slate-500">Distance to center</span><span className="font-mono text-red-400">32m</span></div><div className="flex justify-between"><span className="text-slate-500">Battery level</span><span className="flex items-center gap-1 text-amber-400"><BatteryCharging size={13} />24%</span></div><div className="flex justify-between"><span className="text-slate-500">Last telemetry</span><span className="font-mono text-slate-300">09:31:04</span></div></div><div className="mt-4 flex gap-2"><button className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#303654] py-2 text-[10px] font-bold text-slate-300"><Phone size={12} /> CALL</button><button className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e2b7b] py-2 text-[10px] font-bold text-white"><ExternalLink size={12} /> NAVIGATE</button></div></div><div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-400"><Clock3 size={14} className="text-[#f6d300]" /> SYSTEM ACTIVITY</div>{['SOS beacon acknowledged', 'Telemetry packet received', 'Officer A. Owusu checked in'].map((item, i) => <div key={item} className="flex gap-2 border-t border-[#22263c] py-2.5 text-[10px]"><span className={`mt-1 size-1.5 rounded-full ${i === 0 ? 'bg-red-400' : 'bg-emerald-400'}`} /><div className="text-slate-400">{item}<div className="mt-0.5 font-mono text-[9px] text-slate-600">{['09:31:04', '09:30:58', '09:28:12'][i]} GMT</div></div></div>)}</div></aside></div></div>
}

function MobileClient() {
  const [inside, setInside] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [sos, setSos] = useState(false)
  const [holding, setHolding] = useState(false)
  useEffect(() => { if (!holding) return; const timer = setTimeout(() => { setSos(true); setHolding(false) }, 1500); return () => clearTimeout(timer) }, [holding])
  return <div className="flex flex-1 items-start justify-center overflow-auto bg-[#090a0f] p-5"><div className="w-full max-w-[430px] pb-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-bold tracking-[0.24em] text-[#8290ff]">FIELD TERMINAL / ACTIVE</p><h1 className="mt-1 text-xl font-black text-white">Good morning, Kofi</h1></div><div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-bold text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" />78% BAT</div></div><div className="mb-4 flex items-center gap-3 rounded-xl border border-[#22263c] bg-[#11131f] p-3"><div className="flex size-10 items-center justify-center rounded-lg bg-[#1e2b7b] text-xs font-black text-[#f6d300]">KM</div><div className="flex-1"><div className="text-sm font-bold text-white">K. Mensah</div><div className="text-[10px] text-slate-500">+233 24 555 0184 · Ashanti Region · Group 03</div></div><Radio size={16} className="text-emerald-400" /></div><div className="rounded-2xl border border-[#22263c] bg-[#11131f] p-4"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold tracking-widest text-slate-500">ASSIGNED CENTER</div><div className="mt-1 text-base font-bold text-white">Prempeh College Center A</div><div className="mt-1 font-mono text-[10px] text-slate-500">CODE: 050102 · START: 08:30 GMT</div></div><Crosshair size={21} className="text-[#f6d300]" /></div><div className="mb-4 flex items-center justify-between rounded-lg border border-[#303654] bg-[#15192b] p-3"><div className="flex items-center gap-2"><MapPin size={16} className={inside ? 'text-emerald-400' : 'text-amber-400'} /><div><div className={`text-xs font-black ${inside ? 'text-emerald-400' : 'text-amber-400'}`}>{inside ? 'VERIFIED ON SITE' : '850m OUTSIDE GEOFENCE'}</div><div className="mt-0.5 text-[9px] text-slate-500">GPS accuracy ±8m · updated just now</div></div></div><button onClick={() => setInside(!inside)} className="rounded-md border border-[#3c456d] px-2 py-1 text-[9px] font-bold text-slate-300">SIMULATE</button></div><button disabled={!inside || checkedIn} onClick={() => setCheckedIn(true)} className={`w-full rounded-lg py-3 text-xs font-black tracking-wide transition ${checkedIn ? 'bg-emerald-500/15 text-emerald-400' : inside ? 'bg-[#1e2b7b] text-white shadow-[0_0_20px_rgba(46,65,182,.25)] hover:bg-[#2e41b6]' : 'cursor-not-allowed bg-[#22263c] text-slate-600'}`}>{checkedIn ? 'CHECK-IN LOGGED · ON SITE' : inside ? 'LOG FORMAL CHECK-IN' : 'MOVE CLOSER TO UNLOCK'}</button></div>{checkedIn && <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="flex items-center gap-2 text-emerald-400"><ShieldCheck size={16} /><span className="text-[11px] font-bold">SESSION ACTIVE</span></div><span className="font-mono text-xs text-slate-300">00:14:22</span></div>}<div className="mt-4 rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-[#11131f] p-4 text-center"><div className="mb-3 text-[10px] font-bold tracking-[0.2em] text-red-300">EMERGENCY DISPATCH</div><button onPointerDown={() => setHolding(true)} onPointerUp={() => setHolding(false)} onPointerLeave={() => setHolding(false)} className={`relative mx-auto flex size-32 select-none items-center justify-center rounded-full border-4 border-red-500/40 bg-red-500/15 text-red-300 transition ${holding ? 'scale-95 shadow-[0_0_45px_rgba(239,68,68,.65)]' : 'shadow-[0_0_26px_rgba(239,68,68,.22)]'}`}><div className={`absolute inset-2 rounded-full border-2 border-dashed border-red-400/50 ${holding ? 'animate-spin' : ''}`} /><div className="relative flex flex-col items-center gap-1"><Siren size={27} /><span className="text-[9px] font-black tracking-widest">HOLD SOS</span></div></button><div className="mt-3 text-[10px] text-slate-500">Press and hold for 1.5 seconds to broadcast your location</div></div></div></div>
}

export default function OperationsConsole({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [view, setView] = useState<'hq' | 'mobile'>('hq')
  return <main className="min-h-screen bg-[#090a0f] text-white"><Header view={view} setView={setView} /><div className="sr-only">Signed in as {userName} ({userEmail})</div>{view === 'hq' ? <Dashboard /> : <MobileClient />}</main>
}
