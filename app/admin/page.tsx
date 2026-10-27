'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type User = { id: string; name: string; email: string; role: string; createdAt: string }

const initialForm = { name: '', email: '', password: '' }

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(initialForm)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadUsers() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' })
    if (response.status === 401) { router.replace('/sign-in'); return }
    if (response.ok) setUsers(await response.json())
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function createUser(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setNotice(null)
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    setSubmitting(false)
    if (!response.ok) { setNotice({ type: 'error', text: data.error || 'Unable to create account.' }); return }
    setForm(initialForm); setNotice({ type: 'success', text: `Account created for ${data.name}. Share the credentials securely.` }); loadUsers()
  }

  async function toggleAccess(user: User) {
    const action = user.role === 'revoked' ? 'restore' : 'revoke'
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, action }) })
    if (response.ok) { setNotice({ type: 'success', text: `${user.name}'s access was ${action === 'revoke' ? 'revoked' : 'restored'}.` }); loadUsers() }
    else setNotice({ type: 'error', text: 'Unable to update account access.' })
  }

  async function signOut() { await authClient.signOut(); router.replace('/sign-in') }

  const activeUsers = users.filter((user) => user.role !== 'revoked')
  const filteredUsers = useMemo(() => users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [users, query])

  return (
    <main className="min-h-screen bg-[#07101d] text-slate-100">
      <header className="border-b border-white/10 bg-[#0a1727]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#f8d400] text-lg font-black text-[#07101d]">W</div><div><p className="text-xs font-black tracking-[0.28em] text-white">WAEC MOS</p><p className="text-[10px] tracking-[0.18em] text-slate-400">ADMIN CONTROL CENTRE</p></div></div>
          <button onClick={signOut} className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold tracking-wide text-slate-300 transition hover:border-[#f8d400] hover:text-white">SIGN OUT</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-8"><p className="mb-2 text-[11px] font-bold tracking-[0.28em] text-[#f8d400]">SECURE ACCESS MANAGEMENT</p><h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Field officer accounts</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Create credentials, monitor access, and revoke field accounts from one controlled workspace.</p></div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3"><Stat label="Total accounts" value={users.length} /><Stat label="Active officers" value={activeUsers.length} /><Stat label="Access revoked" value={users.length - activeUsers.length} /></div>
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <form onSubmit={createUser} className="rounded-2xl border border-white/10 bg-[#0d1b2c] p-5 shadow-2xl shadow-black/20"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-lg font-black text-white">Create account</h2><p className="mt-1 text-xs leading-5 text-slate-400">Issue a login for a new field officer.</p></div><span className="rounded-full bg-[#f8d400]/10 px-2.5 py-1 text-[10px] font-bold text-[#f8d400]">ADMIN ONLY</span></div><div className="flex flex-col gap-4"><Field label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="e.g. Kofi Mensah" /><Field label="Work email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="officer@waec.org" /><Field label="Temporary password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="Minimum 8 characters" minLength={8} /></div>{notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-3 py-2.5 text-xs ${notice.type === 'error' ? 'border-red-400/20 bg-red-400/10 text-red-200' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'}`}>{notice.text}</p>}<button disabled={submitting} className="mt-5 w-full rounded-lg bg-[#f8d400] px-4 py-3 text-xs font-black tracking-[0.16em] text-[#07101d] transition hover:bg-[#ffe44d] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'CREATING ACCOUNT…' : 'CREATE FIELD ACCOUNT'}</button></form>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1b2c]"><div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-black text-white">Account directory</h2><p className="mt-1 text-xs text-slate-400">Manage existing field officer access.</p></div><input aria-label="Search accounts" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="rounded-lg border border-white/10 bg-[#081321] px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#f8d400] md:w-56" /></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#0a1727] text-[10px] font-bold tracking-[0.16em] text-slate-500"><tr><th className="px-5 py-3">OFFICER</th><th className="px-5 py-3">STATUS</th><th className="px-5 py-3">CREATED</th><th className="px-5 py-3 text-right">ACTION</th></tr></thead><tbody className="divide-y divide-white/5">{loading ? <tr><td colSpan={4} className="px-5 py-10 text-center text-xs text-slate-500">Loading directory…</td></tr> : filteredUsers.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-xs text-slate-500">No accounts match your search.</td></tr> : filteredUsers.map((user) => <tr key={user.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4"><p className="font-bold text-white">{user.name}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p></td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${user.role === 'revoked' ? 'bg-red-400/10 text-red-300' : user.role === 'admin' ? 'bg-[#f8d400]/10 text-[#f8d400]' : 'bg-emerald-400/10 text-emerald-300'}`}>{user.role === 'revoked' ? 'REVOKED' : user.role === 'admin' ? 'ADMIN' : 'ACTIVE'}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-5 py-4 text-right">{user.role !== 'admin' && <button onClick={() => toggleAccess(user)} className={`text-[10px] font-bold tracking-wide ${user.role === 'revoked' ? 'text-emerald-300 hover:text-emerald-200' : 'text-red-300 hover:text-red-200'}`}>{user.role === 'revoked' ? 'RESTORE ACCESS' : 'REVOKE ACCESS'}</button>}</td></tr>)}</tbody></table></div></section>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-[#0d1b2c] px-4 py-4"><p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div> }
function Field({ label, value, onChange, placeholder, type = 'text', minLength }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; minLength?: number }) { return <label className="flex flex-col gap-2 text-[10px] font-bold tracking-[0.16em] text-slate-400">{label}<input required minLength={minLength} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rounded-lg border border-white/10 bg-[#081321] px-3 py-3 text-sm font-normal tracking-normal text-white outline-none placeholder:text-slate-600 focus:border-[#f8d400]" /></label> }
