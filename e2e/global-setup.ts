import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { GOLDEN_EMAIL, GOLDEN_PASSWORD } from "./utils/constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
/** Golden User (Panopticon) or qa-test — set E2E_USE_GOLDEN=1 for theo.caleb.lewis@gmail.com */
const USE_GOLDEN = process.env.E2E_USE_GOLDEN === "1" || process.env.E2E_USE_GOLDEN === "true";
const TEST_EMAIL = USE_GOLDEN ? GOLDEN_EMAIL : "qa-test@iworkrapp.com";
const TEST_PASSWORD = USE_GOLDEN ? GOLDEN_PASSWORD : "QATestPass123!";
const STORAGE_STATE_PATH = "e2e/.auth/user.json";

setup("authenticate via Supabase", async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let testUser: { id: string } | undefined;

  if (USE_GOLDEN) {
    const { data: userList } = await admin.auth.admin.listUsers();
    testUser = userList?.users.find((u) => u.email === GOLDEN_EMAIL) as { id: string } | undefined;
    if (!testUser) {
      console.log("Golden user not found in Supabase; attempting sign-in anyway...");
    }
  }

  if (!USE_GOLDEN) {
  // Find or create the test user
  const { data: userList } = await admin.auth.admin.listUsers();
  testUser = userList?.users.find((u) => u.email === TEST_EMAIL) as { id: string } | undefined;

  if (!testUser) {
    console.log(`Creating test user ${TEST_EMAIL}...`);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      password: TEST_PASSWORD,
    });
    if (error) throw new Error(`Failed to create user: ${error.message}`);
    testUser = created.user;

    // Set up profile + org for the test user
    await admin.from("profiles").upsert({
      id: testUser.id,
      email: TEST_EMAIL,
      full_name: "QA Test Admin",
      onboarding_completed: true,
    });

    const { data: org } = await admin.from("organizations").insert({
      name: "QA Test Workspace",
      slug: "qa-test-ws",
      owner_id: testUser.id,
    }).select().single();

    if (org) {
      await admin.from("organization_members").insert({
        organization_id: (org as any).id,
        user_id: testUser.id,
        role: "owner",
      });
    }
    console.log("Test user + org created.");
  } else {
    // Ensure password is set
    await admin.auth.admin.updateUserById(testUser.id, {
      password: TEST_PASSWORD,
    });
    console.log("Existing test user found, password updated.");
  }
  }

  // Sign in via a standalone Supabase client (non-admin) to get session tokens
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: signInError } = await authClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError || !session.session) {
    console.error("Sign-in failed:", signInError?.message);
    // Save empty state and let tests handle it
    await page.goto("http://localhost:3000/auth");
    await page.context().storageState({ path: STORAGE_STATE_PATH });
    return;
  }

  console.log("Got session tokens, injecting into browser...");

  // Navigate to the app and inject the Supabase session via localStorage
  await page.goto("http://localhost:3000/auth");
  await page.waitForTimeout(1000);

  // Set the Supabase session in localStorage (this is how @supabase/ssr stores it)
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(
    ({ key, sessionData }) => {
      localStorage.setItem(key, JSON.stringify(sessionData));
    },
    {
      key: storageKey,
      sessionData: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
        expires_in: session.session.expires_in,
        token_type: "bearer",
        user: session.session.user,
      },
    }
  );

  // Now navigate to dashboard — the middleware should pick up the session from cookies
  // We also need to set the auth cookie for SSR
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: `base64-${Buffer.from(JSON.stringify({
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
        expires_in: session.session.expires_in,
        token_type: "bearer",
        user: session.session.user,
      })).toString("base64")}`,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: `sb-${projectRef}-auth-token.0`,
      value: Buffer.from(JSON.stringify({
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
        expires_in: session.session.expires_in,
        token_type: "bearer",
      })).toString("base64"),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  console.log("Final URL after auth:", finalUrl);

  if (finalUrl.includes("/dashboard")) {
    console.log("Successfully authenticated and reached dashboard!");
  } else if (finalUrl.includes("/setup")) {
    console.log("Redirected to setup (user may need onboarding). Marking profile as onboarded...");
    const userId = testUser?.id ?? session.session.user.id;
    await admin.from("profiles").upsert({
      id: userId,
      email: TEST_EMAIL,
      full_name: USE_GOLDEN ? "Theo Lewis" : "QA Test Admin",
      onboarding_completed: true,
    });
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForTimeout(2000);
  } else if (finalUrl.includes("/auth")) {
    console.log("Still on auth page — cookie-based auth not picked up by middleware. Will proceed with unauthenticated tests.");
  }

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  console.log("Storage state saved.");
});
