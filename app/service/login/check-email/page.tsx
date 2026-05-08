import Link from 'next/link'

export const metadata = { title: 'Check your email' }

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

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
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {email ? (
            <>
              We sent a sign-in link to{' '}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            <>We sent you a sign-in link.</>
          )}{' '}
          Click it and you&rsquo;ll be signed in here.
        </p>

        <p className="mt-6 text-xs text-muted-foreground">
          Didn&rsquo;t get it? Check your spam folder.
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Use a different email
          </Link>
        </p>
      </div>
    </main>
  )
}
