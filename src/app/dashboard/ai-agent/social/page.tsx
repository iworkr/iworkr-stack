/**
 * @page /dashboard/ai-agent/social
 * @status COMPLETE
 * @description AI Social agent configuration — post scheduling, content tone, platform targeting
 * @dataSource server-action: upsertAgentConfig
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";
import {
  MessageCircle,
  ChevronLeft,
  Save,
  Loader2,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { upsertAgentConfig } from "@/app/actions/ai-agent";
import { useToastStore } from "@/components/app/action-toast";

export default function SocialAgentPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Auto-Reply
  const [igAutoReply, setIgAutoReply] = useState(false);
  const [fbAutoReply, setFbAutoReply] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState(
    "Hey! 👋 Thanks for reaching out. We usually reply within a few minutes. How can we help you today?"
  );
  const [responseDelay, setResponseDelay] = useState("5");

  // Lead Qualification
  const [autoQualify, setAutoQualify] = useState(false);
  const [leadThreshold, setLeadThreshold] = useState("Medium — filter spam");

  // Escalation
  const [escalateAfterUnanswered, setEscalateAfterUnanswered] = useState(true);
  const [escalationEmail, setEscalationEmail] = useState("");

  const handleSave = async () => {
    if (!currentOrg?.id) return;
    setSaving(true);
    try {
      const settings = {
        igAutoReply,
        fbAutoReply,
        greetingMessage,
        responseDelay,
        autoQualify,
        leadThreshold,
        escalateAfterUnanswered,
        escalationEmail,
      };
      const result = await upsertAgentConfig(currentOrg.id, {
        knowledge_base: JSON.stringify({ social_settings: settings }),
      });
      if (result.error) {
        addToast(result.error, undefined, "error");
      } else {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
        addToast("Social agent settings saved");
      }
    } catch (err) {
      console.error("[social-agent] save error:", err);
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
              <MessageCircle size={16} className="text-emerald-400" />
              <h1 className="text-[14px] font-semibold text-white">
                Social Sales Agent
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
          {/* Auto-Reply */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Auto-Reply
            </h3>

            {/* Toggle: IG DMs */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Enable Instagram DM auto-replies
                </p>
                <p className="text-[11px] text-zinc-500">
                  Automatically respond to incoming Instagram messages
                </p>
              </div>
              <button
                onClick={() => setIgAutoReply(!igAutoReply)}
                className={`relative h-5 w-9 rounded-full transition-colors ${igAutoReply ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${igAutoReply ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Toggle: FB Messenger */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Enable Facebook Messenger auto-replies
                </p>
                <p className="text-[11px] text-zinc-500">
                  Automatically respond to incoming Facebook messages
                </p>
              </div>
              <button
                onClick={() => setFbAutoReply(!fbAutoReply)}
                className={`relative h-5 w-9 rounded-full transition-colors ${fbAutoReply ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${fbAutoReply ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Textarea: greeting message */}
            <div className="border-b border-white/5 py-3">
              <label className="text-[12px] font-medium text-white">
                Default greeting message
              </label>
              <textarea
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="Hey! Thanks for reaching out..."
              />
            </div>

            {/* Input: response delay */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Response delay (seconds)
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={responseDelay}
                onChange={(e) => setResponseDelay(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="5"
              />
            </div>
          </motion.div>

          {/* Lead Qualification */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Lead Qualification
            </h3>

            {/* Toggle: auto-qualify */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Auto-qualify leads to Triage inbox
                </p>
                <p className="text-[11px] text-zinc-500">
                  Automatically score and route qualified leads to your inbox
                </p>
              </div>
              <button
                onClick={() => setAutoQualify(!autoQualify)}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoQualify ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoQualify ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Dropdown: lead scoring threshold */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Lead scoring threshold
              </label>
              <select
                value={leadThreshold}
                onChange={(e) => setLeadThreshold(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              >
                <option value="Low — capture all">Low — capture all</option>
                <option value="Medium — filter spam">
                  Medium — filter spam
                </option>
                <option value="High — only hot leads">
                  High — only hot leads
                </option>
              </select>
            </div>
          </motion.div>

          {/* Escalation */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6"
          >
            <h3 className="mb-4 text-[13px] font-semibold text-white">
              Escalation
            </h3>

            {/* Toggle: escalate after unanswered */}
            <div className="flex items-center justify-between border-b border-white/5 py-3">
              <div>
                <p className="text-[12px] font-medium text-white">
                  Escalate to human after 3 unanswered messages
                </p>
                <p className="text-[11px] text-zinc-500">
                  Notify a team member when the AI can&apos;t resolve a
                  conversation
                </p>
              </div>
              <button
                onClick={() =>
                  setEscalateAfterUnanswered(!escalateAfterUnanswered)
                }
                className={`relative h-5 w-9 rounded-full transition-colors ${escalateAfterUnanswered ? "bg-emerald-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${escalateAfterUnanswered ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Input: escalation email */}
            <div className="py-3">
              <label className="text-[12px] font-medium text-white">
                Escalation notification email
              </label>
              <input
                type="email"
                value={escalationEmail}
                onChange={(e) => setEscalationEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                placeholder="team@yourcompany.com"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
