"use client";

import { useState, useEffect } from "react";

/**
 * useActiveBranch — Project Yggdrasil-Sync
 *
 * Returns the currently active branch ID selected by the WorkspaceSwitcher.
 * This is a UI-layer filter only — branch selection does NOT purge the global
 * cache (only workspace switching does). Data grids should filter by this ID
 * when it is non-null.
 *
 * Synced via:
 *  - sessionStorage key "iworkr_active_branch_ui"
 *  - Custom window event "iworkr:branch-change"
 */
export function useActiveBranch() {
  const [activeBranchId, setActiveBranchId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("iworkr_active_branch_ui") || null;
  });

  useEffect(() => {
    function handleChange(e: Event) {
      const custom = e as CustomEvent<{ branchId: string | null }>;
      setActiveBranchId(custom.detail.branchId);
    }

    window.addEventListener("iworkr:branch-change", handleChange);
    return () => window.removeEventListener("iworkr:branch-change", handleChange);
  }, []);

  return activeBranchId;
}
