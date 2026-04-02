/**
 * @module lib/hooks/use-debounce.ts
 * @status STABLE
 * @description Shared React hooks — use-debounce
 * @lastReview 2026-03-28
 */
"use client";

import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

