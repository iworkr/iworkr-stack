"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { PopoverMenu } from "./popover-menu";
import { useToastStore } from "./action-toast";
import { useClientsStore } from "@/lib/clients-store";
import { InlineMap } from "@/components/maps/inline-map";
import { useOrg } from "@/lib/hooks/use-org";
import { clients as existingClients, type Client, type ClientStatus } from "@/lib/data";

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

const gradients = [
  "from-zinc-600/40 to-zinc-800/40",
  "from-zinc-500/40 to-zinc-700/40",
  "from-zinc-700/40 to-zinc-900/40",
  "from-zinc-600/40 to-zinc-800/40",
  "from-zinc-500/40 to-zinc-700/40",
  "from-zinc-600/40 to-zinc-800/40",
];

function getGrad(initials: string) {
  const c = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[c % gradients.length];
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── Simulated enrichment results ─────────────────────────── */
const enrichmentDB: Record<string, { address: string; coords: { lat: number; lng: number }; email?: string; phone?: string; type?: "residential" | "commercial" }> = {
  "apex building": { address: "100 Edward St, Brisbane City 4000", coords: { lat: -27.468, lng: 153.025 }, email: "admin@apexbuilding.com.au", phone: "+61 7 3000 1234", type: "commercial" },
  "greenfield": { address: "88 Stanley St, South Brisbane 4101", coords: { lat: -27.477, lng: 153.019 }, email: "hello@greenfield.com.au", phone: "+61 7 3100 5678", type: "commercial" },
  "martinez": { address: "22 Wickham Tce, Spring Hill 4000", coords: { lat: -27.463, lng: 153.024 }, email: "j.martinez@gmail.com", phone: "+61 422 100 200", type: "residential" },
  "chen property": { address: "5/120 Melbourne St, South Brisbane 4101", coords: { lat: -27.475, lng: 153.017 }, email: "info@chenproperty.com.au", phone: "+61 7 3200 9876", type: "commercial" },
};

function simulateEnrich(query: string) {
  const q = query.toLowerCase();
  for (const [key, data] of Object.entries(enrichmentDB)) {
    if (q.includes(key)) return data;
  }
  return null;
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
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  const [billingTerm, setBillingTerm] = useState<BillingTerm>("net_14");
  const [tags, setTags] = useState<string[]>([]);
  const [sendWelcome, setSendWelcome] = useState(false);

  const [activePill, setActivePill] = useState<string | null>(null);
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);
  const enrichTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { addToast } = useToastStore();
  const { createClientServer } = useClientsStore();
  const { orgId } = useOrg();
  const [saving, setSaving] = useState(false);

  /* ── Derived ────────────────────────────────────────────── */
  const initials = clientName ? makeInitials(clientName) : "";
  const isValid = clientName.trim().length >= 2;

  /* Existing client match warning */
  const existingMatch = useMemo(() => {
    if (!clientName || clientName.length < 3) return null;
    return existingClients.find(
      (c) => c.name.toLowerCase() === clientName.toLowerCase()
    );
  }, [clientName]);

  /* ── Reset on open ──────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setNameQuery("");
      setIsEnriching(false);
      setIsLocked(false);
      setClientName("");
      setClientType("residential");
      setAddress("");
      setAddressCoords(null);
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactRole("");
      setBillingTerm("net_14");
      setTags([]);
      setSendWelcome(false);
      setActivePill(null);
      setSplitMenuOpen(false);
      setSaved(false);
      setSaving(false);
      setTimeout(() => nameInputRef.current?.focus(), 120);
    }
  }, [open]);

  /* ── Simulated enrichment ───────────────────────────────── */
  function handleNameChange(val: string) {
    setNameQuery(val);
    if (isLocked) return;

    if (enrichTimerRef.current) clearTimeout(enrichTimerRef.current);

    if (val.length >= 3) {
      setIsEnriching(true);
      enrichTimerRef.current = setTimeout(() => {
        const result = simulateEnrich(val);
        if (result) {
          setAddress(result.address);
          setAddressCoords(result.coords);
          if (result.email) setContactEmail(result.email);
          if (result.phone) setContactPhone(result.phone);
          if (result.type) setClientType(result.type);
        }
        setIsEnriching(false);
      }, 600);
    } else {
      setIsEnriching(false);
    }
  }

  function lockIdentity() {
    if (!nameQuery.trim()) return;
    setClientName(nameQuery.trim());
    setIsLocked(true);
    setTimeout(() => contactNameRef.current?.focus(), 80);
  }

  function unlockIdentity() {
    setIsLocked(false);
    setClientName("");
    setNameQuery(clientName);
    setAddress("");
    setAddressCoords(null);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  /* ── Save ───────────────────────────────────────────────── */
  async function handleSave(mode: "save" | "save_and_job" | "save_and_quote" = "save") {
    if (!isValid || saving) return;

    const billingTermMap: Record<string, string> = {
      due_receipt: "due_on_receipt", net_7: "net_7", net_14: "net_14", net_30: "net_30", net_60: "net_60",
    };

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
        address_lat: addressCoords?.lat || null,
        address_lng: addressCoords?.lng || null,
        tags,
        billing_terms: billingTermMap[billingTerm] || "due_on_receipt",
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[12px]"
            onClick={onClose}
          />

          {/* Stage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={saved ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "circOut" }}
            layout
            className="fixed top-[10%] left-1/2 z-50 flex w-full max-w-[800px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl"
            style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 50px -15px rgba(16,185,129,0.06)", maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
              <span className="text-[12px] text-zinc-600">
                Clients <span className="text-zinc-700">/</span>{" "}
                <span className="text-zinc-500">New Entity</span>
              </span>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                  Esc
                </kbd>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
                >
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
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-bold text-zinc-200 ${getGrad(initials)}`}>
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
                          <Sparkles size={18} className="text-[#00E676]" />
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
                        Press <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-500">Enter</kbd> to confirm
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 2: Location Intel (Map)                  */}
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
                      {/* Map card */}
                      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)]">
                        <div className="relative h-[160px] bg-[#0a0a0a]">
                          {addressCoords ? (
                            <InlineMap lat={addressCoords.lat} lng={addressCoords.lng} zoom={15} className="h-full w-full" />
                          ) : address ? (
                            <img
                              src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=15&size=640x320&scale=2&maptype=roadmap&style=element:geometry%7Ccolor:0x0a0a0a&style=feature:road%7Celement:geometry%7Ccolor:0x18181b&style=feature:road%7Celement:geometry.stroke%7Ccolor:0x27272a&style=feature:road%7Celement:labels%7Cvisibility:off&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off&style=feature:water%7Celement:geometry%7Ccolor:0x050505&style=feature:landscape%7Celement:geometry%7Ccolor:0x0a0a0a&style=element:labels.text.fill%7Ccolor:0x52525b&style=element:labels.text.stroke%7Ccolor:0x0a0a0a&markers=color:0x10B981%7C${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                              alt={address}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <MapPin size={16} strokeWidth={1} className="text-zinc-700" />
                            </div>
                          )}

                          {address && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 }}
                              className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.7)] px-3 py-2 backdrop-blur-md"
                            >
                              <MapPin size={10} className="shrink-0 text-emerald-500" />
                              <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                                {address}
                              </span>
                              <span className="shrink-0 text-[9px] text-zinc-600">
                                12 min from HQ
                              </span>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Address input (if not auto-filled) */}
                      {!address && (
                        <div className="mt-3">
                          <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Enter address..."
                            className="w-full border-b border-[rgba(255,255,255,0.06)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]"
                          />
                        </div>
                      )}
                    </div>

                    {/* ══════════════════════════════════════════ */}
                    {/* ZONE 3: Contact & Billing Details          */}
                    {/* ══════════════════════════════════════════ */}
                    <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
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
                                  ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                                  : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.02]"
                              }`}
                            >
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                                active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-zinc-500"
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
                                  className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                  <Check size={10} className="text-white" />
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
                            className="w-full border-b border-[rgba(255,255,255,0.06)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]"
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
                            className="w-full border-b border-[rgba(255,255,255,0.06)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]"
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
                            className="w-full border-b border-[rgba(255,255,255,0.06)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]"
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
                            className="w-full border-b border-[rgba(255,255,255,0.06)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]"
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
                            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
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
                                      : "bg-[rgba(255,255,255,0.03)] text-zinc-600 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
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
            <div className="flex shrink-0 items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
              {/* Send welcome email toggle */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-[11px] text-zinc-600">
                  <button
                    onClick={() => setSendWelcome(!sendWelcome)}
                    className={`relative h-[16px] w-[28px] rounded-full transition-colors ${sendWelcome ? "bg-[#00E676]" : "bg-zinc-700"}`}
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
                  className="flex items-center gap-2 rounded-l-md bg-[#00E676] px-4 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-[#00C853] disabled:opacity-30"
                >
                  {saved ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check size={14} className="text-emerald-600" />
                    </motion.div>
                  ) : (
                    <>
                      <User size={12} />
                      Create Client
                    </>
                  )}
                  <kbd className="rounded bg-black/10 px-1 py-0.5 font-mono text-[9px]">
                    ⌘↵
                  </kbd>
                </motion.button>

                {/* Split dropdown trigger */}
                <button
                  onClick={() => setSplitMenuOpen(!splitMenuOpen)}
                  disabled={!isValid}
                  className="flex h-[32px] items-center rounded-r-md border-l border-[rgba(0,0,0,0.15)] bg-[#00E676] px-1.5 text-black transition-colors hover:bg-[#00C853] disabled:opacity-30"
                >
                  <ChevronDown size={12} />
                </button>

                {/* Split dropdown */}
                <AnimatePresence>
                  {splitMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute bottom-full right-0 z-20 mb-2 w-[200px] overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
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
