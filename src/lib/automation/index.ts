/**
 * @module lib/automation/index.ts
 * @status STABLE
 * @description Automation engine — dispatch, events, executors — index
 * @lastReview 2026-03-28
 */
export { Events, type AutomationEvent, type EventType, type EventCategory } from "./events";
export { processEvent } from "./engine";
export { executeAction, type ActionResult } from "./executors";
export { dispatch, dispatchAndWait } from "./dispatcher";
