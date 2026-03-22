/**
 * @page /dashboard/ai-agent/ads
 * @status COMPLETE
 * @description AI Ads agent configuration — ad copy tone, platforms, budget rules
 * @dataSource server-action: upsertAgentConfig
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";
import { Megaphone, ChevronLeft, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { upsertAgentConfig } from "@/app/actions/ai-agent";
import { useToastStore } from "@/components/app/action-toast";

export default function AdsAgentPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Ad Monitoring
  const [spendMonitoring, setSpendMonitoring] = useState(false);
  const [dailyBudget, setDailyBudget] = useState("50");
  const [autoPause, setAutoPause] = useState(false);
  const [minRoas, setMinRoas] = useState("2.0");

  // Creative Generation
  const [autoVariants, setAutoVariants] = useState(false);
  const [adStyle, setAdStyle] = useState("Professional");

  // Integration
  const [metaAccountId, setMetaAccountId] = useState("");

  const handleSave = async () => {
    if (!currentOrg?.id) return;
    setSaving(true);
    try {
      const settings = {
        spendMonitoring,
        dailyBudget,
        autoPause,
        minRoas,
        autoVariants,
        adStyle,
        metaAccountId,
      };
      const result = await upsertAgentConfig(currentOrg.id, {
        knowledge_base: JSON.stringify({ ads_settings: settings }),
      });
      if (result.error) {
        addToast(result.error, undefined, "error");
      } else {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
        addToast("Ads agent settings saved");
      }
    } catch (err) {
      console.error("[ads-agent] save error:", err);
      addToast("Failed to save settings", undefined, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[var(--background)]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/ai-agent"
              className="flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white"
            >
              <ChevronLeft size={14} /> AI Workforce
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-emerald-400" />
              <h1 className="text-[14px] font-semibold text-white">
                Meta Ads Optimizer
              </h1>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[11px] font-medium text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
          >
            {savedFeedback ? (
              <>
                <Check size={12} /> Saved
              </>
            ) : saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <>
                <Save size={14} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Ad Monitoring */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Ad Monitoring
            </h3>

            {/* Toggle: spend monitoring */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Enable ad spend monitoring
                </p>
                <p className="text-[11px] text-zinc-500">
                  Track daily ad spend and alert when thresholds are exceeded
                </p>
              </div>
              <button
                onClick={() => setSpendMonitoring(!spendMonitoring)}
                className={`relative h-5 w-9 rounded-full transition-colors ${spendMonitoring ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${spendMonitoring ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Input: daily budget */}
            <div className="border-b border-white/5 py-3">
              <label className="text-[12px] font-medium text-white">
                Daily budget threshold ($)
              </label>
              <input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="50"
              />
            </div>

            {/* Toggle: auto-pause */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Auto-pause underperforming campaigns
                </p>
                <p className="text-[11px] text-zinc-500">
                  Automatically pause campaigns that fall below ROAS threshold
                </p>
              </div>
              <button
                onClick={() => setAutoPause(!autoPause)}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoPause ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoPause ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Input: min ROAS */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Minimum ROAS threshold
              </label>
              <input
                type="number"
                step="0.1"
                value={minRoas}
                onChange={(e) => setMinRoas(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="2.0"
              />
            </div>
          </motion.div>

          {/* Creative Generation */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Creative Generation
            </h3>

            {/* Toggle: auto A/B variants */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Auto-generate A/B test variants
                </p>
                <p className="text-[11px] text-zinc-500">
                  AI creates copy and image variations for split testing
                </p>
              </div>
              <button
                onClick={() => setAutoVariants(!autoVariants)}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoVariants ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoVariants ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Dropdown: ad style */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Ad style
              </label>
              <select
                value={adStyle}
                onChange={(e) => setAdStyle(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              >
                <option value="Professional">Professional</option>
                <option value="Casual">Casual</option>
                <option value="Urgent/Scarcity">Urgent / Scarcity</option>
              </select>
            </div>
          </motion.div>

          {/* Integration */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Integration
            </h3>

            {/* Input: Meta Business Account ID */}
            <div className="border-b border-white/5 py-3">
              <label className="text-[12px] font-medium text-white">
                Meta Business Account ID
              </label>
              <input
                type="text"
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Enter your Meta Business Account ID"
              />
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Connection Status
                </p>
                <p className="text-[11px] text-zinc-500">
                  Meta Business Suite integration
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                Not connected
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
