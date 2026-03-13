/**
 * Project Panopticon — Telemetry Module Public API
 *
 * Re-exports the capture engine for clean imports across the app.
 */

export {
  initConsoleCapture,
  setTelemetryIdentity,
  trackAction,
  buildAutopsyPayload,
  sendTelemetryPayload,
  flushTelemetryQueue,
  captureAndSend,
  reportBug,
  getConsoleBuffer,
} from "./capture-engine";

export type {
  TelemetryPayload,
  TelemetryIdentity,
  TelemetrySeverity,
  ConsoleEntry,
} from "./capture-engine";
