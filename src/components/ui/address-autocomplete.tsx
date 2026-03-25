/**
 * @component AddressAutocomplete
 * @status COMPLETE
 * @description Reusable address input with Mapbox Geocoding autocomplete dropdown.
 *   Uses the project's Mapbox access token (same as static/inline maps).
 *   Linear/Obsidian-themed with Framer Motion dropdown, keyboard navigation,
 *   and structured address + lat/lng output.
 * @lastAudit 2026-03-23
 */
"use client";

import { useState, useRef, useEffect, useCallback, useId, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import { MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";

/* ── Types ────────────────────────────────────────────── */

export interface AddressResult {
  /** Full formatted address string */
  address: string;
  /** Latitude */
  lat: number | null;
  /** Longitude */
  lng: number | null;
  /** City / locality */
  city?: string;
  /** State / region */
  state?: string;
  /** Postal / ZIP code */
  postalCode?: string;
  /** Country */
  country?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: { id: string; text: string; short_code?: string }[];
  text: string;
  properties?: { accuracy?: string };
}

interface AddressAutocompleteProps {
  /** Current address value (controlled) */
  value: string;
  /** Called on every text change */
  onChange: (value: string) => void;
  /** Called when user selects a suggestion */
  onSelect: (result: AddressResult) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the outer wrapper */
  className?: string;
  /** Additional className for the input element */
  inputClassName?: string;
  /** Style override for the outer wrapper */
  style?: CSSProperties;
  /** Whether input is disabled */
  disabled?: boolean;
  /** onBlur callback (fires after selection or manual blur) */
  onBlur?: () => void;
  /** Country bias — ISO 3166-1 alpha-2 code(s). Default: "au" (Australia) */
  countryBias?: string;
  /** Show the MapPin icon inside the input */
  showIcon?: boolean;
  /** Variant: "default" = rounded bordered input, "underline" = bottom-border only */
  variant?: "default" | "underline";
}

/* ── Mapbox Search API (v6) ──────────────────────────── */

async function searchAddress(
  query: string,
  token: string,
  country: string,
  signal?: AbortSignal,
): Promise<MapboxFeature[]> {
  if (!query || query.length < 3 || !token) return [];

  const url = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" + encodeURIComponent(query) + ".json");
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("types", "address,place,locality,neighborhood,postcode");
  url.searchParams.set("limit", "5");
  if (country) url.searchParams.set("country", country);

  try {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.features ?? [];
  } catch {
    return [];
  }
}

function extractParts(feature: MapboxFeature): AddressResult {
  const ctx = feature.context ?? [];
  const find = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix))?.text;
  return {
    address: feature.place_name,
    lat: feature.center[1],
    lng: feature.center[0],
    city: find("place") || find("locality"),
    state: find("region"),
    postalCode: find("postcode"),
    country: find("country"),
  };
}

/* ── Component ───────────────────────────────────────── */

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search address…",
  className = "",
  inputClassName = "",
  style,
  disabled = false,
  onBlur,
  countryBias = "au",
  showIcon = true,
  variant = "default",
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [justSelected, setJustSelected] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const reactId = useId();
  const listboxId = `address-listbox-${reactId.replace(/:/g, "")}`;

  /* ── Fetch suggestions (debounced) ─────────────────── */
  const fetchSuggestions = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        const results = await searchAddress(query, MAPBOX_ACCESS_TOKEN, countryBias, controller.signal);
        if (!controller.signal.aborted) {
          setSuggestions(results);
          setIsOpen(results.length > 0);
          setFocusedIdx(-1);
          setLoading(false);
        }
      }, 280);
    },
    [countryBias],
  );

  /* ── Input change ──────────────────────────────────── */
  function handleChange(val: string) {
    setJustSelected(false);
    onChange(val);
    fetchSuggestions(val);
  }

  /* ── Select suggestion ─────────────────────────────── */
  function handleSelect(feature: MapboxFeature) {
    const result = extractParts(feature);
    onChange(result.address);
    onSelect(result);
    setSuggestions([]);
    setIsOpen(false);
    setFocusedIdx(-1);
    setJustSelected(true);
    // Bring focus back to input after selection
    setTimeout(() => inputRef.current?.blur(), 0);
  }

  /* ── Keyboard navigation ───────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIdx >= 0 && suggestions[focusedIdx]) {
          handleSelect(suggestions[focusedIdx]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setFocusedIdx(-1);
        break;
    }
  }

  /* ── Click-outside ─────────────────────────────────── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Cleanup on unmount ────────────────────────────── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /* ── Styling ───────────────────────────────────────── */
  const defaultInputClass =
    "w-full rounded-[var(--radius-input,8px)] border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 transition-all duration-150 focus:border-[rgba(255,255,255,0.15)] focus:bg-[rgba(255,255,255,0.02)]";

  const underlineInputClass =
    "w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]";

  const baseInputClass = variant === "underline" ? underlineInputClass : defaultInputClass;
  const iconPadding = showIcon ? (variant === "underline" ? "pl-5" : "pl-8") : "";

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style}>
      {/* Input with optional icon */}
      <div className="relative">
        {showIcon && (
          <div
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
              variant === "underline" ? "left-0" : "left-2.5"
            }`}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin text-zinc-600" />
            ) : (
              <MapPin size={12} className="text-zinc-600" />
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && !justSelected) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay blur so clicks on suggestions register first
            setTimeout(() => {
              onBlur?.();
            }, 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className={`${baseInputClass} ${iconPadding} ${inputClassName}`}
        />
      </div>

      {/* ── Suggestions dropdown ─────────────────────── */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.ul
            id={listboxId}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            className="absolute left-0 right-0 z-[60] mt-1.5 max-h-[220px] overflow-y-auto rounded-[var(--radius-dropdown,8px)] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-[var(--shadow-dropdown,0_16px_48px_-8px_rgba(0,0,0,0.6))]"
          >
            {suggestions.map((feature, i) => {
              const isFocused = i === focusedIdx;
              /* Split: bold main text, muted secondary */
              const mainText = feature.text;
              const secondaryText = feature.place_name
                .replace(mainText, "")
                .replace(/^,\s*/, "");

              return (
                <motion.li
                  key={feature.id}
                  role="option"
                  aria-selected={isFocused}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onMouseEnter={() => setFocusedIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleSelect(feature);
                  }}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-[6px] px-2.5 py-2 transition-colors duration-75 ${
                    isFocused
                      ? "bg-[rgba(255,255,255,0.06)] text-white"
                      : "text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]"
                  }`}
                >
                  <MapPin
                    size={13}
                    className={`mt-0.5 shrink-0 transition-colors ${
                      isFocused ? "text-[var(--brand,#10B981)]" : "text-zinc-700"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[13px] font-medium leading-tight ${
                        isFocused ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      {mainText}
                    </div>
                    {secondaryText && (
                      <div className="mt-0.5 truncate text-[11px] leading-tight text-zinc-600">
                        {secondaryText}
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}

            {/* Powered-by attribution (Mapbox TOS requires this) */}
            <div className="mt-0.5 border-t border-[rgba(255,255,255,0.05)] px-2.5 pt-1.5 pb-1">
              <span className="text-[9px] text-zinc-700">
                Powered by Mapbox
              </span>
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
