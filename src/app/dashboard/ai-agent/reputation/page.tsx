"use client";

import { motion } from "framer-motion";
import { Star, ChevronLeft, Save, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { upsertAgentConfig } from "@/app/actions/ai-agent";
import { useToastStore } from "@/components/app/action-toast";

export default function ReputationAgentPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Review Monitoring
  const [monitorGoogle, setMonitorGoogle] = useState(true);
  const [monitorFacebook, setMonitorFacebook] = useState(false);
  const [alertLowRatings, setAlertLowRatings] = useState(true);

  // Auto-Reply Drafts
  const [autoDraftReplies, setAutoDraftReplies] = useState(false);
  const [replyTone, setReplyTone] = useState("Professional & Warm");
  const [replyGuidelines, setReplyGuidelines] = useState("");

  // Review Requests
  const [sendSmsRequests, setSendSmsRequests] = useState(false);
  const [reviewLinkUrl, setReviewLinkUrl] = useState("");
  const [smsTemplate, setSmsTemplate] = useState(
    "Hi {{name}}, thanks for choosing us! We'd love your feedback: {{link}}"
  );

  const handleSave = async () => {
    if (!currentOrg?.id) return;
    setSaving(true);
    try {
      const settings = {
        monitorGoogle,
        monitorFacebook,
        alertLowRatings,
        autoDraftReplies,
        replyTone,
        replyGuidelines,
        sendSmsRequests,
        reviewLinkUrl,
        smsTemplate,
      };
      const result = await upsertAgentConfig(currentOrg.id, {
        knowledge_base: JSON.stringify({ reputation_settings: settings }),
      });
      if (result.error) {
        addToast(result.error, undefined, "error");
      } else {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
        addToast("Reputation agent settings saved");
      }
    } catch (err) {
      console.error("[reputation-agent] save error:", err);
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
              <Star size={16} className="text-emerald-400" />
              <h1 className="text-[14px] font-semibold text-white">
                Reputation Manager
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
          {/* Review Monitoring */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Review Monitoring
            </h3>

            {/* Toggle: Google */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Monitor Google Reviews
                </p>
                <p className="text-[11px] text-zinc-500">
                  Track new Google Business Profile reviews in real-time
                </p>
              </div>
              <button
                onClick={() => setMonitorGoogle(!monitorGoogle)}
                className={`relative h-5 w-9 rounded-full transition-colors ${monitorGoogle ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${monitorGoogle ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: Facebook */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Monitor Facebook Reviews
                </p>
                <p className="text-[11px] text-zinc-500">
                  Track new Facebook page reviews and recommendations
                </p>
              </div>
              <button
                onClick={() => setMonitorFacebook(!monitorFacebook)}
                className={`relative h-5 w-9 rounded-full transition-colors ${monitorFacebook ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${monitorFacebook ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: alert on low */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Alert on reviews below 3 stars
                </p>
                <p className="text-[11px] text-zinc-500">
                  Get immediate notifications for negative reviews
                </p>
              </div>
              <button
                onClick={() => setAlertLowRatings(!alertLowRatings)}
                className={`relative h-5 w-9 rounded-full transition-colors ${alertLowRatings ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${alertLowRatings ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </motion.div>

          {/* Auto-Reply Drafts */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Auto-Reply Drafts
            </h3>

            {/* Toggle: auto-draft */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Auto-draft replies to new reviews
                </p>
                <p className="text-[11px] text-zinc-500">
                  AI generates a draft reply for your approval before posting
                </p>
              </div>
              <button
                onClick={() => setAutoDraftReplies(!autoDraftReplies)}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoDraftReplies ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoDraftReplies ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Dropdown: reply tone */}
            <div className="border-b border-white/5 py-3">
              <label className="text-[12px] font-medium text-white">
                Reply tone
              </label>
              <select
                value={replyTone}
                onChange={(e) => setReplyTone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              >
                <option value="Professional & Warm">
                  Professional &amp; Warm
                </option>
                <option value="Formal">Formal</option>
                <option value="Casual & Friendly">Casual &amp; Friendly</option>
              </select>
            </div>

            {/* Textarea: reply guidelines */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Reply guidelines / knowledge
              </label>
              <textarea
                value={replyGuidelines}
                onChange={(e) => setReplyGuidelines(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="e.g., Always thank the customer, mention our warranty..."
              />
            </div>
          </motion.div>

          {/* Review Requests */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Review Requests
            </h3>

            {/* Toggle: SMS review requests */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Send SMS review requests 24h post-job
                </p>
                <p className="text-[11px] text-zinc-500">
                  Automatically request reviews after job completion
                </p>
              </div>
              <button
                onClick={() => setSendSmsRequests(!sendSmsRequests)}
                className={`relative h-5 w-9 rounded-full transition-colors ${sendSmsRequests ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${sendSmsRequests ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Input: review link URL */}
            <div className="border-b border-white/5 py-3">
              <label className="text-[12px] font-medium text-white">
                Review link URL
              </label>
              <input
                type="text"
                value={reviewLinkUrl}
                onChange={(e) => setReviewLinkUrl(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="https://g.page/r/your-business/review"
              />
            </div>

            {/* Textarea: SMS template */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                SMS template
              </label>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Hi {{name}}, thanks for choosing us..."
              />
              <p className="mt-1 text-[10px] text-zinc-600">
                Available variables:{" "}
                <code className="rounded bg-white/5 px-1 py-0.5 text-zinc-400">
                  {"{{name}}"}
                </code>{" "}
                <code className="rounded bg-white/5 px-1 py-0.5 text-zinc-400">
                  {"{{link}}"}
                </code>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
