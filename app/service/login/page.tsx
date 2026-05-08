import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  if (await getSession()) redirect('/dashboard')
  const sp = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-heading text-base font-semibold tracking-tight"
        >
          getknown<span className="text-orange-600">.</span>
        </Link>

        <h1 className="mt-10 font-heading text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&rsquo;ll email you a sign-in link. No passwords.
        </p>

        <Suspense>
          <LoginForm error={sp.error} next={sp.next} />
        </Suspense>

        <p className="mt-10 text-xs text-muted-foreground">
          New here?{' '}
          <Link href="/signup" className="underline underline-offset-4 hover:text-foreground">
            Create an account through signup
          </Link>
        </p>
      </div>
    </main>
  )
}
