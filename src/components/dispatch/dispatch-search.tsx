"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface DispatchSearchProps {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  /** Cmd+K to open */
}

export function DispatchSearch({ open, onClose, onSearch }: DispatchSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onClose();
        // Toggle is handled by parent
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute left-1/2 top-4 z-20 w-full max-w-md -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-950/90 px-3 py-2 shadow-xl backdrop-blur-md">
        <Search size={14} className="shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSearch(query);
              onClose();
            }
          }}
          placeholder="Job ID or Technician name…"
          className="flex-1 bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
