"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";

/**
 * AuthProvider — handles initial auth load + Supabase auth state changes.
 *
 * Key fixes (v2):
 * - TOKEN_REFRESHED only triggers a lightweight profile refresh, NOT a full
 *   initialize() which was resetting currentOrg/currentMembership mid-session.
 * - SIGNED_IN debounced to prevent duplicate initializations within 2s.
 * - Full initialize() only runs once on mount (or when the user signs in fresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, initialized, reset, refreshProfile } = useAuthStore();
  const hasCache = useAuthStore((s) => !!s.currentOrg);
  const lastInitRef = useRef<number>(0);

  useEffect(() => {
    if (!initialized) {
      if (hasCache) {
        // We have cached auth data — mark initialized immediately so
        // the UI can render instantly. Network call still runs to
        // revalidate but doesn't block rendering.
        useAuthStore.setState({ initialized: true, loading: false });
      }
      // Always call initialize to revalidate with the server
      lastInitRef.current = Date.now();
      initialize();
    }

    // Listen for auth state changes (sign in, sign out, token refresh)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN") {
          // Debounce: don't re-initialize if we just did it (< 2s ago)
          const now = Date.now();
          if (now - lastInitRef.current < 2000) return;
          lastInitRef.current = now;
          initialize();
        } else if (event === "SIGNED_OUT") {
          reset();
        } else if (event === "TOKEN_REFRESHED") {
          // Token refresh should NOT run full initialize() — that resets
          // currentOrg/currentMembership which causes branch loss, stale data,
          // and the "slingshot" bug. A lightweight profile revalidation is enough.
          refreshProfile();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialize, initialized, reset, hasCache, refreshProfile]);

  return <>{children}</>;
}
