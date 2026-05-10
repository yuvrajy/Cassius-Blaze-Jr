'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Toaster, toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, OctagonAlertIcon } from 'lucide-react'
import {
  SignupInput,
  type SignupInput as SignupInputType,
  type SocialLinkInput,
  type PhotoUploadInput,
} from '@/lib/contracts/signup'
import { createClient } from '@/lib/supabase/client'
import {
  TC_VERSION,
  TOTAL_STEPS,
  countWords,
  suggestSubdomain,
  calcAge,
  SUBDOMAIN_REGEX,
  DRAFT_PREFIX,
  DRAFT_INDEX_KEY,
} from './types'
import { StepIndicator } from './step-indicator'
import { StepAgeGate } from './step-age-gate'
import { StepName } from './step-name'
import { StepSubdomain, type SubdomainState } from './step-subdomain'
import { StepBio } from './step-bio'
import { StepTagline } from './step-tagline'
import { StepPhotos } from './step-photos'
import { StepSocial } from './step-social'
import { StepReview } from './step-review'
import { validateSocialLink } from './social-link-row'
import { type UniquenessState } from './uniqueness-indicator'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// In-flight wizard state. Differs from SignupInput in that the literal-true
// checkboxes are mutable booleans during the form, and user_id may briefly be
// empty before signInAnonymously() resolves on mount.
type Defaults = Omit<
  SignupInputType,
  'tc_accepted' | 'age_confirmed' | 'self_or_permission_attested'
> & {
  tc_accepted: boolean
  age_confirmed: boolean
  self_or_permission_attested: boolean
}

const DEFAULTS: Defaults = {
  user_id: '',
  email: '',
  // Always 'base' here — bespoke domain is a dashboard upsell after the
  // customer has a profile, not a wizard branch.
  tier: 'base',
  display_name: '',
  subdomain: '',
  tagline: '',
  bio: '',
  social_links: [],
  photos: [],
  dob: '',
  tc_version: TC_VERSION,
  tc_accepted: false,
  age_confirmed: false,
  self_or_permission_attested: false,
}

type DraftBlob = {
  session_id: string
  values: Defaults
  step: number
  override: boolean
  scrolledToBottom: boolean
}

// What goes wrong with auth on mount. We block the form rather than letting
// the user fill it out only to fail at upload/submit.
type AuthState =
  | { kind: 'pending' }
  | { kind: 'ready'; userId: string }
  | { kind: 'error'; message: string }

function newSessionId() {
  return crypto.randomUUID()
}

