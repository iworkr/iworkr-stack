"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Plus, Users, DollarSign, ChevronRight, Loader2, X, MapPin,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { fetchHouses, createHouse, type CareHouse } from "@/app/actions/care-houses";

export default function HousesListPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: houses = [], isLoading } = useQuery<CareHouse[]>({
    queryKey: ["care-houses", orgId],
    queryFn: () => fetchHouses(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createHouse({
        organization_id: orgId!,
        name: newName,
        address: newAddress ? { line1: newAddress } : {},
        house_phone: newPhone || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-houses"] });
      setCreating(false);
      setNewName("");
      setNewAddress("");
      setNewPhone("");
    },
  });

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Care Houses</h1>
          <p className="mt-0.5 text-[11px] text-zinc-500">SIL enclaves, group homes, and care teams</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
        >
          <Plus size={14} /> New House
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-zinc-600" />
          </div>
        ) : houses.length === 0 && !creating ? (
          <div className="text-center py-20">
            <Home size={32} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-[14px] font-medium text-zinc-400">No care houses yet</p>
            <p className="text-[11px] text-zinc-600 mt-1">Create your first SIL house or care team enclave.</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-[12px] font-medium text-black hover:bg-zinc-200"
            >
              Create First House
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {houses.map((house) => (
              <motion.button
                key={house.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => router.push(`/dashboard/houses/${house.id}`)}
                className="group rounded-xl border border-zinc-800/50 bg-[#0A0A0A] p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Home size={18} className="text-emerald-400" />
                  </div>
                  <ChevronRight size={14} className="text-zinc-800 group-hover:text-zinc-500 transition-colors mt-1" />
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-1">{house.name}</h3>
                {house.address?.line1 && (
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-3">
                    <MapPin size={10} /> {house.address.line1}
                  </p>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-zinc-600" />
                    <span className="text-[11px] text-zinc-400">{house.participant_count} residents</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-zinc-600" />
                    <span className="text-[11px] text-zinc-400">{house.staff_count} staff</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={12} className="text-zinc-600" />
                    <span className="text-[11px] text-zinc-400">${Number(house.petty_cash_balance).toFixed(2)}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setCreating(false); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0A0A0A] p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-semibold text-white">New Care House</h2>
                  <button onClick={() => setCreating(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">House Name</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Maple Street SIL" autoFocus
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Address</label>
                    <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="42 Maple Street, Brisbane QLD"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">House Phone</label>
                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="07 1234 5678"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setCreating(false)} className="rounded-lg px-3 py-2 text-[12px] text-zinc-500 hover:text-white">Cancel</button>
                  <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
                    className="rounded-lg bg-white px-4 py-2 text-[12px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40"
                  >{createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : "Create House"}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
