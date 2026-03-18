"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileSignature, Plus, Search, CheckCircle2, Clock,
  XCircle, Send, RefreshCw, Eye, DollarSign,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { getProposals } from "@/app/actions/hephaestus";

/* ── Types ────────────────────────────────────────── */

interface Proposal {
  id: string;
  title: string;
  status: string;
  options: Array<{
    label: string;
    total_price: number;
  }>;
  selected_option: number | null;
  signed_at: string | null;
  created_at: string;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
}

/* ── Page ─────────────────────────────────────────── */

export default function ProposalsPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const orgId = org?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const result = await getProposals(orgId, {
      status: statusFilter || undefined,
    });
    if (result.data) setProposals(result.data);
    setLoading(false);
  }, [orgId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

  const statusColors: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
    DRAFT: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-400", icon: Clock },
    PRESENTED: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", icon: Send },
    ACCEPTED: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle2 },
    DECLINED: { bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-400", icon: XCircle },
    EXPIRED: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", icon: Clock },
  };

  return (
    <div className="stealth-page-canvas">
      {/* ── Header ─────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <FileSignature className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Proposals
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Good · Better · Best tiered service proposals
            </p>
          </div>
        </div>
        <button className="stealth-btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Proposal
        </button>
      </div>

      {/* ── Filters ────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
          />
        </div>
        {["", "DRAFT", "PRESENTED", "ACCEPTED", "DECLINED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`stealth-tab text-xs ${statusFilter === s ? "text-[var(--text-primary)] border-b-2 border-[var(--brand-primary)]" : ""}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* ── Proposals List ─────────────────────────── */}
      <div className="px-4 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-[var(--surface-1)] border border-[var(--border-base)] r-card animate-[skeleton-shimmer_1.5s_infinite]" />
          ))
        ) : proposals.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No proposals yet</p>
            <p className="text-xs mt-1">Create proposals from the mobile app or here</p>
          </div>
        ) : (
          proposals.map((proposal) => {
            const sc = statusColors[proposal.status] || statusColors.DRAFT;
            const Icon = sc.icon;
            const maxPrice = Math.max(...(proposal.options || []).map((o) => o.total_price || 0));

            return (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between bg-[var(--surface-1)] border border-[var(--border-base)] r-card px-4 py-3 cursor-pointer hover:border-[var(--border-active)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sc.bg}`}>
                    <Icon className={`w-4 h-4 ${sc.text}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">
                      {proposal.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
                      {proposal.clients?.name && <span>{proposal.clients.name}</span>}
                      <span>·</span>
                      <span>{new Date(proposal.created_at).toLocaleDateString("en-AU")}</span>
                      {proposal.profiles?.full_name && (
                        <>
                          <span>·</span>
                          <span>{proposal.profiles.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Option tiers preview */}
                  <div className="flex items-center gap-1.5">
                    {(proposal.options || []).map((opt, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-[10px] font-mono border r-badge ${
                          proposal.selected_option === i
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-[var(--surface-2)] border-[var(--border-base)] text-[var(--text-muted)]"
                        }`}
                      >
                        {formatMoney(opt.total_price)}
                      </span>
                    ))}
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border r-badge ${sc.bg} ${sc.text}`}>
                    {proposal.status}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
