/**
 * Aegis-Refactor: Central Zod Schema Library
 *
 * Runtime validation schemas for all data entering the application from
 * Supabase RPCs, external APIs, and webhook payloads. These schemas form
 * the "data perimeter" — if a database column is renamed or an RPC response
 * shape changes, Zod.parse() will throw a catchable, debuggable error
 * instead of a silent runtime crash.
 *
 * Usage:
 *   import { JobRowSchema } from "@/lib/schemas";
 *   const jobs = z.array(JobRowSchema).parse(response.data);
 */

export * from "./job";
export * from "./client";
export * from "./invoice";
export * from "./schedule";
export * from "./timesheet";
export * from "./team";
export * from "./dashboard";
export * from "./organization";
export * from "./care";
export * from "./common";
