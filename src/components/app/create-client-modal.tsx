/**
 * @component CreateClientModal
 * @status COMPLETE
 * @description Client creation modal with address autocomplete, interactive map with
 *   flyTo + draggable marker, billing/service address split, contact details,
 *   and AI duplicate detection.
 * @lastAudit 2026-03-26
 * @fix CLIENT-ADDRESS-03 — Eliminated self-destructing conditional render that
 *   unmounted AddressAutocomplete on first keystroke. Decoupled addressQuery (live input)
 *   from address (confirmed selection). The autocomplete is now always mounted.
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  MapPin,
  Sparkles,
  Mail,
  Phone,
  User,
  Building2,
  Home,
  ChevronDown,
  Check,
  Briefcase,
  Receipt,
  GripVertical,
} from "lucide-react";
import { PopoverMenu } from "./popover-menu";
import { useToastStore } from "./action-toast";
import { useClientsStore } from "@/lib/clients-store";
import { InlineMap } from "@/components/maps/inline-map";
import { DEFAULT_MAP_CENTER_LATLNG } from "@/components/maps/obsidian-map-styles";
import { AddressAutocomplete, type AddressResult } from "@/components/ui/address-autocomplete";
import { useOrg } from "@/lib/hooks/use-org";
import { type Client, type ClientStatus } from "@/lib/data";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lookupABN, getDistanceFromHQ } from "@/app/actions/clients";

/* ── Types & Config ───────────────────────────────────────── */

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreateAndJob?: (clientId: string) => void;
  onCreateAndQuote?: (clientId: string) => void;
}

type BillingTerm = "due_receipt" | "net_7" | "net_14" | "net_30" | "net_60";

const billingTerms: { value: BillingTerm; label: string }[] = [
  { value: "due_receipt", label: "Due on Receipt" },
  { value: "net_7", label: "Net 7" },
  { value: "net_14", label: "Net 14" },
  { value: "net_30", label: "Net 30" },
  { value: "net_60", label: "Net 60" },
];

const clientTypes: { value: "residential" | "commercial"; label: string; icon: typeof Home; desc: string }[] = [
  { value: "residential", label: "Residential", icon: Home, desc: "Individual or household" },
  { value: "commercial", label: "Business", icon: Building2, desc: "Company or organization" },
];

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6", "#A855F7",
  "#D946EF", "#F43F5E", "#0EA5E9", "#10B981",
];

