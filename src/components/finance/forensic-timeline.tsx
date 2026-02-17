"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FileText, Send, Eye, Check, X, Download, Pen, CreditCard,
  AlertTriangle, Clock, ArrowRightLeft, Loader2,
} from "lucide-react";
import { getDocumentEvents, type DocumentEvent } from "@/app/actions/quotes";

const eventConfig: Record<string, { icon: typeof Check; color: string; bg: string }> = {
  created: { icon: FileText, color: "text-zinc-500", bg: "bg-zinc-500/10" },
  updated: { icon: FileText, color: "text-zinc-500", bg: "bg-zinc-500/10" },
  sent: { icon: Send, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.1)]" },
  viewed: { icon: Eye, color: "text-amber-400", bg: "bg-amber-400/10" },
  downloaded: { icon: Download, color: "text-sky-400", bg: "bg-sky-500/10" },
  approved: { icon: Check, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.1)]" },
  rejected: { icon: X, color: "text-red-400", bg: "bg-red-500/10" },
  signed: { icon: Pen, color: "text-purple-400", bg: "bg-purple-500/10" },
  converted: { icon: ArrowRightLeft, color: "text-sky-400", bg: "bg-sky-500/10" },
  payment_started: { icon: CreditCard, color: "text-amber-400", bg: "bg-amber-400/10" },
  paid: { icon: CreditCard, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.1)]" },
  voided: { icon: X, color: "text-red-400", bg: "bg-red-500/10" },
  reminder_sent: { icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
  overdue: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
};

interface Props {
  docType: "quote" | "invoice";
  docId: string;
}

export function ForensicTimeline({ docType, docId }: Props) {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    getDocumentEvents(docType, docId).then((res) => {
      setEvents(res.data);
      setLoading(false);
    });
  }, [docType, docId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-[11px] text-zinc-600">
        No events yet
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const config = eventConfig[event.event_type] || eventConfig.created;
        const Icon = config.icon;
        const isLast = idx === events.length - 1;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="relative flex gap-3 pb-4"
          >
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[13px] top-7 h-full w-px bg-white/[0.06]" />
            )}

            {/* Icon */}
            <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
              <Icon size={12} className={config.color} />
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p className="text-[12px] text-zinc-300">
                {event.description || formatEventType(event.event_type)}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                <span>{formatTimestamp(event.created_at)}</span>
                {event.actor_email && (
                  <>
                    <span>·</span>
                    <span>{event.actor_email}</span>
                  </>
                )}
                {event.ip_address && (
                  <>
                    <span>·</span>
                    <span>IP: {event.ip_address}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function formatEventType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
