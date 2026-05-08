import 'server-only'
import { Inngest } from 'inngest'
import {
  Events,
  type BespokeDomainRequestedPayload,
  type ExpiryDuePayload,
  type ProfileUpdatedPayload,
  type SignupPaidPayload,
  type TakedownRequestedPayload,
} from '@/lib/contracts/events'

// Inngest client. Single source of truth for event ingestion in the app.
// We deliberately don't wire up `EventSchemas.fromRecord<AppEventMap>()`:
// the contract's `AppEventMap` shape doesn't satisfy the SDK's
// `NormalizedEventSchemas` constraint cleanly, and the typed sender helpers
// below already lock payloads down at call sites — any drift between
// producers and consumers will fail at the helper boundary.
//
// In dev (no INNGEST_EVENT_KEY) the SDK still works — events go to the local
// Inngest dev server. We additionally short-circuit external sends behind
// `DEV_MODE_LOG_ONLY` (see lib/inngest/dev.ts) so a developer running the
// signup pipeline without a fully-wired environment never accidentally calls
// out to Stripe / Resend / Sightengine / Anthropic.

export const inngest = new Inngest({
  id: 'getknown',
  eventKey: process.env.INNGEST_EVENT_KEY,
})

// Convenience typed senders. Keeps event names centralized — never call
// `inngest.send({ name: 'signup.paid' })` from elsewhere; use these helpers
// so the literal lives in one file.

export function sendSignupPaid(data: SignupPaidPayload) {
  return inngest.send({ name: Events.SIGNUP_PAID, data })
}

export function sendProfileUpdated(data: ProfileUpdatedPayload) {
  return inngest.send({ name: Events.PROFILE_UPDATED, data })
}

export function sendTakedownRequested(data: TakedownRequestedPayload) {
  return inngest.send({ name: Events.TAKEDOWN_REQUESTED, data })
}

export function sendExpiryDue(data: ExpiryDuePayload) {
  return inngest.send({ name: Events.EXPIRY_DUE, data })
}

export function sendBespokeDomainRequested(data: BespokeDomainRequestedPayload) {
  return inngest.send({ name: Events.BESPOKE_DOMAIN_REQUESTED, data })
}
