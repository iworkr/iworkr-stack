/**
 * Project Genesis — Playwright Global Setup
 *
 * Performs API-level authentication ONCE per test run for each role,
 * saving Supabase session cookies to storageState JSON files.
 *
 * This eliminates ~19 minutes of redundant UI login across 379 tests.
 *
 * Output files:
 *   e2e/.auth/admin.json      — QA Owner  (qa-test@iworkrapp.com)
 *   e2e/.auth/worker.json     — QA Worker (qa-worker@iworkrapp.com)
 *   e2e/.auth/user.json       — Alias for admin.json (backwards compat)
 */

import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL            = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * If E2E_USE_GOLDEN=1, target the real production owner account
 * (for deep panopticon runs on staging). Otherwise use the deterministic
 * QA seed users that are injected by seed.sql.
 */
const USE_GOLDEN    = process.env.E2E_USE_GOLDEN === "1" || process.env.E2E_USE_GOLDEN === "true";
const GOLDEN_EMAIL  = process.env.GOLDEN_EMAIL ?? "theo.caleb.lewis@gmail.com";
const GOLDEN_PASS   = process.env.GOLDEN_PASSWORD ?? "";

const QA_USERS = {
  admin: {
    email:    "qa-test@iworkrapp.com",
    password: "QATestPass123!",
    stateFile:"e2e/.auth/admin.json",
    role:     "owner",
  },
  worker: {
    email:    "qa-worker@iworkrapp.com",
    password: "QATestPass123!",
    stateFile:"e2e/.auth/worker.json",
    role:     "technician",
  },
} as const;

const QA_ORG_ID = "00000000-0000-0000-0000-000000000010";
const AUTH_DIR  = "e2e/.auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

/**
 * Derive the Supabase cookie prefix from the project URL.
 * For https://olqjuadvseoxpfjzlghb.supabase.co → "olqjuadvseoxpfjzlghb"
 * For http://127.0.0.1:54321 → "127"
 */
function getProjectRef(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0];
  } catch {
    return "local";
  }
}

/**
 * Build Playwright storageState cookies from a Supabase session.
 * The @supabase/ssr package reads chunked base64 cookies:
 *   sb-<ref>-auth-token.0  — first chunk (access + refresh token)
 *   sb-<ref>-auth-token.1  — second chunk (user object)
 *
 * We write both the chunked format AND a single-cookie fallback so
 * both SSR middleware and client-side JS pick up the session.
 */
function buildStorageState(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: Record<string, unknown>;
}, projectRef: string, domain: string) {
  const sessionPayload = JSON.stringify({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_at:    session.expires_at,
    expires_in:    session.expires_in,
    token_type:    "bearer",
    user:          session.user,
  });

  const encoded = Buffer.from(sessionPayload).toString("base64");

  // Split into ~3800-char chunks (Supabase SSR default chunk size)
  const CHUNK = 3800;
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += CHUNK) {
    chunks.push(encoded.slice(i, i + CHUNK));
  }

  const baseCookieName = `sb-${projectRef}-auth-token`;
  const expires = Math.round(Date.now() / 1000) + 7200; // +2h

  const cookies = chunks.map((chunk, idx) => ({
    name:     `${baseCookieName}.${idx}`,
    value:    chunk,
    domain,
    path:     "/",
    expires,
    httpOnly: false,
    secure:   false,
    sameSite: "Lax" as const,
  }));

  // Single-cookie fallback for environments that don't use chunks
  cookies.push({
    name:     baseCookieName,
    value:    `base64-${encoded}`,
    domain,
    path:     "/",
    expires,
    httpOnly: false,
    secure:   false,
    sameSite: "Lax" as const,
  });

  return { cookies, origins: [] as unknown[] };
}

/**
 * Ensure a QA user exists via the Admin API. If they're already in the DB
 * (seeded by seed.sql), this is a no-op. Falls back to createUser if missing.
 */
async function ensureUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  fullName: string,
): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    // Ensure password is correct (seed may not have run on this environment)
    await admin.auth.admin.updateUserById(existing.id, { password });
    console.log(`  ✓ User exists: ${email} (${existing.id.slice(0, 8)}…)`);
    return existing.id;
  }

  // Not in DB — create via Admin API (bypasses email confirmation)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    throw new Error(`Failed to create ${email}: ${error?.message}`);
  }

  console.log(`  ✓ Created user: ${email} (${created.user.id.slice(0, 8)}…)`);
  return created.user.id;
}

/**
 * Ensure the user has an active organization membership.
 * If not, create an org and bind them.
 */
