import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const ADMIN_STATE  = "playwright/.auth/admin.json";
const WORKER_STATE = "playwright/.auth/worker.json";
/** Legacy alias — kept for backwards compatibility with older spec files */
const AUTH_STATE   = "playwright/.auth/user.json";

const auditModules = [
  "dashboard", "inbox", "jobs", "schedule", "clients",
  "finance", "assets", "forms", "team", "automations",
  "integrations", "gateway-intake", "convoy-fleet", "aegis-dlq",
];

const chromeAuditProjects = auditModules.map((mod) => ({
  name: `${mod}-audit`,
  testMatch: new RegExp(`${mod}\\.spec\\.ts`),
  use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
  dependencies: ["setup"],
}));

export default defineConfig({
  globalSetup: require.resolve("./playwright/global-setup.ts"),
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ["html", { open: process.env.CI ? "never" : "on-failure", outputFolder: "playwright-report" }],
    ["list"],
    ["json", { outputFile: "playwright-report/results.json" }],
    [
      "playwright-qase-reporter",
      {
        mode: process.env.QASE_API_TOKEN ? "testops" : "off",
        debug: !!process.env.QASE_DEBUG,
        testops: {
          api: { token: process.env.QASE_API_TOKEN ?? "" },
          project: process.env.QASE_TESTOPS_PROJECT ?? "IWORKR",
          uploadAttachments: true,
          run: {
            complete: true,
            title: process.env.QASE_TESTOPS_RUN_TITLE ?? "iWorkr Web E2E",
          },
        },
      },
    ],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    // Argus-Tartarus: Full forensic trace for EVERY test
    trace: process.env.CI ? "retain-on-failure" : "on",
    screenshot: "on",
    video: process.env.CI ? "retain-on-failure" : "on",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // ── Legacy setup project placeholder (globalSetup handles auth state) ─────
    { name: "setup", testMatch: /$^/ },

    // ── Audit projects (Chrome, admin session) ───────────────────────────────
    ...chromeAuditProjects,

    // ── Smoke (admin session) ─────────────────────────────────────────────────
    {
      name: "smoke-core",
      testMatch: /smoke-core\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "smoke-settings",
      testMatch: /smoke-settings\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Auth flow (no storageState — tests the login page itself) ─────────────
    {
      name: "auth-flow",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // ── Functional (admin session) ────────────────────────────────────────────
    {
      name: "functional",
      testMatch: /functional\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "settings-audit",
      testMatch: /settings\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "visual",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "comprehensive",
      testMatch: /comprehensive\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "panopticon-golden",
      testMatch: /golden-threads\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── RBAC testing (worker session — restricted access) ─────────────────────
    {
      name: "rbac-worker",
      testMatch: /rbac-worker\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: WORKER_STATE },
      dependencies: ["setup"],
    },

    // ── Admin-explicit (alias for admin.json, used when tests need the owner role) ─
    {
      name: "admin-explicit",
      testMatch: /admin-explicit\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
      dependencies: ["setup"],
    },

    // ── Cross-browser smoke (Firefox + WebKit) ────────────────────────────────
    {
      name: "smoke-firefox",
      testMatch: /smoke(-core|-settings)?\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "smoke-webkit",
      testMatch: /smoke(-core|-settings)?\.spec\.ts/,
      use: { ...devices["Desktop Safari"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Aegis-Chaos: Layer 3 Web Matrix ─────────────────────────────────────
    {
      name: "aegis-cpq",
      testMatch: /aegis\/cpq-engine\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-rbac",
      testMatch: /aegis\/rbac-matrix\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-billing",
      testMatch: /aegis\/billing-math\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-e2e-matrix",
      testMatch: /aegis\/e2e-playwright-matrix\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-golden-threads",
      testMatch: /aegis\/golden-thread-trade\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-driver-golden-care",
      testDir: "./tests/e2e",
      testMatch: /golden-thread-care\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Argus-Omniscience: Deep CRUD Matrices ──────────────────────────────
    {
      name: "argus-auth-flows",
      testDir: "./tests/e2e",
      testMatch: /auth-flows\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "argus-care-module",
      testDir: "./tests/e2e",
      testMatch: /care-module\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "argus-trades-module",
      testDir: "./tests/e2e",
      testMatch: /trades-module\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "argus-navigation",
      testDir: "./tests/e2e",
      testMatch: /navigation\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Argus-Omniscience: Full CRUD Matrix Suite ───────────────────────────
    {
      name: "argus-full",
      testDir: "./tests/e2e",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Argus-Tartarus: Chaos Engineering & Penetration ────────────────────
    {
      name: "tartarus-chaos-budget",
      testDir: "./tests/e2e/chaos",
      testMatch: /race-budget\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tartarus-chaos-roster",
      testDir: "./tests/e2e/chaos",
      testMatch: /roster-race\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tartarus-temporal",
      testDir: "./tests/e2e/chaos",
      testMatch: /temporal-payroll\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tartarus-network",
      testDir: "./tests/e2e/chaos",
      testMatch: /network-partition\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tartarus-full",
      testDir: "./tests/e2e/chaos",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },

    // ── Aegis-Citadel: Security Headers Verification ────────────────────
    {
      name: "citadel-security-headers",
      testDir: "./tests/e2e",
      testMatch: /security-headers\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      // No dependencies — doesn't need auth
    },
    {
      name: "aegis-smoke-firefox",
      testMatch: /aegis\/cpq-engine\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
    {
      name: "aegis-smoke-webkit",
      testMatch: /aegis\/cpq-engine\.spec\.ts/,
      use: { ...devices["Desktop Safari"], storageState: AUTH_STATE },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

