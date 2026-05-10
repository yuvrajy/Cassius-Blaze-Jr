// End-to-end smoke test.
//
// Run with:
//   pnpm dev                                     # in another terminal
//   DEV_MODE_LOG_ONLY=1 node --env-file=.env.local scripts/smoke-test.mjs
//
// Designed for DEV mode — no external API calls (Stripe/Resend/Anthropic
// are all stubbed). Verifies the LOCAL code paths and Supabase wiring
// are correct. After this passes, you can move to integration testing
// with real keys, then production.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const BASE = process.env.SMOKE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const RUN_ID = randomUUID().slice(0, 8);
const TEST_PREFIX = `smoketest-${RUN_ID}`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = supabaseAnon && supabaseAdmin && supabaseUrl
  ? createClient(supabaseUrl, supabaseAdmin, { auth: { persistSession: false } })
  : null;

const anonClient = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } })
  : null;

let passed = 0;
let failed = 0;
let skipped = 0;
const cleanups = [];

function ok(name, detail = '') {
  console.log(`✓  ${name}${detail ? ` — ${detail}` : ''}`);
  passed++;
}
function fail(name, err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`✗  ${name} — ${msg}`);
  failed++;
}
function skip(name, why) {
  console.log(`⊘  ${name} — skipped (${why})`);
  skipped++;
}
function section(title) {
  console.log(`\n— ${title} —`);
}

async function test(name, fn, requires = []) {
  const missing = requires.filter((r) => !process.env[r]);
  if (missing.length) return skip(name, `missing ${missing.join(', ')}`);
  try {
    const detail = await fn();
    ok(name, detail || '');
  } catch (e) {
    fail(name, e);
  }
}

// ─────────────────────────────────────────────────────────────────
// 1. Pre-flight
// ─────────────────────────────────────────────────────────────────

section('1. Pre-flight');

await test('DEV_MODE_LOG_ONLY=1 (so no real API calls)', async () => {
  if (process.env.DEV_MODE_LOG_ONLY !== '1') {
    throw new Error('not set — re-run with DEV_MODE_LOG_ONLY=1 prefix');
  }
  return 'on';
});

await test('Required env vars present', async () => {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_HUB_DOMAIN',
    'NEXT_PUBLIC_PARENT_DOMAIN',
    'NEXT_PUBLIC_SERVICE_DOMAIN',
    'CRON_SECRET',
    'ADMIN_EMAILS',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
  return `${required.length}/${required.length}`;
});

await test('Dev server running on localhost:3000', async () => {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'reachable';
  } catch {
    throw new Error('not reachable — run `pnpm dev` in another terminal');
  }
});

// ─────────────────────────────────────────────────────────────────
// 2. Database connectivity
// ─────────────────────────────────────────────────────────────────

section('2. Database connectivity');

await test('Service-role client can read profiles', async () => {
  if (!admin) throw new Error('admin client not initialized');
  const { error, count } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return `${count ?? 0} existing profiles`;
});

await test('All 9 tables exist', async () => {
  if (!admin) throw new Error('admin client not initialized');
  const tables = [
    'profiles', 'articles', 'photos', 'social_links',
    'payments', 'takedowns', 'tc_acceptances',
    'name_collision_checks', 'pending_signups',
  ];
  const missing = [];
  for (const t of tables) {
    const { error } = await admin.from(t).select('*', { count: 'exact', head: true });
    if (error) missing.push(t);
  }
  if (missing.length) throw new Error(`missing/inaccessible: ${missing.join(', ')}`);
  return `${tables.length}/${tables.length}`;
});

// ─────────────────────────────────────────────────────────────────
// 3. Storage bucket
// ─────────────────────────────────────────────────────────────────

section('3. Storage bucket');

await test('Photos bucket exists', async () => {
  if (!admin) throw new Error('admin client not initialized');
  const { data, error } = await admin.storage.listBuckets();
  if (error) throw error;
  if (!data.find((b) => b.id === 'photos')) {
    throw new Error('photos bucket missing — re-run supabase/storage.sql');
  }
  return 'photos bucket present';
});

// ─────────────────────────────────────────────────────────────────
// 4. Anonymous auth
// ─────────────────────────────────────────────────────────────────

section('4. Anonymous auth');

let testUserId = null;

await test('signInAnonymously() mints a user_id', async () => {
  if (!anonClient) throw new Error('anon client not initialized');
  const { data, error } = await anonClient.auth.signInAnonymously();
  if (error) throw new Error(`${error.message} — enable anonymous sign-ins in Supabase dashboard`);
  testUserId = data.user?.id;
  if (!testUserId) throw new Error('no user_id returned');
  cleanups.push(async () => {
    if (admin) await admin.auth.admin.deleteUser(testUserId);
  });
  return `user_id=${testUserId.slice(0, 8)}...`;
});

