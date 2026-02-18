"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function DesktopLoginPage() {
  const [status, setStatus] = useState<"pending" | "authenticating" | "success" | "error">("pending");

  useEffect(() => {
    async function handleDesktopAuth() {
      setStatus("authenticating");

      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          setStatus("success");
          const callbackUrl = new URL("iworkr://auth/callback");
          callbackUrl.searchParams.set("token", session.access_token);
          if (session.refresh_token) {
            callbackUrl.searchParams.set("refresh_token", session.refresh_token);
          }

          setTimeout(() => {
            window.location.href = callbackUrl.toString();
          }, 1500);
          return;
        }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/desktop-callback`,
            skipBrowserRedirect: false,
          },
        });

        if (error) throw error;
      } catch (err) {
        console.error("Desktop auth error:", err);
        setStatus("error");
      }
    }

    handleDesktopAuth();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
          <Monitor size={24} className="text-[#00E676]" />
        </div>

        <h1 className="text-[18px] font-semibold text-zinc-200">
          Desktop Sign In
        </h1>
        <p className="mt-2 text-[13px] text-zinc-500">
          Connecting your account to the iWorkr desktop app.
        </p>

        <div className="mt-8">
          {status === "pending" || status === "authenticating" ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-[#00E676]" />
              <p className="text-[12px] text-zinc-500">Authenticating…</p>
            </div>
          ) : status === "success" ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle size={24} className="text-[#00E676]" />
              <p className="text-[12px] text-zinc-400">
                Authenticated! Returning to iWorkr Desktop…
              </p>
              <p className="text-[11px] text-zinc-600">
                You can close this browser tab.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-[12px] text-zinc-400">
                Authentication failed. Please try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-lg bg-white/[0.06] px-4 py-2 text-[12px] text-zinc-300 hover:bg-white/[0.1]"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
