"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Paperclip, MapPin, BarChart3 } from "lucide-react";

interface ChatAttachmentMenuProps {
  onImageSelected: (file: File) => void;
  onFileSelected: (file: File) => void;
  onShareLocation: () => void;
  onCreatePoll: () => void;
  isUploading?: boolean;
}

export function ChatAttachmentMenu({
  onImageSelected,
  onFileSelected,
  onShareLocation,
  onCreatePoll,
  isUploading = false,
}: ChatAttachmentMenuProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/90 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImageSelected(file);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.csv,.txt,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        disabled={isUploading}
        onClick={() => imageInputRef.current?.click()}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImageIcon size={13} className="text-blue-400" />
        Upload Image
      </button>

      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Paperclip size={13} className="text-zinc-400" />
        Upload File
      </button>

      <button
        type="button"
        disabled={isUploading}
        onClick={onShareLocation}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MapPin size={13} className="text-emerald-400" />
        Share Location
      </button>

      <button
        type="button"
        disabled={isUploading}
        onClick={onCreatePoll}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BarChart3 size={13} className="text-amber-400" />
        Create Poll
      </button>
    </motion.div>
  );
}