export function SignupWizard() {
  // Non-payload state ---------------------------------------------------
  const [step, setStep] = useState(0)
  const [sessionId, setSessionId] = useState<string>('')
  const [override, setOverride] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [uniqueness, setUniqueness] = useState<UniquenessState>({ kind: 'idle' })
  const [subdomainState, setSubdomainState] = useState<SubdomainState>({
    kind: 'idle',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitNote, setSubmitNote] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ kind: 'pending' })
  const subdomainTouched = useRef(false)

  // No zodResolver: per-step gating is manual (see canContinue), and the
  // contract Zod runs once on the assembled payload inside submit(). Wiring
  // a resolver here just for that single safeParse would require a cast
  // because the Defaults type loosens literal-true checkboxes to bools.
  const form = useForm<Defaults>({
    defaultValues: DEFAULTS,
    mode: 'onChange',
  })
  const values = form.watch()

  // Hydrate from localStorage on first mount.
  useEffect(() => {
    let sid: string | null = null
    try {
      sid = localStorage.getItem(DRAFT_INDEX_KEY)
    } catch {
      sid = null
    }
    if (sid) {
      try {
        const raw = localStorage.getItem(DRAFT_PREFIX + sid)
        if (raw) {
          const blob = JSON.parse(raw) as DraftBlob
          setSessionId(blob.session_id)
          form.reset(blob.values)
          setStep(blob.step ?? 0)
          setOverride(blob.override ?? false)
          setScrolledToBottom(blob.scrolledToBottom ?? false)
          setHydrated(true)
          return
        }
      } catch {
        // fall through to fresh session
      }
    }
    const fresh = newSessionId()
    setSessionId(fresh)
    try {
      localStorage.setItem(DRAFT_INDEX_KEY, fresh)
    } catch {
      // localStorage may be disabled (private mode); the wizard still works
      // without persistence.
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Establish (or recover) an anonymous Supabase session on mount. Storage
  // RLS gates uploads on auth.uid() = first folder segment, so we need a
  // user_id before the photos step. Reuse an existing session when present
  // (refresh-resilient) and only call signInAnonymously() on a cold mount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return
        if (session?.user) {
          setAuth({ kind: 'ready', userId: session.user.id })
          form.setValue('user_id', session.user.id)
          return
        }
        const { data, error } = await supabase.auth.signInAnonymously()
        if (cancelled) return
        if (error || !data.user) {
          setAuth({
            kind: 'error',
            message:
              error?.message ??
              'Anonymous sign-in failed. Refresh the page to retry.',
          })
          return
        }
        setAuth({ kind: 'ready', userId: data.user.id })
        form.setValue('user_id', data.user.id)
      } catch (e) {
        if (cancelled) return
        setAuth({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Anonymous sign-in failed.',
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist on any change.
  useEffect(() => {
    if (!hydrated || !sessionId) return
    const blob: DraftBlob = {
      session_id: sessionId,
      values,
      step,
      override,
      scrolledToBottom,
    }
    try {
      localStorage.setItem(DRAFT_PREFIX + sessionId, JSON.stringify(blob))
      localStorage.setItem(DRAFT_INDEX_KEY, sessionId)
    } catch {
      // ignore
    }
  }, [hydrated, sessionId, values, step, override, scrolledToBottom])

  // Auto-suggest subdomain when name lands and the user hasn't touched it.
  useEffect(() => {
    if (!subdomainTouched.current && values.display_name && !values.subdomain) {
      const suggested = suggestSubdomain(values.display_name)
      if (suggested.length >= 2) {
        form.setValue('subdomain', suggested)
      }
    }
  }, [values.display_name, values.subdomain, form])

  // Step validation ----------------------------------------------------
  const canContinue = useMemo(() => {
    switch (step) {
      case 0: {
        const age = calcAge(values.dob)
        return (
          EMAIL_RE.test(values.email) &&
          !!values.dob &&
          age !== null &&
          age >= 18 &&
          values.tc_accepted &&
          values.age_confirmed &&
          values.self_or_permission_attested &&
          scrolledToBottom
        )
      }
      case 1: {
        const len = values.display_name.trim().length
        if (len < 2 || len > 80) return false
        if (uniqueness.kind === 'loading') return false
        if (uniqueness.kind === 'verdict') {
          const sev = uniqueness.verdict.severity
          if (sev >= 4) return false
          if ((sev === 2 || sev === 3) && !override) return false
        }
        return true
      }
      case 2:
        return SUBDOMAIN_REGEX.test(values.subdomain) && subdomainState.kind === 'available'
      case 3: {
        const { words, chars } = countWords(values.bio)
        return words >= 50 && words <= 1000 && chars <= 7000 && chars >= 50
      }
      case 4:
        return (values.tagline?.length ?? 0) <= 120
      case 5: {
        if (values.photos.length < 1) return false
        if (values.photos.length > 5) return false
        const allConsented = values.photos.every(
          p => (p.consent_attested as unknown as boolean) === true,
        )
        const onePrimary = values.photos.filter(p => p.is_primary).length === 1
        return allConsented && onePrimary
      }
      case 6:
        if (values.social_links.length > 6) return false
        return values.social_links.every(
          l => l.value.trim() === '' || validateSocialLink(l) === null,
        )
      case 7:
        return true
      default:
        return false
    }
  }, [step, values, uniqueness, subdomainState, override, scrolledToBottom])

  function goNext() {
    if (!canContinue) return
    if (step === 6) {
      // Strip empty social rows before review.
      form.setValue(
        'social_links',
        values.social_links.filter(l => l.value.trim().length > 0),
      )
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  }
  function goBack() {
    setStep(s => Math.max(s - 1, 0))
  }
  function goTo(target: number) {
    setStep(Math.max(0, Math.min(target, TOTAL_STEPS - 1)))
  }

  async function submit() {
    setSubmitting(true)
    setSubmitNote(null)
    try {
      const userId = auth.kind === 'ready' ? auth.userId : values.user_id
      const payload: SignupInputType = {
        user_id: userId,
        email: values.email.trim(),
        tier: 'base',
        display_name: values.display_name.trim(),
        subdomain: values.subdomain,
        tagline: values.tagline?.trim() ? values.tagline.trim() : undefined,
        bio: values.bio,
        social_links: values.social_links
          .filter(l => l.value.trim().length > 0)
          .map<SocialLinkInput>(l => ({ platform: l.platform, value: l.value.trim() })),
        photos: values.photos.map<PhotoUploadInput>((p, i) => ({
          storage_path: p.storage_path,
          is_primary: p.is_primary,
          sort_order: i as 0 | 1 | 2 | 3 | 4,
          consent_attested: true,
        })),
        dob: values.dob,
        tc_version: TC_VERSION,
        tc_accepted: true,
        age_confirmed: true,
        self_or_permission_attested: true,
      }

      // Final guard: run the contract Zod against the assembled payload.
      const parsed = SignupInput.safeParse(payload)
      if (!parsed.success) {
        setSubmitNote(
          'Some fields look off. Use the Edit links above to fix them.',
        )
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (res.status === 501) {
        setSubmitNote(
          '[signup stub — agent 6 will implement; no charge made]',
        )
        toast.info('Stub mode: payload validated, no charge made.')
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        setSubmitNote(`Submit failed (${res.status}). ${txt}`)
        setSubmitting(false)
        return
      }
      const data = (await res.json()) as { checkoutUrl?: string }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      setSubmitNote('Submit succeeded but no checkout URL was returned.')
    } catch (e) {
      setSubmitNote(e instanceof Error ? e.message : 'Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!hydrated || !sessionId || auth.kind === 'pending') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (auth.kind === 'error') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <OctagonAlertIcon className="size-8 text-destructive" />
        <h1 className="mt-4 font-heading text-xl font-semibold tracking-tight">
          We couldn’t start your draft
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{auth.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg border bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Toaster richColors closeButton />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
          <Link href="/" className="font-heading text-base font-semibold tracking-tight">
            getknown<span className="text-orange-600">.</span>
          </Link>
          <button
            type="button"
            onClick={() => window.close()}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Save & exit
          </button>
        </div>
        <div className="mx-auto max-w-2xl px-6 pb-3">
          <StepIndicator step={step} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <form onSubmit={e => e.preventDefault()}>
          {step === 0 && (
            <StepAgeGate
              email={values.email}
              setEmail={v => form.setValue('email', v)}
              dob={values.dob}
              setDob={v => form.setValue('dob', v)}
              tcAccepted={values.tc_accepted}
              setTcAccepted={v => form.setValue('tc_accepted', v as true)}
              ageConfirmed={values.age_confirmed}
              setAgeConfirmed={v => form.setValue('age_confirmed', v as true)}
              selfOrPermission={values.self_or_permission_attested}
              setSelfOrPermission={v =>
                form.setValue('self_or_permission_attested', v as true)
              }
              scrolledToBottom={scrolledToBottom}
              setScrolledToBottom={setScrolledToBottom}
            />
          )}
          {step === 1 && (
            <StepName
              value={values.display_name}
              onChange={v => form.setValue('display_name', v)}
              override={override}
              setOverride={setOverride}
              uniqueness={uniqueness}
              setUniqueness={setUniqueness}
            />
          )}
          {step === 2 && (
            <StepSubdomain
              value={values.subdomain}
              onChange={v => {
                subdomainTouched.current = true
                form.setValue('subdomain', v)
              }}
              state={subdomainState}
              setState={setSubdomainState}
            />
          )}
          {step === 3 && (
            <StepBio
              value={values.bio}
              onChange={v => form.setValue('bio', v)}
            />
          )}
          {step === 4 && (
            <StepTagline
              value={values.tagline ?? ''}
              onChange={v => form.setValue('tagline', v)}
            />
          )}
          {step === 5 && (
            <StepPhotos
              userId={auth.userId}
              photos={values.photos}
              setPhotos={next => form.setValue('photos', next)}
            />
          )}
          {step === 6 && (
            <StepSocial
              links={values.social_links}
              setLinks={next => form.setValue('social_links', next)}
            />
          )}
          {step === 7 && (
            <StepReview
              values={{
                ...values,
                user_id: auth.userId,
                tier: 'base',
                tc_accepted: true,
                age_confirmed: true,
                self_or_permission_attested: true,
                tc_version: TC_VERSION,
              } as SignupInputType}
              goTo={goTo}
            />
          )}
        </form>

        {submitNote && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {submitNote}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={goBack}
            disabled={step === 0}
          >
            <ArrowLeftIcon className="size-4" /> Back
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button
              type="button"
              className="h-10 px-5"
              onClick={goNext}
              disabled={!canContinue}
            >
              Continue <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-10 px-6"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>Pay & publish</>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
