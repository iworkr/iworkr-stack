import * as Sentry from "@sentry/electron/main";
import { app } from "electron";
import log from "electron-log/main";

// INCOMPLETE:PARTIAL — SENTRY_DSN reads from process.env which is not populated in packaged Electron apps; crash reporting will never activate in production. Should use electron-store or hardcoded DSN.
const SENTRY_DSN = process.env.SENTRY_DSN || "";

export function initSentry(): void {
  if (!SENTRY_DSN) {
    log.info("[Sentry] No DSN configured — crash reporting disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `iworkr-desktop@${app.getVersion()}`,
    environment: app.isPackaged ? "production" : "development",
    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
      }
      return event;
    },
  });

  log.info("[Sentry] Crash reporting initialized");
}
