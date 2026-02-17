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
        () => {
          // Geolocation denied
        }
      );
    }
    setShowAttachMenu(false);
  }, [channelId, userId, userProfile, sendMessage]);

  return (
    <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
      {/* Poll creator */}
      <AnimatePresence>
        {showPollCreator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
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
              className="mb-2 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-1.5 text-[13px] text-zinc-200 outline-none focus:border-[#00E676]/40"
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
                  className="flex-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-1 text-[12px] text-zinc-300 outline-none focus:border-[rgba(255,255,255,0.15)]"
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
                className="text-[11px] text-zinc-600 hover:text-zinc-400"
              >
                + Add option
              </button>
              <button
                onClick={handleSendPoll}
                className="rounded-md bg-[#00E676] px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-[#00C853]"
              >
                Send Poll
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="relative flex items-end gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
        {/* Attachment button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAttachMenu(!showAttachMenu);
              setShowEmojiPicker(false);
            }}
            className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <Paperclip size={16} />
          </button>
          <AnimatePresence>
            {showAttachMenu && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] p-1 shadow-xl"
              >
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-200"
                >
                  <ImageIcon size={13} /> Upload Image
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-200"
                >
                  <Paperclip size={13} /> Upload File
                </button>
                <button
                  onClick={handleSendLocation}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-200"
                >
                  <MapPin size={13} /> Share Location
                </button>
                <button
                  onClick={() => {
                    setShowPollCreator(true);
                    setShowAttachMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-200"
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
          placeholder={`Message #${channelId.slice(0, 8)}…`}
          rows={1}
          className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700"
          style={{ lineHeight: "1.5" }}
        />

        {/* Emoji */}
        <div className="relative">
          <button
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachMenu(false);
            }}
            className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <Smile size={16} />
          </button>
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 bottom-full mb-2 flex gap-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] p-1.5 shadow-xl"
              >
                {quickEmojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setContent((prev) => prev + e);
                      setShowEmojiPicker(false);
                      inputRef.current?.focus();
                    }}
                    className="rounded px-1 py-0.5 text-[16px] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                  >
                    {e}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice note */}
        <button className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
          <Mic size={16} />
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!content.trim() || sendingMessage}
          className={`shrink-0 rounded-md p-1.5 transition-all ${
            content.trim()
              ? "bg-[#00E676] text-black hover:bg-[#00C853]"
              : "text-zinc-700"
          }`}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
