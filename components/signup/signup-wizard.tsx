'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Toaster, toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react'
import {
  SignupInput,
  type SignupInput as SignupInputType,
  type SocialLinkInput,
  type PhotoUploadInput,
} from '@/lib/contracts/signup'
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

type Defaults = Omit<SignupInputType, 'tc_accepted' | 'age_confirmed'> & {
  tc_accepted: boolean
  age_confirmed: boolean
}

const DEFAULTS: Defaults = {
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
}

type DraftBlob = {
  session_id: string
  values: Defaults
  step: number
  selfOrPermission: boolean
  override: boolean
  scrolledToBottom: boolean
}

function newSessionId() {
  return crypto.randomUUID()
}

export function SignupWizard() {
  // Non-payload state ---------------------------------------------------
  const [step, setStep] = useState(0)
  const [sessionId, setSessionId] = useState<string>('')
  const [selfOrPermission, setSelfOrPermission] = useState(false)
  const [override, setOverride] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [uniqueness, setUniqueness] = useState<UniquenessState>({ kind: 'idle' })
  const [subdomainState, setSubdomainState] = useState<SubdomainState>({
    kind: 'idle',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitNote, setSubmitNote] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const subdomainTouched = useRef(false)

  const form = useForm<Defaults>({
    // Cast: the resolver is typed for SignupInput (with literal-true checkboxes),
    // but defaults seed unchecked. The resolver only fires at submit and is
    // gated by per-step canContinue logic, so loose checkbox types are fine here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(SignupInput) as any,
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
          setSelfOrPermission(blob.selfOrPermission ?? false)
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

  // Persist on any change.
  useEffect(() => {
    if (!hydrated || !sessionId) return
    const blob: DraftBlob = {
      session_id: sessionId,
      values,
      step,
      selfOrPermission,
      override,
      scrolledToBottom,
    }
    try {
      localStorage.setItem(DRAFT_PREFIX + sessionId, JSON.stringify(blob))
      localStorage.setItem(DRAFT_INDEX_KEY, sessionId)
    } catch {
      // ignore
    }
  }, [hydrated, sessionId, values, step, selfOrPermission, override, scrolledToBottom])

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
          !!values.dob &&
          age !== null &&
          age >= 18 &&
          values.tc_accepted &&
          values.age_confirmed &&
          selfOrPermission &&
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
  }, [step, values, uniqueness, subdomainState, selfOrPermission, override, scrolledToBottom])

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
      const payload: SignupInputType = {
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

  if (!hydrated || !sessionId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
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
              dob={values.dob}
              setDob={v => form.setValue('dob', v)}
              tcAccepted={values.tc_accepted}
              setTcAccepted={v => form.setValue('tc_accepted', v as true)}
              ageConfirmed={values.age_confirmed}
              setAgeConfirmed={v => form.setValue('age_confirmed', v as true)}
              selfOrPermission={selfOrPermission}
              setSelfOrPermission={setSelfOrPermission}
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
              sessionId={sessionId}
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
                tc_accepted: true,
                age_confirmed: true,
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
