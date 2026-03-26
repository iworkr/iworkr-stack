/**
 * @hook useHydratedStore
 * @status NEW — Project Aegis-Resolution
 * @description Generic hydration-safe hook for Zustand persisted stores.
 *
 * Prevents components from reading Zustand persisted state during SSR,
 * avoiding hydration mismatches when the server-rendered HTML (default state)
 * doesn't match the client's localStorage-rehydrated state.
 *
 * Usage:
 *   const settings = useHydratedStore(useSettingsStore);
 *   // settings is null during SSR, populated after client mount
 *   if (!settings) return <Skeleton />;
 *   return <div>{settings.orgName}</div>;
 */

"use client";

import { useEffect, useState } from "react";

/**
 * Returns the full store state only after the component has mounted on the
 * client. During SSR and the initial render pass, returns `null`.
 *
 * This is intentionally simple — it defers to the component to decide
 * what to render during the hydration window (skeleton, null, defaults).
 */
export function useHydratedStore<T>(
  useStore: () => T
): T | null {
  const [hydrated, setHydrated] = useState(false);
  const state = useStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated ? state : null;
}

/**
 * Variant that returns a specific selector from the store, with a
 * fallback value during the hydration window.
 *
 * Usage:
 *   const theme = useHydratedSelector(
 *     useSettingsStore,
 *     (s) => s.preferences.theme,
 *     "system"
 *   );
 */
export function useHydratedSelector<T, U>(
  useStore: () => T,
  selector: (state: T) => U,
  fallback: U
): U {
  const [hydrated, setHydrated] = useState(false);
  const state = useStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated ? selector(state) : fallback;
}
