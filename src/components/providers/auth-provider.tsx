"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, initialized, reset } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
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
          // Re-initialize to keep state fresh
          initialize();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialize, initialized, reset]);

  return <>{children}</>;
}
