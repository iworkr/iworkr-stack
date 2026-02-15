"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { companyNameSchema } from "@/lib/validation";
import { CheckmarkDraw } from "./spinner";

export function StepIdentity() {
  const { companyName, workspaceSlug, setCompanyName, advanceStep } =
    useOnboardingStore();
  const [localName, setLocalName] = useState(companyName);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validate = useCallback((value: string) => {
    if (!value.trim()) {
      setError(null);
      setValidated(false);
      return;
    }
    const result = companyNameSchema.safeParse(value);
    if (result.success) {
      setError(null);
      setValidated(true);
    } else {
      setError(result.error.issues[0].message);
      setValidated(false);
    }
  }, []);

  function handleChange(value: string) {
    setLocalName(value);
    setCompanyName(value);
    setValidated(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validate(value), 500);
  }

  function handleSubmit() {
    const result = companyNameSchema.safeParse(localName);
    if (result.success) {
      setValidated(true);
      setTimeout(() => advanceStep(), 300);
    } else {
      setError(result.error.issues[0].message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

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
          What is your company called?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-zinc-500"
        >
          This becomes your workspace identity across iWorkr.
        </motion.p>
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localName}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Apex Plumbing"
            className="w-full border-b border-[rgba(255,255,255,0.1)] bg-transparent py-3 text-xl font-medium text-zinc-100 outline-none transition-colors duration-300 placeholder:text-zinc-700 focus:border-white"
            autoComplete="off"
          />

          {/* Validation indicator */}
          <div className="absolute top-1/2 right-0 -translate-y-1/2">
            {validated && (
              <span className="text-emerald-400">
                <CheckmarkDraw size={20} />
              </span>
            )}
          </div>
        </div>

        {/* Auto-generated slug */}
        {localName.trim() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-zinc-600">Your workspace</span>
            <span className="font-mono text-xs text-zinc-400">
              iworkr.app/
              {workspaceSlug.split("").map((char, i) => (
                <motion.span
                  key={`${i}-${char}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.03,
                    duration: 0.15,
                    ease: "easeOut",
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </span>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-400/80"
          >
            {error}
          </motion.p>
        )}
      </motion.div>

      {/* Submit hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: validated ? 1 : 0.3 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2"
      >
        <button
          onClick={handleSubmit}
          disabled={!validated && !localName.trim()}
          className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white"
        >
          Continue
          <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            ↵
          </kbd>
        </button>
      </motion.div>
    </div>
  );
}
