"use client";

import { useState, useRef, useCallback } from "react";
import {
  Paperclip,
  Smile,
  Mic,
  Send,
  MapPin,
  BarChart3,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMessengerStore } from "@/lib/stores/messenger-store";

interface MessageInputProps {
  channelId: string;
  userId: string;
  userProfile: { id: string; full_name: string; avatar_url: string | null };
}

const quickEmojis = ["👍", "🔥", "✅", "👀", "❤️", "😂", "🎉", "💪"];

export function MessageInput({ channelId, userId, userProfile }: MessageInputProps) {
  const { sendMessage, sendingMessage } = useMessengerStore();
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setContent("");
    await sendMessage(channelId, trimmed, userId, userProfile);
    inputRef.current?.focus();
  }, [content, channelId, userId, userProfile, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSendPoll = useCallback(async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;

    await sendMessage(
      channelId,
      pollQuestion.trim(),
      userId,
      userProfile,
      "poll",
      { options: validOptions, votes: {} }
    );

    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollCreator(false);
  }, [pollQuestion, pollOptions, channelId, userId, userProfile, sendMessage]);

  const handleSendLocation = useCallback(async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await sendMessage(
            channelId,
            `📍 Location shared`,
            userId,
            userProfile,
            "location",
            { lat: pos.coords.latitude, lng: pos.coords.longitude }
          );
        },
        () => {}
      );
    }
    setShowAttachMenu(false);
  }, [channelId, userId, userProfile, sendMessage]);

  const hasContent = content.trim().length > 0;

  return (
    <div className="relative z-10 px-4 py-3">
      {/* Centered floating composer — max-width 800px (Linear style) */}
      <div className="mx-auto max-w-[800px]">
        {/* Poll creator */}
        <AnimatePresence>
          {showPollCreator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#0A0A0A] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-zinc-300">Create Poll</span>
                <button
                  onClick={() => setShowPollCreator(false)}
                  className="text-zinc-600 hover:text-zinc-400"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question…"
                className="mb-2 w-full rounded-md border border-white/[0.06] bg-transparent px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-emerald-500/30"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="mb-1 flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-md border border-white/[0.05] bg-transparent px-3 py-1 text-[12px] text-zinc-300 outline-none transition-colors focus:border-white/[0.12]"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                      className="text-zinc-700 hover:text-zinc-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  + Add option
                </button>
                <button
                  onClick={handleSendPoll}
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20"
                >
                  Send Poll
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="relative flex items-end gap-2 rounded-lg border border-white/[0.08] bg-[#0C0C0C] px-3 py-2 transition-colors focus-within:border-white/[0.12]">
          {/* Attachment button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAttachMenu(!showAttachMenu);
                setShowEmojiPicker(false);
              }}
              className="shrink-0 rounded p-1 text-zinc-600 transition-colors duration-150 hover:text-white"
            >
              <Paperclip size={16} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-1 shadow-xl"
                >
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200">
                    <ImageIcon size={13} /> Upload Image
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200">
                    <Paperclip size={13} /> Upload File
                  </button>
                  <button
                    onClick={handleSendLocation}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    <MapPin size={13} /> Share Location
                  </button>
                  <button
                    onClick={() => {
                      setShowPollCreator(true);
                      setShowAttachMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    <BarChart3 size={13} /> Create Poll
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text area */}
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message…"
            rows={1}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
            style={{ lineHeight: "1.5" }}
          />

          {/* Emoji */}
          <div className="relative">
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowAttachMenu(false);
              }}
              className="shrink-0 rounded p-1 text-zinc-600 transition-colors duration-150 hover:text-white"
            >
              <Smile size={16} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute right-0 bottom-full mb-2 flex gap-1 rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-1.5 shadow-xl"
                >
                  {quickEmojis.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setContent((prev) => prev + e);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="rounded px-1 py-0.5 text-[16px] transition-colors hover:bg-white/[0.06]"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Voice note */}
          <button className="shrink-0 rounded p-1 text-zinc-600 transition-colors duration-150 hover:text-white">
            <Mic size={16} strokeWidth={1.5} />
          </button>

          {/* Send — Ghost button, emerald when content present */}
          <button
            onClick={handleSend}
            disabled={!hasContent || sendingMessage}
            className={`shrink-0 rounded-md p-1.5 transition-all duration-200 ${
              hasContent
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-zinc-700"
            }`}
          >
            <Send size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
