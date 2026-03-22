/**
 * @hook useActiveBranch
 * @status COMPLETE
 * @description Unified branch persistence layer with localStorage sync across tabs
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useActiveBranch — Project Yggdrasil-Sync (v2 — unified)
 *
 * Unified branch persistence layer. Uses localStorage (persists across tabs/sessions)
 * with a single canonical key. All branch selectors (topbar, sidebar, workspace-switcher)
 * MUST use this hook or the imperative helpers below.
 *
 * Synced via:
 *  - localStorage key "iworkr-active-branch" (canonical — replaces the old sessionStorage split)
 *  - Custom window event "iworkr:branch-change" (for cross-component reactivity)
 */

const STORAGE_KEY = "iworkr-active-branch";
const EVENT_NAME = "iworkr:branch-change";

/** Read the active branch ID from localStorage (works outside React) */
export function getActiveBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) || null;
}

/** Write the active branch ID to localStorage + dispatch event (works outside React) */
export function setActiveBranchId(branchId: string | null) {
  if (typeof window === "undefined") return;
  if (branchId) {
    localStorage.setItem(STORAGE_KEY, branchId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { branchId } })
  );
}

/** React hook — returns [activeBranchId, setActiveBranchId] */
export function useActiveBranch(): [string | null, (id: string | null) => void] {
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchId());

  useEffect(() => {
    function handleChange(e: Event) {
      const custom = e as CustomEvent<{ branchId: string | null }>;
      setBranchId(custom.detail.branchId);
    }

    // Also handle cross-tab sync via storage event
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setBranchId(e.newValue || null);
      }
    }

    window.addEventListener(EVENT_NAME, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setter = useCallback((id: string | null) => {
    setActiveBranchId(id);
  }, []);

  return [branchId, setter];
}
