import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import fs from "node:fs";

const AUTH_DIR = "playwright/.auth";
const USER_STATE = "playwright/.auth/user.json";
const ADMIN_STATE = "playwright/.auth/admin.json";
const WORKER_STATE = "playwright/.auth/worker.json";
const DB_URL = process.env.PLAYWRIGHT_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "qa-test@iworkrapp.com";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "QATestPass123!";
const WORKER_EMAIL = process.env.PLAYWRIGHT_WORKER_EMAIL ?? "qa-worker@iworkrapp.com";
const WORKER_PASSWORD = process.env.PLAYWRIGHT_WORKER_PASSWORD ?? "QATestPass123!";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProfile(pg: PgClient, userId: string, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const row = await pg.query("SELECT id FROM public.profiles WHERE id = $1 LIMIT 1", [userId]);
    if (row.rowCount) return true;
    await sleep(150);
  }
  return false;
}

async function ensureUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pg: PgClient,
  email: string,
  password: string,
  fullName: string,
  role: string,
) {
  const list = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.data?.users.find((u: { email?: string; id: string }) => u.email?.toLowerCase() === email.toLowerCase());

  let userId = existing?.id;
  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Auth creation failed for ${email}: ${created.error?.message ?? "unknown"}`);
    }
    userId = created.data.user.id;
  } else {
    await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  }

  const profileFound = await waitForProfile(pg, userId);
  if (!profileFound) {
    await pg.query(
      `INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, onboarding_completed = true`,
      [userId, email, fullName],
    );
  } else {
    await pg.query(
      `UPDATE public.profiles SET onboarding_completed = true, email = $2, full_name = $3, updated_at = now() WHERE id = $1`,
      [userId, email, fullName],
    );
  }

  await pg.query(
    `INSERT INTO public.organization_members (organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
    [SEED_ORG_ID, userId, role],
  );

  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role, org_id: SEED_ORG_ID },
  });

  return userId;
}

async function loginAndSaveState(baseURL: string, email: string, password: string, statePath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/auth`);

  const passwordButton = page.getByRole("button", { name: /sign in with password/i });
  if (await passwordButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordButton.click();
  }

  await page.locator("input[type='email']").first().fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).first().click();

  await page.waitForURL(/\/dashboard|\/setup/, { timeout: 20_000 });

  if (page.url().includes("/setup")) {
    console.warn(`⚠️  [Argus] ${email} redirected to /setup — attempting to skip onboarding`);
    const skipBtn = page.getByRole("button", { name: /skip|complete|continue/i });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    }
  }

  // Wait for auth store to initialize with org data before capturing state
  for (let attempt = 0; attempt < 30; attempt++) {
    const orgId = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("iworkr-auth");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state?.currentOrg?.id ?? null;
      } catch { return null; }
    });
    if (orgId) {
      console.log(`  ↳ Auth store populated: org=${orgId}`);
      break;
    }
    await page.waitForTimeout(500);
  }

  await page.context().storageState({ path: statePath });
  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  // ═══════════════════════════════════════════════════════
  // PRODUCTION GUARD — hard abort if running against production
  // ═══════════════════════════════════════════════════════
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "🛑 ARGUS FAILSAFE: Refusing to run E2E tests against VERCEL_ENV=production. " +
      "Set VERCEL_ENV to 'preview' or 'development', or unset it for local testing.",
    );
  }

  const baseURL =
    config.projects[0]?.use?.baseURL?.toString() ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Playwright global setup.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Attempt PG connection with graceful fallback ──────────────────────────
  let pg: PgClient | null = null;
  let pgAvailable = false;

  try {
    pg = new PgClient({ connectionString: DB_URL });
    // Set a connection timeout to avoid hanging
    const connectPromise = pg.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("PG connection timeout")), 5000),
    );
    await Promise.race([connectPromise, timeoutPromise]);
    pgAvailable = true;
  } catch (err) {
    console.warn(
      `⚠️  [Argus-Resilience] Local Postgres unavailable (${(err as Error).message}). ` +
      `Checking for existing auth state files…`,
    );
    pg = null;
  }

  console.log("🚀 [Argus-Resilience] Global setup start");

  // ── If PG available: full seed path ───────────────────────────────────────
  if (pgAvailable && pg) {
    // Ensure the seed org exists (idempotent)
    await pg.query(
      `INSERT INTO public.organizations (id, slug, name, trade, industry_type)
       VALUES ($1, 'qa-e2e-workspace', 'QA E2E Workspace', 'care', 'care')
       ON CONFLICT (id) DO NOTHING`,
      [SEED_ORG_ID],
    );

    const adminId = await ensureUser(supabase, pg, ADMIN_EMAIL, ADMIN_PASSWORD, "QA Admin", "owner");
    const workerId = await ensureUser(supabase, pg, WORKER_EMAIL, WORKER_PASSWORD, "QA Worker", "technician");

    ensureAuthDir();

    await loginAndSaveState(baseURL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE);
    fs.copyFileSync(ADMIN_STATE, USER_STATE);

    await loginAndSaveState(baseURL, WORKER_EMAIL, WORKER_PASSWORD, WORKER_STATE);

    await pg.end();

    console.log(`✅ [Argus-Resilience] Setup complete. org=${SEED_ORG_ID} admin=${adminId} worker=${workerId}`);
    return;
  }

  // ── Fallback: reuse existing auth state files if available ────────────────
  ensureAuthDir();

  const hasAdmin = fs.existsSync(ADMIN_STATE) && fs.statSync(ADMIN_STATE).size > 100;
  const hasWorker = fs.existsSync(WORKER_STATE) && fs.statSync(WORKER_STATE).size > 100;

  if (hasAdmin && hasWorker) {
    // Ensure user.json alias is current
    if (!fs.existsSync(USER_STATE) || fs.statSync(USER_STATE).size < 100) {
      fs.copyFileSync(ADMIN_STATE, USER_STATE);
    }
    console.log(
      `✅ [Argus-Resilience] Reusing existing auth state files (PG unavailable). ` +
      `admin=${ADMIN_STATE} worker=${WORKER_STATE}`,
    );
    return;
  }

  // ── Last resort: try browser-based login without PG seeding ───────────────
  console.log("⚠️  [Argus-Resilience] No cached auth state. Attempting browser login without PG seed…");

  try {
    await loginAndSaveState(baseURL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE);
    fs.copyFileSync(ADMIN_STATE, USER_STATE);
    await loginAndSaveState(baseURL, WORKER_EMAIL, WORKER_PASSWORD, WORKER_STATE);
    console.log("✅ [Argus-Resilience] Browser login succeeded without PG.");
  } catch (loginErr) {
    console.error(
      `❌ [Argus-Resilience] Browser login failed: ${(loginErr as Error).message}. ` +
      `Tests requiring auth will fail.`,
    );
  }
}
