"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { BlockType } from "@/lib/forms-data";
import { SlashCommandPopover } from "./slash-command-popover";

export function EmptyBlock({
  onSelectType,
  placeholder = "Type '/' for tools...",
}: {
  onSelectType: (type: BlockType) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const v = value.trim();
    if (v === "/" || v.startsWith("/")) {
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }, [value]);

  const handleSelect = (type: BlockType) => {
    onSelectType(type);
    setValue("");
    setSlashOpen(false);
  };

  return (
    <>
      <div
        className="group flex min-h-[52px] items-start gap-2 rounded-lg py-2 pl-1"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-zinc-700 group-hover:text-zinc-500">
          <Plus size={14} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-w-[200px] flex-1 bg-transparent text-[13px] text-zinc-500 outline-none placeholder-zinc-700"
        />
      </div>
      <SlashCommandPopover
        open={slashOpen}
        query={value.replace(/^\s*\/\s*/, "").trim()}
        onSelect={handleSelect}
        onClose={() => setSlashOpen(false)}
        anchorRef={inputRef}
      />
    </>
  );
}
