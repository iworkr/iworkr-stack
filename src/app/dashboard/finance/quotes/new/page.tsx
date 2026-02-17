"use client";

import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Loader2, Send,
  Save, FileText, User, Calendar, X, Check, Sparkles,
} from "lucide-react";
import { createQuote, sendQuote } from "@/app/actions/quotes";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";

/* ── Types ─────────────────────────────────────────────── */

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

/* ── Page ──────────────────────────────────────────────── */

export default function NewQuotePage() {
  const router = useRouter();
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAnim, setSentAnim] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [terms, setTerms] = useState("Net 14");
  const [taxRate, setTaxRate] = useState(10);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 },
  ]);

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const addItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  };

  const removeItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleSave = async (andSend = false) => {
    if (!orgId) return;
    if (!clientName.trim()) {
      addToast("Client name is required");
      return;
    }
    if (lineItems.every((li) => !li.description.trim())) {
      addToast("Add at least one line item");
      return;
    }

    andSend ? setSending(true) : setSaving(true);

    const { data, error } = await createQuote({
      organization_id: orgId,
      title: title || null,
      client_name: clientName,
      client_email: clientEmail || null,
      client_address: clientAddress || null,
      valid_until: validUntil || null,
      terms,
      tax_rate: taxRate,
      notes: notes || null,
      line_items: lineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
        })),
    });

    if (error || !data) {
      addToast(error || "Failed to create quote");
      setSaving(false);
      setSending(false);
      return;
    }

    if (andSend && clientEmail) {
      await sendQuote(data.id);
      setSentAnim(true);
      addToast(`${data.display_id} sent to ${clientEmail}`);
      setTimeout(() => {
        router.push("/dashboard/finance");
      }, 1500);
    } else {
      addToast(`Quote ${data.display_id} saved as draft`);
      router.push("/dashboard/finance");
    }

    setSaving(false);
    setSending(false);
  };

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="flex h-full flex-col">
      {/* Sent animation overlay */}
      <AnimatePresence>
        {sentAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 1, y: 0, opacity: 1 }}
              animate={{ scale: 0.3, y: -300, x: 300, opacity: 0, rotate: -15 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 rounded-xl bg-[#00E676]/20 px-6 py-4 text-[#00E676] backdrop-blur-sm"
            >
              <Send size={24} />
              <span className="text-lg font-medium">Sent!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/finance")}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[15px] font-medium text-zinc-200">New Quote</h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSave(false)}
            disabled={saving || sending}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Draft
          </motion.button>
          {clientEmail && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSave(true)}
              disabled={saving || sending}
              className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#00E676] to-emerald-600 px-3 py-1.5 text-[12px] font-medium text-black shadow-[0_0_20px_-5px_rgba(0,230,118,0.3)]"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Save & Send
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl px-6 py-8"
        >
          {/* The "Paper" */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-8 backdrop-blur-sm">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quote title (e.g., Bathroom Renovation)"
              className="mb-6 w-full bg-transparent text-[20px] font-medium tracking-tight text-[#EDEDED] outline-none placeholder:text-zinc-700"
            />

            {/* Client Details */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Client Name *
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Full name or company"
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Address
                </label>
                <input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Street address, city, state"
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>
            </div>

            {/* Settings row */}
            <div className="mb-8 grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Terms
                </label>
                <select
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none"
                >
                  <option value="Net 7">Net 7</option>
                  <option value="Net 14">Net 14</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Due on receipt">Due on receipt</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <div className="mb-2 grid grid-cols-12 gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                <div className="col-span-1" />
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-center">Unit Price</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1" />
              </div>

              <Reorder.Group
                axis="y"
                values={lineItems}
                onReorder={setLineItems}
                className="space-y-1"
              >
                {lineItems.map((item) => (
                  <Reorder.Item
                    key={item.id}
                    value={item}
                    className="grid grid-cols-12 items-center gap-2 rounded-lg border border-transparent py-1 transition-colors hover:border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <div className="col-span-1 flex cursor-grab justify-center text-zinc-700 active:cursor-grabbing">
                      <GripVertical size={14} />
                    </div>
                    <div className="col-span-5">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="Line item description"
                        className="h-8 w-full rounded border border-white/[0.06] bg-white/[0.02] px-2 text-[12px] text-zinc-200 outline-none focus:border-[#00E676]/30"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        min={1}
                        className="h-8 w-full rounded border border-white/[0.06] bg-white/[0.02] px-2 text-center text-[12px] text-zinc-200 outline-none focus:border-[#00E676]/30"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value))}
                        min={0}
                        step={0.01}
                        className="h-8 w-full rounded border border-white/[0.06] bg-white/[0.02] px-2 text-center text-[12px] text-zinc-200 outline-none focus:border-[#00E676]/30"
                      />
                    </div>
                    <div className="col-span-1 text-right text-[12px] tabular-nums text-zinc-400">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={lineItems.length <= 1}
                        className="rounded p-0.5 text-zinc-700 transition-colors hover:text-red-400 disabled:invisible"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <button
                onClick={addItem}
                className="mt-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
              >
                <Plus size={11} /> Add line item
              </button>
            </div>

            {/* Totals */}
            <div className="border-t border-white/[0.06] pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="tabular-nums text-zinc-300">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-zinc-500">Tax ({taxRate}%)</span>
                    <span className="tabular-nums text-zinc-300">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-2 text-[15px] font-medium">
                    <span className="text-zinc-300">Total</span>
                    <span className="tabular-nums text-[#00E676]">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Notes / Terms
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional terms, conditions, or notes..."
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]/30"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
