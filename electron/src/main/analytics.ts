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

function flushEvents(): void {
  if (eventQueue.length === 0) return;
  log.info(`[Analytics] Flushing ${eventQueue.length} events`);
  eventQueue.length = 0;
}
