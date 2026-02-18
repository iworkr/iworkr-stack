import type { Page } from "@playwright/test";

type Severity = "info" | "step" | "pass" | "fail" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  severity: Severity;
  page?: string;
  message: string;
}

class TestLogger {
  private entries: LogEntry[] = [];
  private stepCount = 0;

  private write(severity: Severity, message: string, pageName?: string) {
    const prefix: Record<Severity, string> = {
      info: "[INFO ]",
      step: "[STEP ]",
      pass: "[ OK  ]",
      fail: "[FAIL ]",
      warn: "[WARN ]",
      error: "[ERROR]",
    };
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      page: pageName,
      message,
    };
    this.entries.push(entry);
    const ctx = pageName ? ` (${pageName})` : "";
    console.log(`${prefix[severity]}${ctx} ${message}`);
  }

  step(message: string, pageName?: string) {
    this.stepCount++;
    this.write("step", `[Step ${this.stepCount}] ${message}`, pageName);
  }

  info(message: string, pageName?: string) {
    this.write("info", message, pageName);
  }

  pass(message: string, pageName?: string) {
    this.write("pass", message, pageName);
  }

  fail(message: string, pageName?: string) {
    this.write("fail", message, pageName);
  }

  warn(message: string, pageName?: string) {
    this.write("warn", message, pageName);
  }

  error(message: string, pageName?: string) {
    this.write("error", message, pageName);
  }

  actionFailed(action: string, selector: string, pageUrl: string) {
    this.write(
      "fail",
      `Could not ${action} '${selector}' on page '${pageUrl}'`
    );
  }

  get summary() {
    const passes = this.entries.filter((e) => e.severity === "pass").length;
    const fails = this.entries.filter((e) => e.severity === "fail").length;
    const warns = this.entries.filter((e) => e.severity === "warn").length;
    return { total: this.entries.length, passes, fails, warns, steps: this.stepCount };
  }

  printSummary() {
    const s = this.summary;
    console.log("\n══════════════════════════════════════════");
    console.log(`  QA Run Summary`);
    console.log(`  Steps: ${s.steps} | Pass: ${s.passes} | Fail: ${s.fails} | Warn: ${s.warns}`);
    console.log("══════════════════════════════════════════\n");
  }
}

export const logger = new TestLogger();

export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

export async function collectNetworkFailures(
  page: Page
): Promise<{ url: string; status: number }[]> {
  const failures: { url: string; status: number }[] = [];
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      failures.push({ url: resp.url(), status: resp.status() });
    }
  });
  return failures;
}
