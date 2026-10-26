import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignUpPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-10 text-white"><section className="w-full max-w-md rounded-2xl border border-[#22263c] bg-[#11131f] p-6 shadow-2xl"><div className="mb-8 text-[10px] font-bold tracking-[0.22em] text-[#8290ff]">FIELD PERSONNEL ONBOARDING</div><h1 className="mb-2 text-2xl font-black">Create your MOS account</h1><p className="mb-6 text-sm text-slate-400">Use your official details to access field operations.</p><AuthForm mode="sign-up" /><p className="mt-6 text-center text-xs text-slate-500">Already registered? <Link className="font-bold text-[#8290ff] hover:text-white" href="/sign-in">Sign in</Link></p></section></main>
}
