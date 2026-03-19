import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const ADMIN_STATE  = "e2e/.auth/admin.json";
const WORKER_STATE = "e2e/.auth/worker.json";
/** Legacy alias — kept for backwards compatibility with older spec files */
const AUTH_STATE   = "e2e/.auth/user.json";

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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // ── Auth setup (runs first, generates all storageState files) ────────────
    { name: "setup", testMatch: /global-setup\.ts/ },

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
      name: "aegis-golden-threads",
      testMatch: /aegis\/golden-thread-trade\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
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

