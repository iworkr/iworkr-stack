"use client";

import { motion } from "framer-motion";
import { Route, ChevronLeft, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { upsertAgentConfig } from "@/app/actions/ai-agent";
import { useToastStore } from "@/components/app/action-toast";

export default function DispatchAgentPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Schedule Intelligence
  const [densityAnalysis, setDensityAnalysis] = useState(true);
  const [optimalRouting, setOptimalRouting] = useState(true);
  const [maxTravelTime, setMaxTravelTime] = useState("45");

  // Reassignment
  const [autoReassign, setAutoReassign] = useState(false);
  const [factorSkills, setFactorSkills] = useState(true);

  // Alerts
  const [alertWindshield, setAlertWindshield] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  const handleSave = async () => {
    if (!currentOrg?.id) return;
    setSaving(true);
    try {
      const settings = {
        densityAnalysis,
        optimalRouting,
        maxTravelTime,
        autoReassign,
        factorSkills,
        alertWindshield,
        dailySummary,
      };
      const result = await upsertAgentConfig(currentOrg.id, {
        knowledge_base: JSON.stringify({ dispatch_settings: settings }),
      });
      if (result.error) {
        addToast(result.error, undefined, "error");
      } else {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
        addToast("Dispatch agent settings saved");
      }
    } catch (err) {
      console.error("[dispatch-agent] save error:", err);
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
              <Route size={16} className="text-emerald-400" />
              <h1 className="text-[14px] font-semibold text-white">
                Dispatch Copilot
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
          {/* Schedule Intelligence */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Schedule Intelligence
            </h3>

            {/* Toggle: density analysis */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Enable schedule density analysis
                </p>
                <p className="text-[11px] text-zinc-500">
                  AI analyzes your schedule to identify over- and under-booked
                  days
                </p>
              </div>
              <button
                onClick={() => setDensityAnalysis(!densityAnalysis)}
                className={`relative h-5 w-9 rounded-full transition-colors ${densityAnalysis ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${densityAnalysis ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: optimal routing */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Suggest optimal routing order
                </p>
                <p className="text-[11px] text-zinc-500">
                  Reorder daily jobs to minimize drive time between locations
                </p>
              </div>
              <button
                onClick={() => setOptimalRouting(!optimalRouting)}
                className={`relative h-5 w-9 rounded-full transition-colors ${optimalRouting ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${optimalRouting ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Input: max travel time */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Maximum travel time between jobs (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={maxTravelTime}
                onChange={(e) => setMaxTravelTime(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="45"
              />
            </div>
          </motion.div>

          {/* Reassignment */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Reassignment
            </h3>

            {/* Toggle: auto-suggest reassignment */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Auto-suggest reassignment on conflict
                </p>
                <p className="text-[11px] text-zinc-500">
                  When a scheduling conflict is detected, suggest an alternative
                  technician
                </p>
              </div>
              <button
                onClick={() => setAutoReassign(!autoReassign)}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoReassign ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoReassign ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: factor skills */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Factor in technician skills / certifications
                </p>
                <p className="text-[11px] text-zinc-500">
                  Only suggest techs with matching qualifications for the job
                  type
                </p>
              </div>
              <button
                onClick={() => setFactorSkills(!factorSkills)}
                className={`relative h-5 w-9 rounded-full transition-colors ${factorSkills ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${factorSkills ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </motion.div>

          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Alerts
            </h3>

            {/* Toggle: windshield time alert */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Alert on windshield time exceeding 30 min
                </p>
                <p className="text-[11px] text-zinc-500">
                  Get notified when drive time between consecutive jobs is too
                  high
                </p>
              </div>
              <button
                onClick={() => setAlertWindshield(!alertWindshield)}
                className={`relative h-5 w-9 rounded-full transition-colors ${alertWindshield ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${alertWindshield ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: daily summary */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Daily route optimization summary
                </p>
                <p className="text-[11px] text-zinc-500">
                  Receive a morning summary with routing improvements for the
                  day
                </p>
              </div>
              <button
                onClick={() => setDailySummary(!dailySummary)}
                className={`relative h-5 w-9 rounded-full transition-colors ${dailySummary ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${dailySummary ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
