/**
 * @module Utils
 * @status COMPLETE
 * @description Core utility — Tailwind class merge helper (cn function)
 * @lastAudit 2026-03-22
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
