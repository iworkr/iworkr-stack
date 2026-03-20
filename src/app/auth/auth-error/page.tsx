"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  code_exchange_failed: {
    title: "Link Expired",
    description:
      "This authentication link has expired or has already been used. Please request a new one.",
  },
  missing_code: {
    title: "Invalid Link",
    description:
      "The authentication link is malformed or missing required parameters.",
  },
  no_user: {
    title: "Authentication Failed",
    description:
      "We were unable to verify your identity. Please try signing in again.",
  },
};

const DEFAULT_ERROR = {
  title: "Something went wrong",
  description: "An unexpected error occurred during authentication. Please try again.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "";
  const { title, description } = ERROR_MESSAGES[reason] || DEFAULT_ERROR;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--background)]">
      <div className="stealth-noise fixed" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />

      <div className="relative z-10 w-full max-w-sm px-6 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/15 bg-rose-500/[0.06]">
          <AlertTriangle size={24} className="text-rose-400" />
        </div>

        <h1 className="text-xl font-medium tracking-tight text-zinc-100">{title}</h1>
        <p className="mt-2 text-[13px] text-zinc-500">{description}</p>

        {reason && (
          <p className="mt-3 font-mono text-[10px] text-zinc-700">
            Error: {reason}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/auth"
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-active)] bg-[var(--subtle-bg)] px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-[var(--subtle-bg-hover)]"
          >
            <RefreshCw size={14} />
            Try Again
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={13} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]" />
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
