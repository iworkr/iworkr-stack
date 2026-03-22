/**
 * @component ImpersonationBanner
 * @status COMPLETE
 * @description Renders a warning banner when an admin is impersonating another user
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OctagonAlert, X } from "lucide-react";

interface ImpersonationState {
  active: boolean;
  targetName: string;
  targetEmail: string;
  adminId: string;
  sessionId: string;
}

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check cookie for impersonation state
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("iworkr_impersonation="));
    
    if (cookie) {
      try {
        const data = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
        setState({
          active: true,
          targetName: data.target_name || "Unknown User",
          targetEmail: data.target_email || "",
          adminId: data.admin_id || "",
          sessionId: data.session_id || "",
        });
      } catch { /* ignore */ }
    }
  }, []);

  if (!state?.active) return null;

  const exitImpersonation = async () => {
    // Clear the cookie
    document.cookie = "iworkr_impersonation=; path=/; max-age=0";
    // Call the API to end the session
    try {
      await fetch("/api/admin/end-impersonation", {
        method: "POST",
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
    } catch { /* best effort */ }
    router.push("/olympus/users");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-between bg-red-600 px-4 py-2">
      <div className="flex items-center gap-2">
        <OctagonAlert size={16} className="text-white" />
        <span className="text-[12px] font-semibold text-white">
          DANGER: You are currently impersonating {state.targetName} ({state.targetEmail}). All actions are audited.
        </span>
      </div>
      <button
        onClick={exitImpersonation}
        className="flex items-center gap-1.5 rounded bg-white/20 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wider transition-colors hover:bg-white/30"
      >
        EXIT IMPERSONATION
      </button>
    </div>
  );
}
