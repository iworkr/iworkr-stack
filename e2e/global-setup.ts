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

    const { data: org, error: orgErr } = await admin.from("organizations").insert({
      name: "QA Test Workspace",
      slug: "qa-test-ws",
    }).select().single();

    if (orgErr) {
      console.warn("Org creation failed:", orgErr.message);
    }

    if (org) {
      await admin.from("organization_members").insert({
        organization_id: (org as any).id,
        user_id: testUser.id,
        role: "owner",
        status: "active",
      });
      console.log("Test user + org + membership created.");
    } else {
      console.warn("No org created — user may not have access to dashboard pages.");
    }
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
  } else if (finalUrl.includes("/setup") || finalUrl.includes("/auth")) {
    console.log(`Redirected to ${finalUrl}. Ensuring profile is onboarded and has active org membership...`);
    const userId = testUser?.id ?? session.session.user.id;
    await admin.from("profiles").upsert({
      id: userId,
      email: TEST_EMAIL,
      full_name: USE_GOLDEN ? "Theo Lewis" : "QA Test Admin",
      onboarding_completed: true,
    });

    // Ensure user has an active org membership (middleware checks this)
    const { data: existingMembership } = await admin
      .from("organization_members")
      .select("organization_id, status")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!existingMembership) {
      // Create org + membership (organizations table has no owner_id column)
      const { data: org, error: orgCreateErr } = await admin.from("organizations").insert({
        name: "QA Test Workspace",
        slug: `qa-test-ws-${Date.now()}`,
      }).select().single();
      if (orgCreateErr) {
        console.warn("Org creation failed:", orgCreateErr.message);
      }
      if (org) {
        await admin.from("organization_members").insert({
          organization_id: (org as any).id,
          user_id: userId,
          role: "owner",
          status: "active",
        });
        console.log("Created org + active membership for test user.");
      }
    } else if (existingMembership.status !== "active") {
      // Fix inactive membership
      await admin
        .from("organization_members")
        .update({ status: "active" })
        .eq("user_id", userId)
        .eq("organization_id", existingMembership.organization_id);
      console.log("Fixed membership status to active.");
    } else {
      console.log("User already has active org membership.");
    }

    // Re-inject cookies after profile update and navigate to dashboard
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForLoadState("networkidle").catch(() => null);
    await page.waitForTimeout(3000);

    // If still redirected to setup, try once more with a fresh page load
    if (page.url().includes("/setup")) {
      console.log("Still on setup — reloading dashboard...");
      await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
      await page.waitForTimeout(3000);
    }

    const postFixUrl = page.url();
    if (postFixUrl.includes("/dashboard")) {
      console.log("Successfully reached dashboard after onboarding fix!");
    } else {
      console.log(`Warning: Still on ${postFixUrl} after onboarding fix.`);
    }
  }

  // ── Seed minimum test data ─────────────────────────────────────
  // Ensure the test workspace has at least basic data for E2E tests
  try {
    const userId = testUser?.id ?? session.session.user.id;

    // Find the user's organization
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (membership) {
      const orgId = membership.organization_id;

      // Seed a test job if none exist
      const { count: jobCount } = await admin
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);

      if (!jobCount || jobCount === 0) {
        console.log("Seeding test data (jobs, clients, invoices)...");
        // Create a test client
        const { data: client } = await admin.from("clients").insert({
          organization_id: orgId,
          name: "Acme Properties",
          email: "acme@example.com",
          phone: "+1-555-0100",
          address: "42 Test Avenue, Melbourne VIC 3000",
        }).select().single();

        const clientId = (client as any)?.id;

        // Create test jobs
        const jobStatuses = ["open", "in_progress", "completed"];
        for (let i = 0; i < 3; i++) {
          await admin.from("jobs").insert({
            organization_id: orgId,
            title: `E2E Test Job ${i + 1} — ${["Plumbing Repair", "HVAC Maintenance", "Electrical Inspection"][i]}`,
            status: jobStatuses[i],
            priority: ["high", "medium", "low"][i],
            ...(clientId ? { client_id: clientId } : {}),
            assigned_to: userId,
            description: `Automated test job created by E2E setup.`,
          });
        }

        // Create a test invoice
        if (clientId) {
          try {
            const { error: invoiceErr } = await admin
              .from("invoices")
              .insert({
                organization_id: orgId,
                client_id: clientId,
                status: "draft",
                amount: 150000, // $1,500.00 in cents
                due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
                line_items: [{ description: "Plumbing repair — labor", quantity: 2, unit_price: 7500 }],
              })
              .select()
              .single();

            if (invoiceErr) {
              throw invoiceErr;
            }
          } catch (invoiceSeedErr) {
            console.warn(
              "Invoice seed skipped:",
              invoiceSeedErr instanceof Error ? invoiceSeedErr.message : invoiceSeedErr
            );
          }
        }

        console.log("Test data seeded successfully.");
      } else {
        console.log(`Test data already exists (${jobCount} jobs).`);
      }
    }
  } catch (seedErr) {
    console.warn("Seed data step skipped:", seedErr instanceof Error ? seedErr.message : seedErr);
  }

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  console.log("Storage state saved.");
});
