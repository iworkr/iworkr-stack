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

  const endpoint = process.env.ANALYTICS_ENDPOINT;
  if (!endpoint) {
    log.warn(`[Analytics] ${eventQueue.length} events discarded — ANALYTICS_ENDPOINT not set`);
    eventQueue.length = 0;
    return;
  }

  const batch = [...eventQueue];
  eventQueue.length = 0;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      log.warn(`[Analytics] Flush failed (${res.status}), ${batch.length} events lost`);
    } else {
      log.info(`[Analytics] Flushed ${batch.length} events`);
    }
  } catch (err) {
    log.warn(`[Analytics] Flush error: ${(err as Error).message}, ${batch.length} events lost`);
  }
}
