import { app, ipcMain } from "electron";
import log from "electron-log/main";

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

const eventQueue: AnalyticsEvent[] = [];

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  const entry: AnalyticsEvent = {
    event,
    properties: {
      ...properties,
      app_version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    },
    timestamp: new Date().toISOString(),
  };

  eventQueue.push(entry);
  log.info(`[Analytics] ${event}`, properties || "");
}

export function initAnalytics(): void {
  trackEvent("app_launched");

  ipcMain.on("analytics:track", (_event, name: string, props?: Record<string, unknown>) => {
    trackEvent(name, props);
  });

  app.on("before-quit", () => {
    trackEvent("app_quit");
    flushEvents();
  });
}

async function flushEvents() {
  if (eventQueue.length === 0) return;
  // TODO: Implement analytics endpoint (e.g., POST to https://analytics.iworkrapp.com/events)
  console.warn(`[analytics] ${eventQueue.length} events discarded - analytics endpoint not configured`);
  eventQueue.length = 0;
}