async function ensureMembership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  role: string,
  email: string,
) {
  // Ensure profile exists
  await admin.from("profiles").upsert(
    { id: userId, email, full_name: email.split("@")[0], onboarding_completed: true },
    { onConflict: "id" }
  );

  // Check for membership in QA org first
  const { data: existing } = await admin
    .from("organization_members")
    .select("organization_id, status")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing?.status === "active") {
    console.log(`  ✓ Membership OK for ${email}`);
    return;
  }

  // Try to use the deterministic QA org, fall back to creating a new one
  let orgId = QA_ORG_ID;

  const { data: qaOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("id", QA_ORG_ID)
    .maybeSingle();

  if (!qaOrg) {
    const { data: newOrg, error: orgErr } = await admin
      .from("organizations")
      .insert({ slug: `e2e-ws-${Date.now()}`, name: "E2E QA Workspace", trade: "care" })
      .select()
      .single();
    if (orgErr) {
      console.warn(`  ⚠ Could not create org: ${orgErr.message}`);
      return;
    }
    orgId = newOrg.id;
  }

  await admin
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: userId, role, status: "active" },
      { onConflict: "organization_id,user_id" }
    );

  console.log(`  ✓ Membership created for ${email} (role: ${role})`);
}

/**
 * Sign in via the Supabase JS client (non-admin), extract session,
 * build cookie storageState, save to file, and write to the browser context.
 */
async function authenticateAndSave(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  outputPath: string,
  label: string,
): Promise<boolean> {
  const projectRef = getProjectRef(SUPABASE_URL);
  const domain = new URL(BASE_URL).hostname;

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    console.error(`  ✗ Sign-in failed for ${label}: ${error?.message ?? "no session"}`);
    return false;
  }

  console.log(`  ✓ Session acquired for ${label}`);

  const storageState = buildStorageState(data.session, projectRef, domain);

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(storageState, null, 2));
  console.log(`  ✓ Saved storageState → ${outputPath}`);

  // Inject into the live browser context for the verification step
  await page.context().addCookies(storageState.cookies);

  return true;
}

// ── Main setup test ───────────────────────────────────────────────────────────

setup("Genesis: authenticate all roles via API", async ({ page }) => {
  ensureAuthDir();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Handle Golden User mode (panopticon runs) ─────────────────────────────
  if (USE_GOLDEN) {
    console.log("\n[Genesis] Golden User mode — targeting production owner account");

    const success = await authenticateAndSave(
      page,
      GOLDEN_EMAIL,
      GOLDEN_PASS,
      "e2e/.auth/admin.json",
      "golden",
    );

    if (!success) {
      console.warn("[Genesis] Golden sign-in failed — saving empty state");
      await page.goto(`${BASE_URL}/auth`);
      await page.context().storageState({ path: "e2e/.auth/admin.json" });
      return;
    }

    // Write legacy alias
    fs.copyFileSync("e2e/.auth/admin.json", "e2e/.auth/user.json");
    await verifySession(page, "golden");
    return;
  }

  // ── Standard QA mode: provision all 2 deterministic roles ─────────────────
  console.log("\n[Genesis] Provisioning QA test users…");

  for (const [roleKey, cfg] of Object.entries(QA_USERS)) {
    console.log(`\n[Genesis] ── Role: ${roleKey} (${cfg.email})`);

    const userId = await ensureUser(admin, cfg.email, cfg.password, `QA ${roleKey}`);
    await ensureMembership(admin, userId, cfg.role, cfg.email);

    const success = await authenticateAndSave(
      page,
      cfg.email,
      cfg.password,
      cfg.stateFile,
      roleKey,
    );

    if (!success) {
      console.warn(`[Genesis] Sign-in failed for ${roleKey} — tests using this role will redirect to /auth`);
    }
  }

  // Write legacy alias: user.json = admin.json (backwards compat for older specs)
  if (fs.existsSync("e2e/.auth/admin.json")) {
    fs.copyFileSync("e2e/.auth/admin.json", "e2e/.auth/user.json");
    console.log("\n  ✓ Wrote e2e/.auth/user.json (admin alias)");
  }

  // ── Verify the admin session reaches the dashboard ────────────────────────
  await verifySession(page, "admin");
});

async function verifySession(page: import("@playwright/test").Page, role: string) {
  console.log(`\n[Genesis] Verifying ${role} session reaches /dashboard…`);
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForTimeout(2500);

  const url = page.url();

  if (url.includes("/dashboard")) {
    console.log(`  ✓ ${role} session verified — reached dashboard (${url})`);
  } else if (url.includes("/setup") || url.includes("/onboarding")) {
    // Onboarding redirect means the middleware accepted the JWT but the
    // workspace setup hasn't been flagged complete. This is recoverable by
    // the individual tests — we still save the state.
    console.log(`  ⚠ ${role} session redirected to setup page (${url}) — check onboarding_completed flag`);
  } else if (url.includes("/auth")) {
    console.warn(`  ✗ ${role} session invalid — redirected to /auth. Tests WILL fail.`);
  } else {
    console.log(`  ? ${role} session landed on: ${url}`);
  }

  // Capture final state after navigation (includes any new cookies set by SSR)
  const stateFile = role === "admin" || role === "golden" ? "e2e/.auth/admin.json" : `e2e/.auth/${role}.json`;
  await page.context().storageState({ path: stateFile });

  // Refresh the legacy alias after final state capture
  if (role === "admin" || role === "golden") {
    fs.copyFileSync(stateFile, "e2e/.auth/user.json");
  }

  console.log(`  ✓ Final storageState written → ${stateFile}`);
}
