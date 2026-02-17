"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, UserCheck, Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getTeamMembers } from "@/app/actions/team";
import { useAssetsStore } from "@/lib/assets-store";
import { useOrg } from "@/lib/hooks/use-org";
import type { Asset } from "@/lib/assets-data";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface CustodyModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
}

export function CustodyModal({ asset, isOpen, onClose }: CustodyModalProps) {
  const { orgId } = useOrg();
  const { toggleCustodyServer } = useAssetsStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !orgId) return;
    setLoading(true);
    getTeamMembers(orgId).then(({ data }) => {
      if (data) {
        const mapped: TeamMember[] = data.map((m: any) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name || m.profiles?.email || "Unknown",
          email: m.profiles?.email || "",
          avatar_url: m.profiles?.avatar_url,
        }));
        setMembers(mapped);
      }
      setLoading(false);
    });
  }, [isOpen, orgId]);

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    const member = members.find((m) => m.user_id === selectedId);
    await toggleCustodyServer(asset.id, selectedId, `Assigned to ${member?.full_name}`);
    setSubmitting(false);
    setSelectedId(null);
    setSearch("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0C0C0C] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-400" />
              <h2 className="text-[14px] font-medium text-zinc-200">
                {asset.assignee ? "Re-Assign" : "Assign"} {asset.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team members..."
                autoFocus
                className="h-8 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>
          </div>

          {/* Member list */}
          <div className="max-h-60 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-zinc-600" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-zinc-600">No team members found.</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => setSelectedId(m.user_id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selectedId === m.user_id
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-[10px] font-semibold text-zinc-300">
                    {m.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-zinc-300">{m.full_name}</p>
                    <p className="truncate text-[10px] text-zinc-600">{m.email}</p>
                  </div>
                  {selectedId === m.user_id && (
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedId || submitting}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-[11px] font-medium text-black transition-colors hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {asset.assignee ? "Re-Assign" : "Assign"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
