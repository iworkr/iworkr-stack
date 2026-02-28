import * as Sentry from "@sentry/electron/main";
import { app } from "electron";
import log from "electron-log/main";
import Store from "electron-store";

const store = new Store<{ sentryDsn?: string }>();

// Priority: 1) process.env (dev), 2) electron-store (persisted config), 3) empty
const SENTRY_DSN = process.env.SENTRY_DSN || store.get("sentryDsn") || "";

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

/** Allow setting DSN at runtime (e.g., from settings UI or remote config) */
export function setSentryDsn(dsn: string): void {
  store.set("sentryDsn", dsn);
  log.info("[Sentry] DSN updated — restart app to apply");
}
