"use client";

/* ═══════════════════════════════════════════════════════════════
   InvalidTokenUI — Vantablack Error States
   Project Genesis §4.2

   Renders specific error states based on token validation failure:
   - expired: Link expired after 7 days
   - accepted: Invite already claimed
   - revoked: Admin cancelled the invite
   - missing: No token in URL
   - invalid: Token not found in database
   ═══════════════════════════════════════════════════════════════ */

import { motion } from "framer-motion";
import { Clock, CheckCircle2, ShieldX, AlertTriangle, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";

interface InvalidTokenUIProps {
  reason: string;
}

const errorConfigs: Record<
  string,
  {
    icon: typeof Clock;
    iconColor: string;
    iconBg: string;
    title: string;
    description: string;
    action?: { label: string; href: string };
  }
> = {
  expired: {
    icon: Clock,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    title: "Invitation Expired",
    description:
      "This invitation has expired. For security reasons, links are only valid for 7 days. Please contact your administrator for a new invite.",
    action: { label: "Go to Login", href: "/auth" },
  },
  accepted: {
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    title: "Already Claimed",
    description:
      "This invitation has already been claimed. If you have an account, please log in to access your dashboard.",
    action: { label: "Go to Login", href: "/auth" },
  },
  revoked: {
    icon: ShieldX,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    title: "Invitation Cancelled",
    description:
      "This invitation has been cancelled by the workspace administrator. Please contact your team lead for a new invite.",
    action: { label: "Return Home", href: "/" },
  },
  missing: {
    icon: Link2Off,
    iconColor: "text-zinc-500",
    iconBg: "bg-zinc-500/10 border-zinc-500/20",
    title: "Missing Invite Link",
    description:
      "No invitation token was found in the URL. Please check the link from your email and try again.",
    action: { label: "Return Home", href: "/" },
  },
  invalid: {
    icon: AlertTriangle,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    title: "Invalid Invitation",
    description:
      "This invitation link is not valid. It may have been corrupted or is no longer active. Please contact your administrator for a new invite.",
    action: { label: "Return Home", href: "/" },
  },
};

export function InvalidTokenUI({ reason }: InvalidTokenUIProps) {
  const router = useRouter();
  const config = errorConfigs[reason] || errorConfigs.invalid;
  const Icon = config.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Glass card */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950 p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${config.iconBg}`}
            >
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-lg font-semibold text-white"
            >
              {config.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="max-w-[320px] text-center text-sm leading-relaxed text-zinc-500"
            >
              {config.description}
            </motion.p>

            {/* Action */}
            {config.action && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(config.action!.href)}
                className="mt-4 rounded-lg border border-white/10 px-6 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/5"
              >
                {config.action.label}
              </motion.button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-zinc-700">
          iWorkr — Field Service Operating System
        </p>
      </motion.div>
    </div>
  );
}
