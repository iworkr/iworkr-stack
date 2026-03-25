"use client";

import { useState } from "react";
import { Navigation, ExternalLink, Copy, Check, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TrackingBadgeProps {
  sessionId: string;
  token: string;
  status: "active" | "geofence_approach" | "arrived" | "cancelled" | "expired";
  etaMinutes?: number | null;
  workerName?: string | null;
  compact?: boolean;
}

const STATUS_CONFIG = {
  active: {
    label: "Live Tracking",
    color: "emerald",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
    pulse: true,
  },
  geofence_approach: {
    label: "Arriving Soon",
    color: "amber",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-500",
    pulse: true,
  },
  arrived: {
    label: "Arrived",
    color: "emerald",
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/10",
    text: "text-emerald-500/60",
    dot: "bg-emerald-500/50",
    pulse: false,
  },
  cancelled: {
    label: "Cancelled",
    color: "zinc",
    bg: "bg-zinc-800",
    border: "border-white/5",
    text: "text-zinc-500",
    dot: "bg-zinc-500",
    pulse: false,
  },
  expired: {
    label: "Expired",
    color: "zinc",
    bg: "bg-zinc-800",
    border: "border-white/5",
    text: "text-zinc-500",
    dot: "bg-zinc-500",
    pulse: false,
  },
};

export function TrackingBadge({
  token,
  status,
  etaMinutes,
  compact = false,
}: TrackingBadgeProps) {
  const [copied, setCopied] = useState(false);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const trackingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/track/${token}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(trackingUrl, "_blank");
  };

  if (compact) {
    return (
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bg} border ${config.border} ${config.text} text-xs transition-colors hover:opacity-80`}
      >
        {config.pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
          </span>
        )}
        <Navigation className="w-3 h-3" />
        <span>{config.label}</span>
        {etaMinutes != null && status === "active" && (
          <span className="font-mono">{etaMinutes}m</span>
        )}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {config.pulse && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
          </span>
        )}
        <Radio className={`w-3.5 h-3.5 ${config.text} shrink-0`} />
        <span className={`text-xs font-medium ${config.text}`}>
          {config.label}
          {etaMinutes != null && status === "active" && (
            <span className="font-mono ml-1">· ETA {etaMinutes}m</span>
          )}
        </span>
      </div>

      {(status === "active" || status === "geofence_approach") && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className={`p-1 rounded ${config.text} hover:bg-white/5 transition-colors`}
            title="Copy tracking link"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check className="w-3.5 h-3.5" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={handleOpen}
            className={`p-1 rounded ${config.text} hover:bg-white/5 transition-colors`}
            title="Open tracking page"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
