import 'server-only'
import Stripe from 'stripe'

// Singleton Stripe SDK wrapper. Using a stable apiVersion makes the typed
// surface stable across Stripe SDK upgrades — pin here, bump explicitly.
//
// Both the /api/signup endpoint (creating Checkout sessions) and the
// /api/stripe/webhook (verifying signatures) read this client.

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    // Throw lazily — letting an uninitialized client bubble up gives a
    // clearer dev-time error than silently constructing a misconfigured
    // SDK that fails on first network call.
    throw new Error('STRIPE_SECRET_KEY not set')
  }
  _stripe = new Stripe(key, {
    apiVersion: '2025-08-27.basil',
  })
  return _stripe
}

// Resolve which Stripe Price ID to use for a given tier. Both prices live in
// env so they can be rotated without code changes.
export function priceIdForTier(tier: 'base' | 'bespoke_domain'): string {
  const id =
    tier === 'base'
      ? process.env.STRIPE_PRICE_BASE
      : process.env.STRIPE_PRICE_BESPOKE_DOMAIN
  if (!id) throw new Error(`Stripe price for tier=${tier} not configured`)
  return id
}