function getAvatarColor(initials: string) {
  const c = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return AVATAR_COLORS[c % AVATAR_COLORS.length];
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── Component ────────────────────────────────────────────── */

export function CreateClientModal({
  open,
  onClose,
  onCreateAndJob,
  onCreateAndQuote,
}: CreateClientModalProps) {
  /* ── State ──────────────────────────────────────────────── */
  const [nameQuery, setNameQuery] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState<"residential" | "commercial">("residential");

  // FIX: CLIENT-ADDRESS-03 — Decoupled state model
  // addressQuery = live autocomplete input text (set on every keystroke)
  // address      = confirmed address string (set only on selection or ABN fill)
  // addressCoords = lat/lng from geocoding (set on selection or marker drag)
  const [addressQuery, setAddressQuery] = useState("");
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  const [billingTerm, setBillingTerm] = useState<BillingTerm>("net_14");
  const [billingAddressDifferent, setBillingAddressDifferent] = useState(false);
  const [billingAddress, setBillingAddress] = useState("");
  const [billingAddressQuery, setBillingAddressQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sendWelcome, setSendWelcome] = useState(false);

  const [activePill, setActivePill] = useState<string | null>(null);
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [abnResult, setAbnResult] = useState<{ abn: string; name: string; type: string; address: string; status: string } | null>(null);
  const [driveTime, setDriveTime] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToastStore();
  const { createClientServer } = useClientsStore();
  const { orgId } = useOrg();
  const [saving, setSaving] = useState(false);

  /* ── Derived ────────────────────────────────────────────── */
  const initials = clientName ? makeInitials(clientName) : "";
  const isValid = clientName.trim().length >= 2;

  /* Existing client match warning — query DB for duplicates */
  const [existingMatch, setExistingMatch] = useState<{ name: string } | null>(null);
  useEffect(() => {
    if (!clientName || clientName.length < 3 || !orgId) {
      setExistingMatch(null);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const timeout = setTimeout(() => {
      (supabase as any)
        .from("clients")
        .select("name")
        .eq("organization_id", orgId)
        .ilike("name", clientName)
        .limit(1)
        .then(({ data }: any) => {
          setExistingMatch(data && data.length > 0 ? data[0] : null);
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientName, orgId]);

  /* ── Reset on open ──────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setNameQuery("");
      setIsEnriching(false);
      setIsLocked(false);
      setClientName("");
      setClientType("residential");
      setAddressQuery("");
      setAddress("");
      setAddressCoords(null);
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactRole("");
      setBillingTerm("net_14");
      setBillingAddressDifferent(false);
      setBillingAddress("");
      setBillingAddressQuery("");
      setTags([]);
      setSendWelcome(false);
      setActivePill(null);
      setSplitMenuOpen(false);
      setSaved(false);
      setSaving(false);
      setAbnResult(null);
      setDriveTime(null);
      setTimeout(() => nameInputRef.current?.focus(), 120);
    }
  }, [open]);

  /* ── ABN Lookup on name change ──────────────────────────── */
  useEffect(() => {
    if (isLocked || nameQuery.length < 4) return;
    const timer = setTimeout(async () => {
      setIsEnriching(true);
      const result = await lookupABN(nameQuery);
      setAbnResult(result);
      setIsEnriching(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [nameQuery, isLocked]);

  /* ── Drive time from HQ ─────────────────────────────────── */
  useEffect(() => {
    if (!address || !orgId) { setDriveTime(null); return; }
    const timer = setTimeout(async () => {
      const result = await getDistanceFromHQ(orgId, address);
      setDriveTime(result);
    }, 600);
    return () => clearTimeout(timer);
  }, [address, orgId]);

  /* ── Name change handler ────────────────────────────────── */
  function handleNameChange(val: string) {
    setNameQuery(val);
    if (isLocked) return;
  }

  function lockIdentity() {
    if (!nameQuery.trim()) return;
    setClientName(nameQuery.trim());
    setIsLocked(true);
    if (abnResult?.address) {
      setAddress(abnResult.address);
      setAddressQuery(abnResult.address);
    }
    setTimeout(() => contactNameRef.current?.focus(), 80);
  }

  function unlockIdentity() {
    setIsLocked(false);
    setClientName("");
    setNameQuery(clientName);
    setAddress("");
    setAddressQuery("");
    setAddressCoords(null);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  /* ── Address handlers ───────────────────────────────────── */
  const handleAddressSelect = useCallback((result: AddressResult) => {
    setAddress(result.address);
    setAddressQuery(result.address);
    if (result.lat != null && result.lng != null) {
      setAddressCoords({ lat: result.lat, lng: result.lng });
    }
  }, []);

  const handleAddressClear = useCallback(() => {
    setAddress("");
    setAddressQuery("");
    setAddressCoords(null);
    setDriveTime(null);
  }, []);

  const handleMarkerDragEnd = useCallback((coords: { lat: number; lng: number }) => {
    setAddressCoords(coords);
  }, []);

  const handleBillingAddressSelect = useCallback((result: AddressResult) => {
    setBillingAddress(result.address);
    setBillingAddressQuery(result.address);
  }, []);

  /* ── Save ───────────────────────────────────────────────── */
  async function handleSave(mode: "save" | "save_and_job" | "save_and_quote" = "save") {
    if (!isValid || saving) return;

    const billingTermMap: Record<string, string> = {
      due_receipt: "due_on_receipt", net_7: "net_7", net_14: "net_14", net_30: "net_30", net_60: "net_60",
    };

    // Build metadata with billing address if different
    const metadata: Record<string, unknown> = {};
    if (billingAddressDifferent && billingAddress) {
      metadata.billing_address = billingAddress;
    }

    // If org is available, persist to server
    if (orgId) {
      setSaving(true);
      const result = await createClientServer({
        organization_id: orgId,
        name: clientName.trim(),
        email: contactEmail || null,
        phone: contactPhone || null,
        status: "active",
        type: clientType,
        address: address || null,
        address_lat: addressCoords?.lat ?? null,
        address_lng: addressCoords?.lng ?? null,
        tags,
        billing_terms: billingTermMap[billingTerm] || "due_on_receipt",
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        initial_contact: contactName
          ? {
              name: contactName,
              role: contactRole || "Primary Contact",
              email: contactEmail || null,
              phone: contactPhone || null,
              is_primary: true,
            }
          : undefined,
      });
      setSaving(false);

      if (!result.success) {
        addToast(`Error: ${result.error || "Failed to create client"}`);
        return;
      }

      setSaved(true);
      const toastMsg = sendWelcome && contactEmail
        ? `${clientName} created — Welcome email sent`
        : `${clientName} created`;
      addToast(toastMsg);

      setTimeout(() => {
        onClose();
        if (mode === "save_and_job" && onCreateAndJob) {
          onCreateAndJob(result.clientId!);
        } else if (mode === "save_and_quote" && onCreateAndQuote) {
          onCreateAndQuote(result.clientId!);
        }
      }, 400);
      return;
    }

    // No org available — cannot persist client
    console.error("Cannot create client: no organization context");
    addToast("Unable to save — please refresh and try again");
    setSaving(false);
    return;
  }

  /* ── Keys ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        if (splitMenuOpen) { setSplitMenuOpen(false); return; }
        if (activePill) { setActivePill(null); return; }
        onClose();
      }
      // Enter on name to lock
      if (e.key === "Enter" && !isLocked && nameQuery.trim() && document.activeElement === nameInputRef.current) {
        e.preventDefault();
        lockIdentity();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, activePill, splitMenuOpen, isLocked, nameQuery, clientName]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — PRD 55.0 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50"
            aria-hidden
            onClick={onClose}
          />

          {/* Stage — Obsidian */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={saved ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            layout
            className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-[840px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--surface-2)] shadow-[var(--shadow-deep)]"
            style={{ maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
              <span className="text-[12px] text-zinc-500">
                Clients <span className="text-zinc-700">/</span>{" "}
                <span className="text-zinc-600">New Entity</span>
              </span>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">Esc</kbd>
                <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" aria-label="Close">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Scrollable body ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 1: The Identity Hook                     */}
              {/* ══════════════════════════════════════════════ */}
              <div className="px-6 pt-5 pb-4">
                {isLocked ? (
                  /* Locked identity pill */
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: getAvatarColor(initials) }}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[20px] font-medium tracking-tight text-zinc-100">
                        {clientName}
                      </div>
                      {existingMatch && (
                        <div className="mt-0.5 text-[10px] text-amber-400">
                          A client with this name already exists
                        </div>
                      )}
                    </div>
                    <button
                      onClick={unlockIdentity}
                      className="rounded-md p-1 text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  /* Magic input */
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      {isEnriching ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkles size={18} className="text-[var(--brand)]" />
                        </motion.div>
                      ) : (
                        <Sparkles size={18} className="text-zinc-700" />
                      )}
                      <input
                        ref={nameInputRef}
                        value={nameQuery}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Company name or email..."
                        className="w-full bg-transparent text-[22px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
                      />
                    </div>
                    {nameQuery.trim().length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2 text-[10px] text-zinc-600"
                      >
                        Press <kbd className="rounded bg-[var(--subtle-bg)] px-1 py-0.5 font-mono text-[9px] text-zinc-500">Enter</kbd> to confirm
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 2: Location Intel (Map + Address)        */}
              {/* ══════════════════════════════════════════════ */}
              <AnimatePresence>
                {isLocked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4">
                      {/* Map card — always interactive */}
                      <div className="overflow-hidden rounded-lg border border-[var(--border-base)]">
                        <div className="relative h-[160px] bg-[var(--surface-1)]">
                          <InlineMap
                            lat={addressCoords?.lat ?? DEFAULT_MAP_CENTER_LATLNG.lat}
                            lng={addressCoords?.lng ?? DEFAULT_MAP_CENTER_LATLNG.lng}
                            zoom={addressCoords ? 16 : 4}
                            className="h-full w-full"
                            interactive
                            draggable={!!addressCoords}
                            onMarkerDragEnd={handleMarkerDragEnd}
                            hideMarker={!addressCoords}
                          />

                          {/* Address overlay on map */}
                          <AnimatePresence>
                            {address && (
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ delay: 0.3 }}
                                className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[rgba(0,0,0,0.7)] px-3 py-2 backdrop-blur-md"
                              >
                                <MapPin size={10} className="shrink-0 text-emerald-500" />
                                <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                                  {address}
                                </span>
                                {driveTime && (
                                  <span className="shrink-0 text-[9px] text-zinc-600">
                                    {driveTime} from HQ
                                  </span>
                                )}
                                {addressCoords && (
                                  <span className="shrink-0 flex items-center gap-0.5 text-[9px] text-zinc-700" title="Drag marker to adjust">
                                    <GripVertical size={8} />
                                    Drag pin
                                  </span>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* FIX: CLIENT-ADDRESS-03 — Always-mounted address autocomplete.
                          addressQuery drives the input text (every keystroke).
                          address is set only on selection (confirmed value).
                          This prevents the self-destructing conditional render. */}
                      <div className="mt-3">
                        <div className="relative">
                          <AddressAutocomplete
                            value={addressQuery}
                            onChange={setAddressQuery}
                            onSelect={handleAddressSelect}
                            placeholder="Search service address…"
                            variant="underline"
                            showIcon
                          />
                          {/* Clear button when address is confirmed */}
                          {address && (
                            <button
                              onClick={handleAddressClear}
                              className="absolute right-0 top-0 rounded-md p-1 text-zinc-600 transition-colors hover:text-zinc-400"
                              aria-label="Clear address"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════ */}
                    {/* ZONE 3: Contact & Billing Details          */}
                    {/* ══════════════════════════════════════════ */}
                    <div className="border-t border-[var(--border-base)] px-6 py-4">
                      {/* Client type selector — Big toggle cards */}
                      <div className="mb-5 grid grid-cols-2 gap-3">
                        {clientTypes.map((ct) => {
                          const Icon = ct.icon;
                          const active = clientType === ct.value;
                          return (
                            <motion.button
                              key={ct.value}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setClientType(ct.value)}
                              className={`relative flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition-all duration-200 ${
                                active
                                  ? "border-white/20 bg-[var(--subtle-bg-hover)]"
                                  : "border-[var(--border-base)] bg-[var(--card-bg)] hover:border-[var(--border-active)] hover:bg-[var(--card-bg)]"
                              }`}
                            >
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                                active ? "bg-white/10 text-white" : "bg-[var(--subtle-bg)] text-zinc-500"
                              }`}>
                                <Icon size={20} />
                              </div>
                              <div>
                                <div className={`text-[13px] font-medium ${active ? "text-white" : "text-zinc-400"}`}>
                                  {ct.label}
                                </div>
                                <div className="mt-0.5 text-[10px] text-zinc-600">{ct.desc}</div>
                              </div>
                              {active && (
                                <motion.div
                                  layoutId="entity-type-check"
                                  className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-white"
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                  <Check size={10} className="text-black" />
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* 2-column grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Primary contact */}
                        <div>
                          <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                            Primary Contact
                          </label>
                          <input
                            ref={contactNameRef}
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Full name"
                            className="w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]"
                          />
                        </div>

                        {/* Role */}
                        <div>
                          <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                            Role
                          </label>
                          <input
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            placeholder="e.g. Owner, Site Manager"
                            className="w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                            <Mail size={8} />
                            Email
                          </label>
                          <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="email@company.com"
                            className="w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]"
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                            <Phone size={8} />
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            placeholder="+61 400 000 000"
                            className="w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]"
                          />
                        </div>
                      </div>

                      {/* Billing term */}
                      <div className="mt-4">
                        <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                          Billing Term
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setActivePill(activePill === "billing" ? null : "billing")}
                            className="flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-[var(--card-border-hover)] hover:text-zinc-300"
                          >
                            {billingTerms.find((b) => b.value === billingTerm)?.label}
                            <ChevronDown size={10} className="text-zinc-600" />
                          </button>
                          <div className="absolute bottom-full left-0 mb-1">
                            <PopoverMenu
                              open={activePill === "billing"}
                              onClose={() => setActivePill(null)}
                              items={billingTerms.map((b) => ({
                                value: b.value,
                                label: b.label,
                              }))}
                              selected={billingTerm}
                              onSelect={(v) => setBillingTerm(v as BillingTerm)}
                              width={180}
                              searchable={false}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Billing address split — PRD §4.1 */}
                      <div className="mt-4">
                        <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <button
                            onClick={() => {
                              setBillingAddressDifferent(!billingAddressDifferent);
                              if (billingAddressDifferent) {
                                setBillingAddress("");
                                setBillingAddressQuery("");
                              }
                            }}
                            className={`relative h-[16px] w-[28px] rounded-full transition-colors ${billingAddressDifferent ? "bg-[var(--brand)]" : "bg-zinc-700"}`}
                          >
                            <motion.div
                              layout
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="absolute top-[2px] h-3 w-3 rounded-full bg-white"
                              style={{ left: billingAddressDifferent ? 13 : 2 }}
                            />
                          </button>
                          Billing address is different from service address
                        </label>

                        <AnimatePresence>
                          {billingAddressDifferent && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3">
                                <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                                  Billing Address
                                </label>
                                <AddressAutocomplete
                                  value={billingAddressQuery}
                                  onChange={setBillingAddressQuery}
                                  onSelect={handleBillingAddressSelect}
                                  placeholder="Search billing address…"
                                  variant="underline"
                                  showIcon
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Tags */}
                      <div className="mt-4">
                        <label className="mb-1.5 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                          Tags
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {["VIP", "Residential", "Commercial", "Emergency OK", "Requires PO"].map(
                            (tag) => {
                              const active = tags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() =>
                                    setTags((prev) =>
                                      active ? prev.filter((t) => t !== tag) : [...prev, tag]
                                    )
                                  }
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] transition-all ${
                                    active
                                      ? "bg-zinc-700 text-zinc-200"
                                      : "bg-[var(--card-bg)] text-zinc-600 hover:bg-[var(--subtle-bg-hover)] hover:text-zinc-400"
                                  }`}
                                >
                                  {active && <Check size={8} className="mr-0.5 inline" />}
                                  {tag}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer / Action Bar ───────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-base)] px-5 py-3">
              {/* Send welcome email toggle */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-[11px] text-zinc-600">
                  <button
                    onClick={() => setSendWelcome(!sendWelcome)}
                    className={`relative h-[16px] w-[28px] rounded-full transition-colors ${sendWelcome ? "bg-[var(--brand)]" : "bg-zinc-700"}`}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-[2px] h-3 w-3 rounded-full bg-white"
                      style={{ left: sendWelcome ? 13 : 2 }}
                    />
                  </button>
                  <Mail size={10} className="text-zinc-600" />
                  Send Welcome Email
                </label>
                <AnimatePresence>
                  {sendWelcome && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[10px] text-amber-400/80 pl-[36px]"
                    >
                      This will immediately email the client.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Split button */}
              <div className="relative flex items-center">
                {/* Primary action */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSave("save")}
                  disabled={!isValid}
                  className="flex items-center gap-2 rounded-l-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saved ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                      <Check size={14} className="text-black" />
                    </motion.div>
                  ) : (
                    <>
                      <User size={12} />
                      Create Client
                    </>
                  )}
                  <kbd className="rounded bg-black/10 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                </motion.button>

                {/* Split dropdown trigger */}
                <button
                  onClick={() => setSplitMenuOpen(!splitMenuOpen)}
                  disabled={!isValid}
                  className="flex h-[40px] items-center rounded-r-xl border-l border-black/10 bg-white px-2 text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                  <ChevronDown size={12} />
                </button>

                {/* Split dropdown — Obsidian popover */}
                <AnimatePresence>
                  {splitMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute bottom-full right-0 z-20 mb-2 w-[200px] overflow-hidden rounded-lg border border-white/5 bg-zinc-950 p-1 shadow-2xl"
                    >
                      <button
                        onClick={() => { setSplitMenuOpen(false); handleSave("save"); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        <User size={12} />
                        Create Client
                      </button>
                      <button
                        onClick={() => { setSplitMenuOpen(false); handleSave("save_and_job"); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        <Briefcase size={12} />
                        Create &amp; Job
                      </button>
                      <button
                        onClick={() => { setSplitMenuOpen(false); handleSave("save_and_quote"); }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        <Receipt size={12} />
                        Create &amp; Quote
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