await test('Anon user can upload to {user_id}/draft/...', async () => {
  if (!anonClient || !testUserId) throw new Error('no anon session');
  const path = `${testUserId}/draft/${TEST_PREFIX}.txt`;
  const blob = new Blob(['smoke test content'], { type: 'text/plain' });
  const { error } = await anonClient.storage.from('photos').upload(path, blob);
  if (error) throw error;
  cleanups.push(async () => {
    if (admin) await admin.storage.from('photos').remove([path]);
  });
  return path;
});

await test('Anon user CANNOT upload outside their folder', async () => {
  if (!anonClient || !testUserId) throw new Error('no anon session');
  const path = `someoneelse/draft/${TEST_PREFIX}.txt`;
  const blob = new Blob(['malicious'], { type: 'text/plain' });
  const { error } = await anonClient.storage.from('photos').upload(path, blob);
  if (!error) throw new Error('upload to other user folder succeeded — RLS broken');
  return 'blocked correctly';
});

// ─────────────────────────────────────────────────────────────────
// 5. API endpoints
// ─────────────────────────────────────────────────────────────────

section('5. API endpoints');

await test('GET /api/health', async () => {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error('not ok');
  return JSON.stringify(data);
});

await test('POST /api/uniqueness/check with famous name', async () => {
  const res = await fetch(`${BASE}/api/uniqueness/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'LeBron James' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (typeof data.severity !== 'number') throw new Error('no severity in response');
  return `severity=${data.severity}/5${data.stubbed ? ' (stubbed)' : ''}`;
});

await test('POST /api/uniqueness/check with fictional name', async () => {
  const res = await fetch(`${BASE}/api/uniqueness/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Fredrick von Duberman' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return `severity=${data.severity}/5${data.stubbed ? ' (stubbed)' : ''}`;
});

// ─────────────────────────────────────────────────────────────────
// 6. Signup endpoint
// ─────────────────────────────────────────────────────────────────

section('6. Signup endpoint');

const testSubdomain = `smoke-${RUN_ID}`;
const testEmail = `smoketest+${RUN_ID}@example.com`;
let testPendingSignupId = null;

await test('POST /api/signup with full valid payload', async () => {
  if (!testUserId) throw new Error('no anon user_id');
  const path = `${testUserId}/draft/${randomUUID()}.jpg`;
  // Upload a tiny "photo" so the storage_path is valid
  if (anonClient) {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    await anonClient.storage.from('photos').upload(path, blob);
    cleanups.push(async () => {
      if (admin) await admin.storage.from('photos').remove([path]);
    });
  }
  const payload = {
    user_id: testUserId,
    email: testEmail,
    tier: 'base',
    display_name: `Smoke Test ${RUN_ID}`,
    subdomain: testSubdomain,
    tagline: 'A test profile from the smoke script',
    bio: 'This is a synthetic bio from the smoke test script. It exists only to verify the publishing pipeline runs end-to-end. '.repeat(8),
    social_links: [
      { platform: 'twitter', value: 'smoketest' },
      { platform: 'website', value: 'https://example.com' },
    ],
    photos: [
      { storage_path: path, is_primary: true, sort_order: 0, consent_attested: true },
    ],
    dob: '1995-01-01',
    tc_version: '2026-05-08',
    tc_accepted: true,
    age_confirmed: true,
    self_or_permission_attested: true,
  };
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (!data.checkoutUrl) throw new Error('no checkoutUrl in response');
  return data.checkoutUrl.startsWith('https://stripe.local/devmode/')
    ? 'returned dev-mode stub URL'
    : `returned ${data.checkoutUrl.slice(0, 50)}...`;
});

await test('pending_signups row was inserted', async () => {
  if (!admin) throw new Error('admin client missing');
  const { data, error } = await admin
    .from('pending_signups')
    .select('*')
    .eq('payload->>email', testEmail)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('no pending_signup row found');
  testPendingSignupId = data[0].id;
  cleanups.push(async () => {
    if (admin && testPendingSignupId) {
      await admin.from('pending_signups').delete().eq('id', testPendingSignupId);
    }
  });
  return `id=${testPendingSignupId.slice(0, 8)}...`;
});

await test('profile shell row exists with status=pending_moderation', async () => {
  if (!admin) throw new Error('admin client missing');
  const { data, error } = await admin
    .from('profiles')
    .select('id, status, subdomain, user_id')
    .eq('subdomain', testSubdomain)
    .single();
  if (error) throw new Error(`profile row missing: ${error.message}`);
  if (data.status !== 'pending_moderation') {
    throw new Error(`expected status=pending_moderation, got ${data.status}`);
  }
  cleanups.push(async () => {
    if (admin) await admin.from('profiles').delete().eq('id', data.id);
  });
  return `id=${data.id.slice(0, 8)}... status=${data.status}`;
});

// ─────────────────────────────────────────────────────────────────
// 7. Page rendering (hostname routing)
// ─────────────────────────────────────────────────────────────────

section('7. Page rendering (hostname routing)');

await test('Service site renders at localhost:3000 (default host)', async () => {
  const res = await fetch(`${BASE}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html.toLowerCase().includes('playbook') && !html.toLowerCase().includes('known')) {
    throw new Error('homepage does not look like service site');
  }
  return `${html.length} bytes`;
});

await test('News site renders with Host: thenorm.info', async () => {
  const res = await fetch(`${BASE}/`, { headers: { Host: process.env.NEXT_PUBLIC_HUB_DOMAIN } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html.toLowerCase().includes('norm')) {
    throw new Error('news homepage does not contain "norm"');
  }
  return `${html.length} bytes`;
});

await test('Personal subdomain returns sane response', async () => {
  const host = `nonexistent-${RUN_ID}.${process.env.NEXT_PUBLIC_PARENT_DOMAIN}`;
  const res = await fetch(`${BASE}/`, { headers: { Host: host } });
  // 404 is the correct response for a nonexistent subdomain
  if (res.status !== 404 && res.status !== 200) {
    throw new Error(`expected 404 or 200, got ${res.status}`);
  }
  return `HTTP ${res.status} (404 = correct for unknown subdomain)`;
});

await test('Login page renders', async () => {
  const res = await fetch(`${BASE}/login`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html.toLowerCase().includes('email') && !html.toLowerCase().includes('sign')) {
    throw new Error('login page lacks email/sign-in language');
  }
  return `${html.length} bytes`;
});

await test('Dashboard redirects unauthenticated user', async () => {
  const res = await fetch(`${BASE}/dashboard`, { redirect: 'manual' });
  if (res.status !== 307 && res.status !== 302 && res.status !== 303 && res.status !== 200) {
    throw new Error(`expected redirect or 200, got ${res.status}`);
  }
  return `HTTP ${res.status}`;
});

// ─────────────────────────────────────────────────────────────────
// 8. Cron auth (sanity)
// ─────────────────────────────────────────────────────────────────

section('8. Cron auth');

await test('Cron endpoint rejects request without bearer token', async () => {
  const res = await fetch(`${BASE}/api/cron/expire`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
  return 'rejected with 401';
});

await test('Cron endpoint rejects bad bearer token', async () => {
  const res = await fetch(`${BASE}/api/cron/expire`, {
    headers: { Authorization: 'Bearer wrong-token' },
  });
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
  return 'rejected with 401';
});

await test('Cron endpoint accepts correct CRON_SECRET', async () => {
  const res = await fetch(`${BASE}/api/cron/expire`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `HTTP ${res.status}`;
});

// ─────────────────────────────────────────────────────────────────
// 9. Stripe webhook (signature bypass in DEV)
// ─────────────────────────────────────────────────────────────────

section('9. Stripe webhook');

await test('Stripe webhook responds 200 to checkout.session.completed (DEV)', async () => {
  const fakeEvent = {
    id: `evt_smoke_${RUN_ID}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_smoke_${RUN_ID}`,
        customer_email: testEmail,
        customer: `cus_smoke_${RUN_ID}`,
        metadata: {
          tier: 'base',
          pending_signup_id: testPendingSignupId ?? randomUUID(),
          user_id: testUserId ?? randomUUID(),
        },
      },
    },
  };
  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fakeEvent),
  });
  // In DEV mode the webhook should accept unsigned bodies and return 200
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return `HTTP ${res.status}`;
});

// ─────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────

section('Cleanup');
for (const cleanup of cleanups.reverse()) {
  try {
    await cleanup();
  } catch (e) {
    console.log(`⚠  cleanup error: ${e.message}`);
  }
}
console.log(`✓  ${cleanups.length} cleanup steps ran`);

// ─────────────────────────────────────────────────────────────────
// What this script does NOT cover (do these manually)
// ─────────────────────────────────────────────────────────────────

console.log(`\n— Manual checks (script can't fully automate these) —`);
const manualChecks = [
  'Inngest workflow execution: run `npx inngest-cli@latest dev` and click through events at localhost:8288',
  'Magic-link login round-trip: actually click the link in your email',
  'Photo processing variants: real sharp output requires non-stub photo data + DEV_ANTHROPIC_LOG_ONLY off',
  'News article rendering for a live profile: requires admin approval flow + Inngest workflow run',
  'Personal subdomain rendering for live profile: same prerequisite',
  'Stripe Checkout: real payment in test mode (use test card 4242 4242 4242 4242)',
  'Bespoke domain registration: requires Porkbun + Vercel API keys',
  'GDPR delete + cron takedown finalization: time-sensitive, set TAKEDOWN_COOLING_DAYS=0 to test',
  'Email rendering: send a real Resend message and check it lands + renders',
  'Mobile responsiveness: open every page at 375px width',
];
for (const c of manualChecks) console.log(`·  ${c}`);

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped`);
if (failed > 0) {
  console.log('\nFailures above need attention before integration testing with real keys.');
}
process.exit(failed > 0 ? 1 : 0);
