"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { broadcastMessage } from "@/app/actions/messenger";
import { useToastStore } from "@/components/app/action-toast";

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  userId: string;
}

export function BroadcastModal({
  open,
  onClose,
  orgId,
  userId,
}: BroadcastModalProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (open) {
      setMessage("");
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !orgId?.trim() || sending) return;

    setSending(true);
    const result = await broadcastMessage(orgId, message.trim(), userId);
    setSending(false);

    if (result.error) {
      addToast(result.error, undefined, "error");
    } else {
      addToast("Broadcast sent to all channels");
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Megaphone size={15} strokeWidth={1.5} className="text-emerald-500" />
            <h3 className="font-display text-[15px] font-semibold text-white">
              Team broadcast
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-5 py-4">
            <p className="mb-3 text-[12px] text-zinc-500">
              This message will be sent to all group channels in your organization.
            </p>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your broadcast message..."
              rows={4}
              maxLength={10000}
              className="w-full resize-none rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-3 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
            />
            <p className="mt-2 text-right text-[10px] text-zinc-700">
              {message.length}/10000 &middot; &#8984;Enter to send
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-[12px] font-semibold text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Megaphone size={13} />
                  Send broadcast
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
