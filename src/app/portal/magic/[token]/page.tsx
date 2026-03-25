/**
 * @page /portal/magic/[token]
 * @status COMPLETE
 * @description Magic link handler — validates token, resolves target, and redirects.
 *   Supports progressive authentication: anonymous for quotes/invoices,
 *   OTP upgrade for persistent portal access.
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { resolveMagicLink } from "@/app/actions/portal-client";

export default function MagicLinkPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid link");
      return;
    }

    resolveMagicLink(token).then((result) => {
      if (!result.ok || result.error) {
        setStatus("error");
        setErrorMsg(result.error || "This link is invalid or has expired.");
        return;
      }

      setStatus("success");

      // Route based on target type
      setTimeout(() => {
        if (result.target_type === "quote") {
          // Direct to the quote viewer (public, no auth needed)
          router.push(`/portal/view/${token}`);
        } else if (result.target_type === "invoice") {
          router.push(`/portal/view/${token}`);
        } else {
          // For portal/workspace access, redirect to login with context
          router.push(`/portal/login?slug=${result.workspace_id}&from=magic`);
        }
      }, 1500);
    });
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 size={32} className="mx-auto animate-spin text-emerald-400" />
            <p className="text-[14px] text-zinc-300">Verifying your link...</p>
            <p className="text-[12px] text-zinc-600">This will only take a moment</p>
          </div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <p className="text-[14px] font-medium text-zinc-200">Link verified</p>
            <p className="text-[12px] text-zinc-500">Redirecting you now...</p>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-4"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <p className="text-[14px] font-medium text-zinc-200">Link Invalid</p>
            <p className="text-[12px] text-zinc-500">{errorMsg}</p>
            <button
              onClick={() => router.push("/portal/login")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-[12px] text-zinc-300 hover:bg-zinc-700"
            >
              <Shield size={12} /> Sign in to portal
            </button>
          </motion.div>
        )}

        <p className="mt-12 text-[10px] text-zinc-700">
          Powered by iWorkr · Secure Access
        </p>
      </motion.div>
    </div>
  );
}
