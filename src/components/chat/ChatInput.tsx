"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Paperclip,
  Smile,
  Mic,
  Send,
  BarChart3,
  X,
  Zap,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { ChatAttachmentMenu } from "./ChatAttachmentMenu";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/components/app/action-toast";

interface ChatInputProps {
  channelId: string;
  userId: string;
  userProfile: { id: string; full_name: string; avatar_url: string | null };
}

const quickEmojis = ["👍", "🔥", "✅", "👀", "❤️", "😂", "🎉", "💪"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const slashCommands = [
  { command: "/urgency", label: "Mark as Urgent", icon: Zap, accent: "text-rose-400" },
  { command: "/gif", label: "Send a GIF", icon: Palette, accent: "text-violet-400" },
  { command: "/attach", label: "Attach a file", icon: Paperclip, accent: "text-blue-400" },
  { command: "/poll", label: "Create a Poll", icon: BarChart3, accent: "text-amber-400" },
];

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function ChatInput({ channelId, userId, userProfile }: ChatInputProps) {
  const sendMessage = useMessengerStore((s) => s.sendMessage);
  const sendingMessage = useMessengerStore((s) => s.sendingMessage);
  const toast = useToastStore();
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [sendAnimating, setSendAnimating] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendControls = useAnimation();

  useEffect(() => {
    setShowSlashMenu(content === "/");
  }, [content]);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSendAnimating(true);
    sendControls.start({
      x: [0, 8, -40],
      y: [0, -4, -20],
      opacity: [1, 1, 0],
      scale: [1, 1.1, 0.6],
      transition: { duration: 0.35, ease: "easeOut" },
    });

    setTimeout(() => {
      setSendAnimating(false);
      sendControls.set({ x: 0, y: 0, opacity: 1, scale: 1 });
    }, 400);

    setContent("");
    await sendMessage(channelId, trimmed, userId, userProfile);
    inputRef.current?.focus();
  }, [content, channelId, userId, userProfile, sendMessage, sendControls]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSlashCommand = useCallback((cmd: string) => {
    setShowSlashMenu(false);
    if (cmd === "/poll") {
      setContent("");
      setShowPollCreator(true);
    } else if (cmd === "/attach") {
      setContent("");
      setShowAttachMenu(true);
    } else if (cmd === "/urgency") {
      setContent("🚨 URGENT: ");
    } else if (cmd === "/gif") {
      setContent("");
    }
    inputRef.current?.focus();
  }, []);

  const handleSendPoll = useCallback(async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;

    await sendMessage(
      channelId,
      pollQuestion.trim(),
      userId,
      userProfile,
      "poll",
      { options: validOptions, votes: {} },
    );

    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollCreator(false);
  }, [pollQuestion, pollOptions, channelId, userId, userProfile, sendMessage]);

  const uploadAttachment = useCallback(
    async (file: File, messageType: "image" | "file") => {
      if (uploadingAttachment) return;

      const isImage = messageType === "image";
      if (isImage && !file.type.startsWith("image/")) {
        toast.addToast("Please select a valid image file.", undefined, "error");
        return;
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        toast.addToast("Image exceeds 15MB limit.", undefined, "error");
        return;
      }
      if (!isImage && file.size > MAX_FILE_BYTES) {
        toast.addToast("File exceeds 20MB limit.", undefined, "error");
        return;
      }

      setUploadingAttachment(true);
      setShowAttachMenu(false);

      const supabase = createClient();
      const filePath = `${channelId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("chat_attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        toast.addToast("Upload failed. Please try again.", undefined, "error");
        setUploadingAttachment(false);
        return;
      }

      await sendMessage(
        channelId,
        isImage ? `Uploaded image: ${file.name}` : `Uploaded file: ${file.name}`,
        userId,
        userProfile,
        messageType,
        {
          media_path: filePath,
          filename: file.name,
          size: file.size,
          mime_type: file.type || "application/octet-stream",
        },
      );

      setUploadingAttachment(false);
    },
    [channelId, userId, userProfile, sendMessage, toast, uploadingAttachment],
  );

  const handleSendLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.addToast("Geolocation is not supported by your browser.", undefined, "error");
      setShowAttachMenu(false);
      return;
    }

    setShowAttachMenu(false);
    toast.addToast("Acquiring GPS coordinates…", undefined, "info");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await sendMessage(
          channelId,
          "Shared a location",
          userId,
          userProfile,
          "location",
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        );
      },
      () => {
        toast.addToast("Permission denied or location unavailable.", undefined, "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [channelId, userId, userProfile, sendMessage, toast]);

  const hasContent = content.trim().length > 0;

  return (
    <div className="relative z-10 m-4 pt-2">
      <div className="mx-auto max-w-[800px]">
        <AnimatePresence>
          {showSlashMenu && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="mb-2 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/90 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              <div className="px-2 py-1.5">
                <span className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                  Commands
                </span>
              </div>
              {slashCommands.map((sc) => (
                <button
                  key={sc.command}
                  onClick={() => handleSlashCommand(sc.command)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] text-zinc-400 transition-colors duration-100 hover:bg-white/[0.04] hover:text-white"
                >
                  <sc.icon size={14} className={sc.accent} />
                  <span className="font-mono text-[11px] text-zinc-500">{sc.command}</span>
                  <span className="ml-1 text-zinc-500">{sc.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPollCreator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-zinc-200">Create Poll</span>
                <button
                  onClick={() => setShowPollCreator(false)}
                  className="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question…"
                className="mb-3 w-full rounded-lg bg-transparent px-0 py-1 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-b focus:border-emerald-500/30"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-zinc-700">{String.fromCharCode(65 + i)}</span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-transparent px-0 py-1 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
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
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="text-[11px] text-zinc-600 transition-colors hover:text-emerald-500"
                >
                  + Add option
                </button>
                <button
                  onClick={handleSendPoll}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-emerald-500"
                >
                  Send Poll
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-end gap-2 rounded-xl border border-white/5 bg-zinc-900/80 px-3.5 py-2.5 backdrop-blur-md transition-all duration-200 focus-within:border-white/10 focus-within:shadow-lg focus-within:shadow-black/30">
          <div className="relative">
            <button
              onClick={() => {
                setShowAttachMenu(!showAttachMenu);
                setShowEmojiPicker(false);
              }}
              className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <Paperclip size={15} strokeWidth={1.5} />
            </button>

            <AnimatePresence>
              {showAttachMenu && (
                <ChatAttachmentMenu
                  isUploading={uploadingAttachment}
                  onImageSelected={(file) => void uploadAttachment(file, "image")}
                  onFileSelected={(file) => void uploadAttachment(file, "file")}
                  onShareLocation={() => void handleSendLocation()}
                  onCreatePoll={() => {
                    setShowPollCreator(true);
                    setShowAttachMenu(false);
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message… (type / for commands)"
            rows={1}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
          />

          <div className="relative">
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowAttachMenu(false);
              }}
              className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <Smile size={15} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 bottom-full mb-2 flex gap-0.5 rounded-xl border border-white/[0.06] bg-zinc-900/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                >
                  {quickEmojis.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setContent((prev) => prev + e);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="rounded-lg px-1 py-0.5 text-[16px] transition-colors hover:bg-white/[0.08]"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300">
            <Mic size={15} strokeWidth={1.5} />
          </button>

          <button
            onClick={handleSend}
            disabled={!hasContent || sendingMessage || sendAnimating || uploadingAttachment}
            className={`shrink-0 overflow-hidden rounded-lg p-1.5 transition-all duration-200 ${
              hasContent
                ? "text-zinc-500 hover:text-white"
                : "cursor-default text-zinc-600"
            }`}
          >
            <motion.div animate={sendControls}>
              <Send size={14} strokeWidth={1.5} />
            </motion.div>
          </button>
        </div>
      </div>
    </div>
  );
}
