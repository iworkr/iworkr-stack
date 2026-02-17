"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Globe,
  Phone,
  Trash2,
  Pencil,
  X,
  Loader2,
  Crown,
  Clock,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  type Branch,
} from "@/app/actions/branches";

const TIMEZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
];

export default function BranchesPage() {
  const { currentOrg } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [timezone, setTimezone] = useState("Australia/Brisbane");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxRate, setTaxRate] = useState("10.00");

  const loadBranches = useCallback(async () => {
    if (!currentOrg?.id) return;
    const res = await getBranches(currentOrg.id);
    setBranches(res.data || []);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  function openCreateModal() {
    setEditBranch(null);
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setPostalCode("");
    setTimezone("Australia/Brisbane");
    setPhone("");
    setEmail("");
    setTaxRate("10.00");
    setModalOpen(true);
  }

  function openEditModal(b: Branch) {
    setEditBranch(b);
    setName(b.name);
    setAddress(b.address || "");
    setCity(b.city || "");
    setState(b.state || "");
    setPostalCode(b.postal_code || "");
    setTimezone(b.timezone);
    setPhone(b.phone || "");
    setEmail(b.email || "");
    setTaxRate(String(b.tax_rate));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!currentOrg?.id || !name.trim()) return;
    setSaving(true);

    if (editBranch) {
      await updateBranch(editBranch.id, {
        name, address, city, state, postal_code: postalCode, timezone, phone, email, tax_rate: parseFloat(taxRate),
      });
    } else {
      await createBranch({
        organization_id: currentOrg.id,
        name, address, city, state, postal_code: postalCode, timezone, phone, email, tax_rate: parseFloat(taxRate),
      });
    }

    setModalOpen(false);
    setSaving(false);
    loadBranches();
  }

  async function handleDelete(id: string) {
    await deleteBranch(id);
    setConfirmDeleteId(null);
    loadBranches();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-100">Branches</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Manage your multi-location operations.</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#00E676] to-[#00C853] px-3 py-2 text-[12px] font-semibold text-black transition-all hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)]"
        >
          <Plus size={14} />
          Add Branch
        </motion.button>
      </div>

      {/* Branches List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] py-16">
          <Building2 size={24} className="mb-2 text-zinc-800" />
          <p className="text-[12px] text-zinc-600">No branches yet</p>
          <button onClick={openCreateModal} className="mt-3 text-[12px] text-[#00E676] hover:underline">
            Add your first branch
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 transition-colors hover:border-[rgba(255,255,255,0.12)]"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  b.is_headquarters ? "bg-[#00E676]/10" : "bg-zinc-800"
                }`}>
                  {b.is_headquarters ? <Crown size={16} className="text-[#00E676]" /> : <Building2 size={16} className="text-zinc-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-zinc-200">{b.name}</p>
                    {b.is_headquarters && (
                      <span className="rounded-full bg-[#00E676]/10 px-2 py-0.5 text-[9px] font-medium text-[#00E676]">HQ</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      b.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-600">
                    {(b.city || b.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {[b.city, b.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {b.timezone.split("/").pop()?.replace("_", " ")}
                    </span>
                    {b.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {b.phone}
                      </span>
                    )}
                    <span className="text-zinc-700">Tax: {b.tax_rate}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => openEditModal(b)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                >
                  <Pencil size={13} />
                </button>
                {!b.is_headquarters && (
                  confirmDeleteId === b.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(b.id)} className="rounded-md bg-red-500/15 px-2 py-1 text-[10px] text-red-400">Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="rounded-md px-2 py-1 text-[10px] text-zinc-500">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(b.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                <h2 className="text-[14px] font-medium text-zinc-200">
                  {editBranch ? "Edit Branch" : "Add Branch"}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-zinc-600 hover:text-zinc-300">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-600">Branch Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Gold Coast Office"
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">City</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">State</label>
                    <input value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-600">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">Timezone</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz} className="bg-zinc-900">{tz.split("/").pop()?.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">Tax Rate (%)</label>
                    <input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">Phone</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-600">Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-6 py-3">
                <button onClick={() => setModalOpen(false)} className="rounded-md px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300">Cancel</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={!name.trim() || saving}
                  className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#00E676] to-[#00C853] px-4 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  {editBranch ? "Update" : "Create"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
