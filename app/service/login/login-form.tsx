'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const Schema = z.object({ email: z.string().email() })
type FormValues = z.infer<typeof Schema>

const LOGIN_ERRORS: Record<string, string> = {
  exchange_failed: 'That sign-in link couldn’t be used. Try again.',
  expired: 'That sign-in link expired. Send yourself a new one.',
  invalid_redirect: 'Sign-in succeeded, but the redirect target was invalid.',
}

export function LoginForm({ error, next }: { error?: string; next?: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (error && LOGIN_ERRORS[error]) toast.error(LOGIN_ERRORS[error])
  }, [error])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(Schema) })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const serviceDomain =
        process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? window.location.host
      const protocol =
        window.location.hostname === 'localhost' ? 'http' : 'https'
      const callback = new URL(`${protocol}://${serviceDomain}/auth/callback`)
      if (next) callback.searchParams.set('next', next)

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: { emailRedirectTo: callback.toString() },
      })
      if (authError) {
        toast.error(authError.message)
        return
      }
      router.push(`/login/check-email?email=${encodeURIComponent(values.email)}`)
    } catch (err) {
      console.error('[login] unexpected error', err)
      toast.error('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">
            {errors.email.message ?? 'Enter a valid email'}
          </p>
        )}
      </div>
      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  )
}
