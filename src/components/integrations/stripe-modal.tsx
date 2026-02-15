"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Check, CreditCard, Banknote, Link2 } from "lucide-react";
import { useState } from "react";
import { useIntegrationsStore } from "@/lib/integrations-store";
import { useToastStore } from "@/components/app/action-toast";

type StripeStage = "intro" | "connecting" | "success";

export function StripeConnectModal() {
  const { stripeModalOpen, setStripeModalOpen, connect } = useIntegrationsStore();
  const { addToast } = useToastStore();
  const [stage, setStage] = useState<StripeStage>("intro");

  const handleConnect = () => {
    setStage("connecting");
    // Simulate OAuth flow (popup would open)
    setTimeout(() => {
      setStage("success");
      connect("int-stripe");
    }, 2500);
  };

  const handleClose = () => {
    setStripeModalOpen(false);
    if (stage === "success") {
      addToast("Stripe connected successfully!");
    }
    // Reset stage after close animation
    setTimeout(() => setStage("intro"), 300);
  };

  return (
    <AnimatePresence>
      {stripeModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0C0C0C] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.8)]"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
            >
              <X size={14} />
            </button>

            <AnimatePresence mode="wait">
              {/* ── Intro Stage ──────────────────────── */}
              {stage === "intro" && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-8"
                >
                  {/* Stripe brand area */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#635BFF] to-[#4B45C6]">
                      <span className="text-[20px] font-bold text-white">S</span>
                    </div>
                    <div>
                      <h2 className="text-[16px] font-medium text-zinc-100">Connect Stripe</h2>
                      <p className="text-[11px] text-zinc-600">Accept payments instantly.</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-6 space-y-3">
                    {[
                      { icon: CreditCard, label: "Payment Links", desc: "Send payment links with every invoice" },
                      { icon: Banknote, label: "Automatic Payouts", desc: "Get paid directly to your bank account" },
                      { icon: Link2, label: "Sync to Finance", desc: "Payments auto-recorded in your ledger" },
                    ].map((feat) => {
                      const Icon = feat.icon;
                      return (
                        <div key={feat.label} className="flex items-start gap-3 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#635BFF]/10">
                            <Icon size={14} strokeWidth={1.5} className="text-[#635BFF]" />
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-zinc-300">{feat.label}</p>
                            <p className="text-[10px] text-zinc-600">{feat.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Security note */}
                  <div className="mb-6 flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.02)] px-3 py-2">
                    <Shield size={12} className="text-emerald-500" />
                    <span className="text-[10px] text-zinc-500">
                      Secure OAuth connection. We never store your banking details.
                    </span>
                  </div>

                  {/* Connect button */}
                  <button
                    onClick={handleConnect}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-4 py-3 text-[13px] font-medium text-white transition-all hover:bg-[#5851DB] hover:shadow-[0_0_20px_rgba(99,91,255,0.3)]"
                  >
                    Connect with Stripe
                  </button>
                </motion.div>
              )}

              {/* ── Connecting Stage ─────────────────── */}
              {stage === "connecting" && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center justify-center p-12"
                >
                  {/* Sync animation */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#635BFF]/20"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#635BFF] to-[#4B45C6]">
                        <span className="text-[16px] font-bold text-white">S</span>
                      </div>
                    </motion.div>
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-t-2 border-[#635BFF]/50"
                    />
                  </div>

                  <h3 className="text-[14px] font-medium text-zinc-200">Waiting for Stripe...</h3>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Complete the setup in the Stripe window.
                  </p>

                  {/* Pulsing dots */}
                  <div className="mt-4 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                        className="h-1.5 w-1.5 rounded-full bg-[#635BFF]"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Success Stage ────────────────────── */}
              {stage === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center p-12"
                >
                  {/* Check animation */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <Check size={28} strokeWidth={2.5} className="text-emerald-400" />
                    </motion.div>
                  </motion.div>

                  {/* Confetti particles */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, x: 0, y: 0 }}
                      animate={{
                        opacity: 0,
                        x: (Math.random() - 0.5) * 200,
                        y: (Math.random() - 0.5) * 200,
                      }}
                      transition={{ duration: 1, delay: 0.1 + i * 0.03 }}
                      className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: ["#635BFF", "#10B981", "#F59E0B", "#3B82F6", "#EC4899"][i % 5],
                      }}
                    />
                  ))}

                  <h3 className="text-[16px] font-medium text-zinc-100">Stripe Connected!</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    You can now accept payments and track payouts.
                  </p>

                  <button
                    onClick={handleClose}
                    className="mt-6 rounded-xl bg-white/[0.05] px-6 py-2.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
