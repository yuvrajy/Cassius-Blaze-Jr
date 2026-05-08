// Contract: Inngest event names + payload types.
//
// Producer:  any code that fires events — sub-agent 2 (form), sub-agent 6
//            (workflows handlers themselves), sub-agent 7 (cron).
// Consumer:  sub-agent 6 (workflows) — defines an Inngest function for each.
//
// Treat the string in `Events` as the SOURCE OF TRUTH. Do not invent ad-hoc
// event strings elsewhere; add them here first. The discriminated union
// `AppEvent` lets handlers narrow on `event.name`.
//
// Naming: `<noun>.<past-tense-or-state>`. Lowercase, dot-separated.

export const Events = {
  /** Stripe checkout completed for the base tier. Kicks off the full
   *  signup pipeline: name collision check → bio moderation → photo
   *  moderation → Claude article generation → publish. */
  SIGNUP_PAID: 'signup.paid',

  /** Owner edited their profile (bio, tagline, photos, links).
   *  Triggers re-moderation of changed fields and ISR revalidation of
   *  /personal/[subdomain] and the linked article. */
  PROFILE_UPDATED: 'profile.updated',

  /** Either the customer requested takedown via the dashboard, an admin
   *  rejected the profile, expiry hit, or a GDPR request landed. The
   *  handler flips status → taken_down and removes public surfaces. */
  TAKEDOWN_REQUESTED: 'takedown.requested',

  /** Profile expires_at has elapsed. Cron fires this; handler emits a
   *  TAKEDOWN_REQUESTED with requested_by='expiry'. */
  EXPIRY_DUE: 'expiry.due',

  /** Customer paid the bespoke-domain upsell. Triggers the Porkbun buy
   *  + DNS configuration + 301 redirect setup. */
  BESPOKE_DOMAIN_REQUESTED: 'bespoke.domain.requested',
} as const

export type EventName = (typeof Events)[keyof typeof Events]

// =====================================================================
// Payload types — keep these flat and contain only what the handler needs.
// Look up rich data (e.g. full profile rows) from the DB inside the handler;
// don't bloat the event payload.
// =====================================================================

export interface SignupPaidPayload {
  profile_id: string
  user_id: string
  payment_id: string
  /** Stripe checkout session id, kept on the event for idempotency. */
  stripe_session_id: string
}

export interface ProfileUpdatedPayload {
  profile_id: string
  /** Field names that changed in this update; used to skip unnecessary
   *  re-moderation steps (e.g. don't re-check photos if only bio changed). */
  changed_fields: Array<
    'bio' | 'display_name' | 'tagline' | 'photos' | 'social_links'
  >
}

export interface TakedownRequestedPayload {
  profile_id: string
  requested_by: 'customer' | 'admin' | 'expiry' | 'gdpr' | 'moderation'
  reason?: string
}

export interface ExpiryDuePayload {
  profile_id: string
}

export interface BespokeDomainRequestedPayload {
  profile_id: string
  /** Which domain the customer chose at checkout (pre-validated against
   *  Porkbun availability). */
  domain: string
  payment_id: string
}

// Map of event-name → payload shape, in the form Inngest's
// `EventSchemas.fromRecord<>()` expects. Add new events here, keyed by a
// member of `Events`.
//
// Sub-agent 6 passes this map to the Inngest client constructor:
//   new Inngest({ schemas: new EventSchemas().fromRecord<AppEventMap>() })
export interface AppEventMap {
  [Events.SIGNUP_PAID]: { data: SignupPaidPayload }
  [Events.PROFILE_UPDATED]: { data: ProfileUpdatedPayload }
  [Events.TAKEDOWN_REQUESTED]: { data: TakedownRequestedPayload }
  [Events.EXPIRY_DUE]: { data: ExpiryDuePayload }
  [Events.BESPOKE_DOMAIN_REQUESTED]: { data: BespokeDomainRequestedPayload }
}
