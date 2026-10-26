'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadUsers() {
    const response = await fetch('/api/admin/users')
    if (response.status === 401) { router.replace('/sign-in'); return }
    setUsers(await response.json())
    setLoading(false)
  }
  useEffect(() => { loadUsers() }, [])

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError('')
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) { setError(data.error || 'Unable to create account.'); return }
    setMessage(`Account created for ${data.name}. Share the credentials securely.`); setForm({ name: '', email: '', password: '' }); loadUsers()
  }

  async function signOut() { await authClient.signOut(); router.replace('/sign-in') }

  return <main className="min-h-screen bg-[#090a0f] px-4 py-8 text-white"><div className="mx-auto max-w-5xl"><div className="mb-8 flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[0.25em] text-[#8290ff]">WAEC MOS / ADMINISTRATION</p><h1 className="mt-2 text-3xl font-black">User access control</h1><p className="mt-2 text-sm text-slate-400">Only administrators can create or revoke field accounts.</p></div><button onClick={signOut} className="rounded-lg border border-[#303654] px-4 py-2 text-xs font-bold text-slate-300">SIGN OUT</button></div><div className="grid gap-5 lg:grid-cols-[360px_1fr]"><form onSubmit={createUser} className="rounded-2xl border border-[#22263c] bg-[#11131f] p-5"><h2 className="mb-5 text-lg font-black">Create field account</h2>{(['name','email','password'] as const).map((key) => <label key={key} className="mb-4 flex flex-col gap-2 text-[10px] font-bold tracking-widest text-slate-400">{key.toUpperCase()}<input required minLength={key === 'password' ? 8 : undefined} type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="rounded-lg border border-[#303654] bg-[#15192b] px-3 py-3 text-sm font-normal tracking-normal text-white outline-none focus:border-[#8290ff]" /></label>)}{error && <p role="alert" className="mb-3 text-xs text-red-300">{error}</p>}{message && <p role="status" className="mb-3 text-xs text-emerald-300">{message}</p>}<button className="w-full rounded-lg bg-[#f6d300] px-4 py-3 text-xs font-black tracking-widest text-[#11131f]">CREATE ACCOUNT</button></form><section className="rounded-2xl border border-[#22263c] bg-[#11131f] p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">Registered users</h2><span className="text-xs text-slate-500">{loading ? 'Loading…' : `${users.length} accounts`}</span></div><div className="flex flex-col gap-2">{users.map((user) => <div key={user.id} className="flex items-center justify-between rounded-lg border border-[#22263c] bg-[#15192b] px-4 py-3"><div><div className="text-sm font-bold">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></div><span className="rounded-md border border-[#5365d4]/30 px-2 py-1 text-[10px] font-bold tracking-wider text-[#8290ff]">{user.role}</span></div>)}</div></section></div></div></main>
}
