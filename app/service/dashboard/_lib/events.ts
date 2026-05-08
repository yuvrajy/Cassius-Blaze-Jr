import 'server-only'
import {
  Events,
  type ProfileUpdatedPayload,
  type TakedownRequestedPayload,
} from '@/lib/contracts/events'

// Tiny inngest-event helper. Agent 6 owns lib/inngest/ but hasn't built
// it yet, and the inngest SDK isn't installed at the repo root, so we
// POST to Inngest's public ingest endpoint via fetch. When agent 6 ships
// a typed client, the call sites here (`fireProfileUpdated`,
// `fireTakedownRequested`) can be swapped to that client without
// touching any server actions.
//
// Soft no-op when INNGEST_EVENT_KEY isn't set, so dashboards still
// function in local dev without the event pipeline configured. We log
// and continue — the dashboard mutation should never fail because the
// downstream workflow couldn't be enqueued.

const INGEST_URL_BASE = 'https://inn.gs/e'

async function fire(name: string, data: unknown): Promise<void> {
  const key = process.env.INNGEST_EVENT_KEY
  if (!key) {
    console.warn(`[events] INNGEST_EVENT_KEY missing — dropping ${name}`)
    return
  }
  try {
    await fetch(`${INGEST_URL_BASE}/${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, data }),
    })
  } catch (err) {
    console.error(`[events] failed to send ${name}`, err)
  }
}

export function fireProfileUpdated(payload: ProfileUpdatedPayload) {
  return fire(Events.PROFILE_UPDATED, payload)
}

export function fireTakedownRequested(payload: TakedownRequestedPayload) {
  return fire(Events.TAKEDOWN_REQUESTED, payload)
}
