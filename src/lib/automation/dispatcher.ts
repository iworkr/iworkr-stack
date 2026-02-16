/**
 * iWorkr Event Dispatcher
 *
 * Fire-and-forget event dispatcher that sends events to the automation engine.
 * Called from server actions after business logic completes.
 * Non-blocking — errors are logged but never thrown to the caller.
 */

import type { AutomationEvent } from "./events";
import { processEvent } from "./engine";

/**
 * Dispatch an automation event. Runs async and never blocks the caller.
 * Safe to call from any server action.
 */
export function dispatch(event: AutomationEvent): void {
  // Fire-and-forget: process in background
  processEvent(event)
    .then((result) => {
      if (result.flowsMatched > 0) {
        console.log(
          `[Automation] Event ${event.type} → ${result.flowsMatched} flows matched, ${result.flowsExecuted} executed`
        );
      }
      if (result.errors.length > 0) {
        console.error(`[Automation] Errors:`, result.errors);
      }
    })
    .catch((err) => {
      console.error(`[Automation] Dispatch failed for ${event.type}:`, err);
    });
}

/**
 * Dispatch an automation event and wait for results.
 * Use when you need to know the result (e.g., testing, API routes).
 */
export async function dispatchAndWait(event: AutomationEvent) {
  return processEvent(event);
}
