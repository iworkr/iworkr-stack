import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const AUTH_STATE = "e2e/.auth/user.json";

const auditModules = [
  "dashboard", "inbox", "jobs", "schedule", "clients",
  "finance", "assets", "forms", "team", "automations",
  "integrations",
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
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // Auth setup (runs first)
    { name: "setup", testMatch: /global-setup\.ts/ },

    // Audit projects (Chrome)
    ...chromeAuditProjects,

    // Smoke — sharded for parallel execution (core + settings run concurrently)
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
    {
      name: "auth-flow",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
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

    // Cross-browser smoke (Firefox + WebKit)
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
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

