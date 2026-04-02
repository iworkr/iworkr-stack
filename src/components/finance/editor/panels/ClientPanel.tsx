/**
 * @component components/finance/editor/panels/ClientPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — ClientPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { useClientsStore } from "@/lib/clients-store";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { ClientDetailsContent } from "../types";

export function ClientPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  const storeClients = useClientsStore((s) => s.clients);

  const [query, setQuery] = useState("");
  const [showDD, setShowDD] = useState(false);

  const filtered = useMemo(() => {
    if (!block || block.type !== "client_details") return [];
    return query.length > 0
      ? storeClients.filter(
          (cl: any) =>
            cl.name?.toLowerCase().includes(query.toLowerCase()) ||
            (cl.email || "").toLowerCase().includes(query.toLowerCase()),
        )
      : [];
  }, [query, storeClients, block]);

  if (!block || block.type !== "client_details") return null;
  const c = block.content as ClientDetailsContent;

  function selectClient(cl: any) {
    update(blockId, {
      clientId: cl.id,
      clientName: cl.name,
      clientEmail: cl.email || null,
      clientAddress: cl.address || null,
    });
    setQuery("");
    setShowDD(false);
  }

  function clearClient() {
    update(blockId, {
      clientId: null,
      clientName: "",
      clientEmail: null,
      clientAddress: null,
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Client Details
      </h3>

      {c.clientId ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2.5">
          <div>
            <div className="text-sm font-medium text-zinc-200">{c.clientName}</div>
            {c.clientEmail && <div className="text-[10px] text-zinc-600">{c.clientEmail}</div>}
          </div>
          <button onClick={clearClient} className="text-zinc-600 hover:text-zinc-400">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDD(true);
            }}
            onFocus={() => setShowDD(true)}
            placeholder="Search clients…"
            className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30"
          />
          {showDD && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-active)] bg-zinc-900 shadow-2xl">
              {filtered.map((cl: any) => (
                <button
                  key={cl.id}
                  onClick={() => selectClient(cl)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                    {cl.name?.[0] || "?"}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{cl.name}</div>
                    {cl.email && <div className="text-[10px] text-zinc-600">{cl.email}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NDIS Number (if available) */}
      {"ndisNumber" in c && (
        <div>
          <label className="mb-1.5 block text-[11px] text-zinc-400">NDIS Number</label>
          <input
            value={c.ndisNumber || ""}
            onChange={(e) => update(blockId, { ndisNumber: e.target.value })}
            placeholder="NDIS participant number"
            className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
          />
        </div>
      )}
    </div>
  );
}
