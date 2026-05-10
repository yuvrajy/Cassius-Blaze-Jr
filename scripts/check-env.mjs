// Run with: node --env-file=.env.local scripts/check-env.mjs
//
// Verifies every external service connects with the keys in .env.local.
// Skips checks whose env vars are missing — fill keys in incrementally
// and re-run as you go.

const checks = [
  {
    name: 'Supabase URL + anon key',
    requires: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    run: async () => {
      // Hit a real table endpoint (not /rest/v1/ root, which now 401s
      // with the newer sb_publishable_ key format even when valid).
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=0`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'reachable';
    },
  },
  {
    name: 'Supabase service-role key',
    requires: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    run: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status} — wrong key? (service_role required)`);
      return 'admin access OK';
    },
  },
  {
    name: 'Supabase migrations applied',
    requires: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    run: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=0`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (res.status === 404) throw new Error('profiles table missing — run migrations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'profiles table exists';
    },
  },
  {
    name: 'Supabase anonymous sign-ins enabled',
    requires: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    run: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ data: {} }),
      });
      const data = await res.json().catch(() => ({}));
      const msg = (data.msg || data.error_description || data.error || '').toLowerCase();
      if (msg.includes('anonymous') && msg.includes('disabled')) {
        throw new Error('anonymous sign-ins disabled — enable in dashboard');
      }
      return 'enabled';
    },
  },
  {
    name: 'Anthropic API key',
    requires: ['ANTHROPIC_API_KEY'],
    run: async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
      }
      return 'auth OK';
    },
  },
  {
    name: 'Stripe secret key',
    requires: ['STRIPE_SECRET_KEY'],
    run: async () => {
      const res = await fetch('https://api.stripe.com/v1/charges?limit=1', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
      return `auth OK (${mode} mode)`;
    },
  },
  {
    name: 'Stripe base-tier Price ID',
    requires: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_BASE'],
    run: async () => {
      const res = await fetch(
        `https://api.stripe.com/v1/prices/${process.env.STRIPE_PRICE_BASE}`,
        {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        },
      );
      if (!res.ok) throw new Error(`Price not found (HTTP ${res.status})`);
      const data = await res.json();
      return `${(data.unit_amount / 100).toFixed(2)} ${data.currency.toUpperCase()}`;
    },
  },
  {
    name: 'Resend API key',
    requires: ['RESEND_API_KEY'],
    run: async () => {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const verified = (data.data ?? []).filter((d) => d.status === 'verified');
      if (verified.length === 0) {
        return 'auth OK — but 0 verified domains (mail won\'t deliver until you verify one)';
      }
      return `${verified.length} verified domain(s): ${verified.map((d) => d.name).join(', ')}`;
    },
  },
  {
    name: 'Inngest event key',
    requires: ['INNGEST_EVENT_KEY'],
    run: async () => {
      const res = await fetch(`https://inn.gs/e/${process.env.INNGEST_EVENT_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'env.check', data: { ts: Date.now() } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'event accepted';
    },
  },
  {
    name: 'Domain env vars set',
    requires: ['NEXT_PUBLIC_HUB_DOMAIN', 'NEXT_PUBLIC_PARENT_DOMAIN', 'NEXT_PUBLIC_SERVICE_DOMAIN'],
    run: async () => {
      return `${process.env.NEXT_PUBLIC_HUB_DOMAIN} / ${process.env.NEXT_PUBLIC_PARENT_DOMAIN} / ${process.env.NEXT_PUBLIC_SERVICE_DOMAIN}`;
    },
  },
];

console.log('Checking env vars + service connectivity\n');
let passed = 0;
let failed = 0;
let skipped = 0;

for (const check of checks) {
  const missing = check.requires.filter((r) => !process.env[r]);
  if (missing.length) {
    console.log(`⊘  ${check.name} — skipped (missing: ${missing.join(', ')})`);
    skipped++;
    continue;
  }
  try {
    const result = await check.run();
    console.log(`✓  ${check.name} — ${result}`);
    passed++;
  } catch (e) {
    console.log(`✗  ${check.name} — ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
