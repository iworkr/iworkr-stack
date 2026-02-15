"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { Spinner, CheckmarkDraw } from "./spinner";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const integrations: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "For instant invoices & payments.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
  {
    id: "xero",
    name: "Xero",
    description: "Sync invoices automatically.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 13.089l-3.47-3.472a.266.266 0 010-.377l3.47-3.471a.756.756 0 000-1.07.756.756 0 00-1.07 0l-3.471 3.47a.266.266 0 01-.377 0l-3.471-3.47a.756.756 0 00-1.07 0 .756.756 0 000 1.07l3.47 3.471a.266.266 0 010 .377l-3.47 3.472a.756.756 0 000 1.07.756.756 0 001.07 0l3.471-3.471a.266.266 0 01.377 0l3.471 3.471a.756.756 0 001.07 0 .756.756 0 000-1.07z" />
      </svg>
    ),
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Two-way dispatch sync.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H5.684v5.684h12.632zM0 18.316h5.684V5.684H0v12.632zM5.684 24H0v-5.684h5.684V24zM18.316 24H24v-5.684h-5.684V24zM18.316 0H24v5.684h-5.684V0zM0 5.684h5.684V0H0v5.684z" />
      </svg>
    ),
  },
];

type ConnectState = "idle" | "connecting" | "connected";

function IntegrationRow({
  integration,
  index,
}: {
  integration: Integration;
  index: number;
}) {
  const { connectedIntegrations, toggleIntegration } = useOnboardingStore();
  const isConnected = connectedIntegrations.includes(integration.id);
  const [state, setState] = useState<ConnectState>(
    isConnected ? "connected" : "idle"
  );

  function handleConnect() {
    if (state !== "idle") return;
    setState("connecting");
    setTimeout(() => {
      setState("connected");
      toggleIntegration(integration.id);
    }, 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.3 + index * 0.1,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex items-center gap-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 transition-colors hover:border-[rgba(255,255,255,0.12)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-zinc-400">
        {integration.icon}
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-200">
          {integration.name}
        </div>
        <div className="text-xs text-zinc-500">{integration.description}</div>
      </div>

      <button
        onClick={handleConnect}
        disabled={state !== "idle"}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
          state === "connected"
            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : state === "connecting"
              ? "border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-zinc-400"
              : "border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-zinc-200 hover:bg-[rgba(255,255,255,0.1)]"
        }`}
      >
        {state === "connecting" && (
          <>
            <Spinner size={14} />
            <span>Connecting...</span>
          </>
        )}
        {state === "connected" && (
          <>
            <CheckmarkDraw size={14} />
            <span>Linked</span>
          </>
        )}
        {state === "idle" && <span>Connect</span>}
      </button>
    </motion.div>
  );
}

export function StepIntegrations() {
  const { advanceStep } = useOnboardingStore();

  // Cmd+Enter to skip
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        advanceStep();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advanceStep]);

  return (
    <div className="space-y-8">
      {/* Question */}
      <div className="space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl font-medium tracking-tight text-zinc-100 md:text-3xl"
        >
          Connect your ecosystem.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-zinc-500"
        >
          Integrations sync in real-time. Connect now or configure later from
          settings.
        </motion.p>
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {integrations.map((integration, i) => (
          <IntegrationRow
            key={integration.id}
            integration={integration}
            index={i}
          />
        ))}
      </div>

      {/* Continue */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => advanceStep()}
          className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-zinc-200"
        >
          Continue
          <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ↵
          </kbd>
        </button>
        <button
          onClick={() => advanceStep()}
          className="px-4 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
