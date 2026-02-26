"use client";

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { type Integration } from "@/lib/integrations-data";
import { useIntegrationsStore } from "@/lib/integrations-store";
import { useToastStore } from "@/components/app/action-toast";
import { getOAuthUrl } from "@/app/actions/integration-oauth";

/* ── OAuth providers that need popup flow ─────────────── */
const OAUTH_PROVIDERS = new Set(["xero", "quickbooks", "gmail", "outlook", "google_calendar", "outlook_calendar", "google_drive", "slack"]);
const API_KEY_PROVIDERS = new Set(["twilio", "gohighlevel", "google_maps"]);

interface IntegrationCardProps {
  integration: Integration;
  index: number;
}

export function IntegrationCard({ integration: int, index }: IntegrationCardProps) {
  const { openConfigPanel, connectServer, setStripeModalOpen } = useIntegrationsStore();
  const { addToast } = useToastStore();
  const isConnected = int.status === "connected" || int.status === "syncing";
  const isError = int.status === "error";
  const isSyncing = int.status === "syncing";
  const [connecting, setConnecting] = useState(false);

  // Derive provider slug from the integration data
  const providerSlug = (int as any).provider ||
    int.id.replace("int-", "").replace("gcal", "google_calendar").replace("ocal", "outlook_calendar").replace("gdrive", "google_drive").replace("gmaps", "google_maps").replace("ghl", "gohighlevel");

  const handleClick = async () => {
    if (isConnected || isError) {
      openConfigPanel(int.id);
    } else if (int.id === "int-stripe" || int.name?.toLowerCase() === "stripe") {
      setStripeModalOpen(true);
    } else if (OAUTH_PROVIDERS.has(providerSlug)) {
      // OAuth flow — get URL and redirect
      if (connecting) return;
      setConnecting(true);
      const { url, error } = await getOAuthUrl(int.id, providerSlug);
      if (url) {
        // Open OAuth popup
        window.open(url, `oauth-${providerSlug}`, "width=600,height=700,scrollbars=yes");
        addToast(`Connecting to ${int.name}...`);
      } else if (error) {
        // OAuth not configured — fall back to direct connect for demo
        const { error: connectError } = await connectServer(int.id);
        if (connectError) addToast(`Failed to connect ${int.name}: ${connectError}`);
        else addToast(`${int.name} connected`);
      }
      setConnecting(false);
    } else if (API_KEY_PROVIDERS.has(providerSlug)) {
      // API key providers — open config panel for key entry
      openConfigPanel(int.id);
    } else {
      if (connecting) return;
      setConnecting(true);
      const { error } = await connectServer(int.id);
      if (error) addToast(`Failed to connect ${int.name}: ${error}`);
      else addToast(`${int.name} connected`);
      setConnecting(false);
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={handleClick}
      className={`group relative flex aspect-[4/3] w-full flex-col items-center justify-between overflow-hidden rounded-xl border bg-[#0F0F0F] p-5 text-left transition-[border-color] duration-200 ${
        isError
          ? "border-red-500/20 hover:border-red-500/40"
          : isConnected
            ? "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]"
            : "border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.15)]"
      }`}
    >
      {/* Brand icon */}
      <div className="flex flex-1 items-center justify-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br transition-all duration-200 ${int.iconBg} ${
            isConnected
              ? "opacity-100 saturate-100"
              : isError
                ? "opacity-70 saturate-100"
                : "opacity-40 saturate-0 group-hover:opacity-70 group-hover:saturate-50"
          }`}
        >
          <span className="text-[18px] font-bold text-white">{int.logoContent}</span>
        </div>
      </div>

      {/* Bottom section */}
      <div className="w-full">
        <div className="flex items-center justify-between">
          <span className={`text-[13px] font-medium transition-colors ${
            isConnected ? "text-zinc-200" : "text-zinc-500 group-hover:text-zinc-300"
          }`}>
            {int.name}
          </span>

          {/* Status indicator */}
          {isConnected && !isSyncing && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-emerald-500" />
              </span>
              <span className="text-[9px] text-zinc-600">{int.lastSynced}</span>
            </div>
          )}

          {isSyncing && (
            <div className="flex items-center gap-1.5">
              <RefreshCw size={10} className="animate-spin text-[#00E676]" />
              <span className="text-[9px] text-[#00E676]">Syncing</span>
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-1.5">
              <span className="h-[6px] w-[6px] rounded-full bg-red-500" />
              <span className="text-[9px] text-red-400">Error</span>
            </div>
          )}

          {int.status === "disconnected" && (
            <span className="rounded-md border border-[rgba(255,255,255,0.1)] bg-transparent px-2 py-0.5 text-[9px] font-medium text-zinc-500 transition-all group-hover:border-[rgba(255,255,255,0.2)] group-hover:text-zinc-300">
              Connect
            </span>
          )}
        </div>

        <p className={`mt-1 line-clamp-2 text-[10px] leading-relaxed transition-colors ${
          isConnected ? "text-zinc-600" : "text-zinc-700 group-hover:text-zinc-600"
        }`}>
          {isError ? int.error : int.description}
        </p>

        {/* Features pills */}
        {int.features && isConnected && (
          <div className="mt-2 flex flex-wrap gap-1">
            {int.features.slice(0, 3).map((f) => (
              <span
                key={f}
                className="rounded-full bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[7px] font-medium text-zinc-600"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}
