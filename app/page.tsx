import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import OperationsConsole from '@/components/operations-console'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  return <OperationsConsole userName={session.user.name} userEmail={session.user.email} />
}
