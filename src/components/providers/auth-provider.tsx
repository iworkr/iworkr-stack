"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, initialized, reset } = useAuthStore();
  const hasCache = useAuthStore((s) => !!s.currentOrg);

  useEffect(() => {
    if (!initialized) {
      if (hasCache) {
        // We have cached auth data — mark initialized immediately so
        // the UI can render instantly. Network call still runs to
        // revalidate but doesn't block rendering.
        useAuthStore.setState({ initialized: true, loading: false });
      }
      // Always call initialize to revalidate with the server
      initialize();
    }

    // Listen for auth state changes (sign in, sign out, token refresh)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN") {
          initialize();
        } else if (event === "SIGNED_OUT") {
          reset();
        } else if (event === "TOKEN_REFRESHED") {
          initialize();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialize, initialized, reset, hasCache]);

  return <>{children}</>;
}
