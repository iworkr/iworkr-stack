"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  User,
  Briefcase,
  DollarSign,
  Clock,
  UserPlus,
  X,
  PhoneForwarded,
  Wifi,
  WifiOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getScreenPopData, type ScreenPopData } from "@/app/actions/synapse-comms";

/* ── Types ──────────────────────────────────────────────── */
interface InboundCallEvent {
  call_sid: string;
  from_number: string;
  to_number: string;
  workspace_id: string;
  screen_pop: ScreenPopData;
  timestamp: string;
}

interface ScreenPopProps {
  orgId: string;
  onAccept?: (callSid: string) => void;
  onDecline?: (callSid: string) => void;
}

/* ── Component ──────────────────────────────────────────── */
export function ScreenPop({ orgId, onAccept, onDecline }: ScreenPopProps) {
  const [incomingCall, setIncomingCall] = useState<InboundCallEvent | null>(null);
  const [callState, setCallState] = useState<"idle" | "ringing" | "active" | "ended">("idle");
  const [callTimer, setCallTimer] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<"good" | "fair" | "poor">("good");

  // ── Subscribe to Realtime inbound-call broadcast ──
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`inbound-call:${orgId}`)
      .on("broadcast", { event: "inbound_call" }, (payload) => {
        const data = payload.payload as InboundCallEvent;
        setIncomingCall(data);
        setCallState("ringing");
      })
      .on("broadcast", { event: "call_ended" }, () => {
        setCallState("ended");
        setTimeout(() => {
          setIncomingCall(null);
          setCallState("idle");
          setCallTimer(0);
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  // ── Call timer ──
  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => setCallTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    setCallState("active");
    onAccept?.(incomingCall.call_sid);
  }, [incomingCall, onAccept]);

  const handleDecline = useCallback(() => {
    if (!incomingCall) return;
    setCallState("ended");
    onDecline?.(incomingCall.call_sid);
    setTimeout(() => {
      setIncomingCall(null);
      setCallState("idle");
    }, 1000);
  }, [incomingCall, onDecline]);

  const handleHangup = useCallback(() => {
    setCallState("ended");
    setTimeout(() => {
      setIncomingCall(null);
      setCallState("idle");
      setCallTimer(0);
    }, 2000);
  }, []);

  if (!incomingCall || callState === "idle") return null;

  const pop = incomingCall.screen_pop;
  const isKnown = pop?.found === true;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-4 top-4 z-[100] w-[380px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-2xl shadow-black/50"
      >
        {/* ── Header: Status bar ── */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${
          callState === "ringing"
            ? "bg-emerald-500/10 border-b border-emerald-500/20"
            : callState === "active"
            ? "bg-blue-500/10 border-b border-blue-500/20"
            : "bg-zinc-800/50 border-b border-white/[0.06]"
        }`}>
          <div className="flex items-center gap-2">
            {callState === "ringing" && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <PhoneIncoming size={14} className="text-emerald-400" />
              </motion.div>
            )}
            {callState === "active" && <Phone size={14} className="text-blue-400" />}
            {callState === "ended" && <PhoneOff size={14} className="text-zinc-500" />}

            <span className="font-mono text-[11px] font-medium tracking-wide uppercase">
              {callState === "ringing" && (
                <span className="text-emerald-400">Incoming Call</span>
              )}
              {callState === "active" && (
                <span className="text-blue-400">Active · {formatDuration(callTimer)}</span>
              )}
              {callState === "ended" && (
                <span className="text-zinc-500">Call Ended</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {callState === "active" && (
              <div className="flex items-center gap-1">
                {networkQuality === "good" && <Wifi size={12} className="text-emerald-400" />}
                {networkQuality === "fair" && <Wifi size={12} className="text-amber-400" />}
                {networkQuality === "poor" && <WifiOff size={12} className="text-rose-400" />}
              </div>
            )}
            <button
              onClick={() => {
                setIncomingCall(null);
                setCallState("idle");
                setCallTimer(0);
              }}
              className="rounded p-0.5 text-zinc-600 transition hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Caller Identity ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isKnown ? "bg-emerald-500/15" : "bg-zinc-800"
            }`}>
              <User size={18} className={isKnown ? "text-emerald-400" : "text-zinc-500"} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold text-white">
                {isKnown ? pop.client_name : "Unknown Caller"}
              </h3>
              <p className="font-mono text-[12px] text-zinc-500">
                {incomingCall.from_number}
              </p>
              {isKnown && pop.client_email && (
                <p className="truncate text-[11px] text-zinc-600">{pop.client_email}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Context Cards (only if known) ── */}
        {isKnown && (
          <div className="space-y-2 px-4 pb-3">
            {/* Outstanding Balance */}
            {pop.outstanding_balance && Number(pop.outstanding_balance) > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <DollarSign size={14} className="shrink-0 text-rose-400" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Outstanding
                  </p>
                  <p className="text-[14px] font-semibold text-rose-400">
                    ${Number(pop.outstanding_balance).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {/* Active Jobs */}
            {pop.active_jobs && pop.active_jobs.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Active Jobs
                </p>
                <div className="space-y-1">
                  {pop.active_jobs.slice(0, 3).map((job: any) => (
                    <div key={job.id} className="flex items-center gap-2">
                      <Briefcase size={11} className="shrink-0 text-emerald-400/70" />
                      <span className="truncate text-[12px] text-zinc-300">
                        <span className="font-mono text-emerald-400">{job.display_id}</span>
                        {" — "}
                        {job.title}
                      </span>
                      <span className="ml-auto shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase text-zinc-500">
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Comms */}
            {pop.recent_comms && pop.recent_comms.length > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Recent Activity
                </p>
                <div className="space-y-1">
                  {pop.recent_comms.slice(0, 2).map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <Clock size={10} className="shrink-0" />
                      <span className="capitalize">{c.channel?.replace("_", " ")}</span>
                      <span className="capitalize">{c.direction}</span>
                      {c.subject && <span className="truncate text-zinc-600">· {c.subject}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Unknown Caller: Create Lead ── */}
        {!isKnown && callState !== "ended" && (
          <div className="px-4 pb-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.1] bg-white/[0.02] px-3 py-2.5 text-[12px] font-medium text-zinc-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400">
              <UserPlus size={14} />
              Create Lead / New Job
            </button>
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="border-t border-white/[0.06] px-4 py-3">
          {callState === "ringing" && (
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAccept}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                <Phone size={16} />
                Accept
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDecline}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-4 py-3 text-[13px] font-semibold text-rose-400 transition hover:bg-rose-500/25"
              >
                <PhoneOff size={16} />
                Decline
              </motion.button>
            </div>
          )}

          {callState === "active" && (
            <div className="flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.06]">
                Hold
              </button>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.06]">
                <PhoneForwarded size={12} />
                Transfer
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleHangup}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/25"
              >
                <PhoneOff size={12} />
                End
              </motion.button>
            </div>
          )}

          {callState === "ended" && (
            <div className="text-center text-[12px] text-zinc-600">
              Call ended · {formatDuration(callTimer)}
            </div>
          )}
        </div>

        {/* ── Network Warning ── */}
        <AnimatePresence>
          {callState === "active" && networkQuality === "poor" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-amber-500/20 bg-amber-500/5 px-4 py-2"
            >
              <div className="flex items-center gap-2 text-[11px] text-amber-400">
                <WifiOff size={12} />
                <span>Network Unstable</span>
                <button className="ml-auto rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium transition hover:bg-amber-500/30">
                  Bridge to Mobile
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
