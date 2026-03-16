"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Asclepius — Clinical Pharmacology Command Center
   S8 DD Book, Webster-pak Inventory Telemetry, PRN Config,
   Pharmacy Reorder Tracking, and Low-Stock Alerts.
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import {
  Pill,
  AlertTriangle,
  Package,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Lock,
  Archive,
} from "lucide-react";
import {
  fetchMedicationProfiles,
  fetchLowStockAlerts,
  fetchS8AuditLedger,
  fetchPharmacyOrders,
  updateMedicationConfig,
  upsertMedicationInventory,
  updatePharmacyOrderStatus,
  type MedicationProfile,
  type S8AuditEntry,
  type PharmacyOrder,
} from "@/app/actions/asclepius";
import { useOrg } from "@/lib/hooks/use-org";

type Tab = "overview" | "s8_ledger" | "inventory" | "pharmacy";

export default function AsclepiusPage() {
  const { orgId } = useOrg();
  const [tab, setTab] = useState<Tab>("overview");
  const [medications, setMedications] = useState<MedicationProfile[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [s8Ledger, setS8Ledger] = useState<S8AuditEntry[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMed, setEditingMed] = useState<MedicationProfile | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [meds, alerts, ledger, pharmacyOrders] = await Promise.all([
        fetchMedicationProfiles(orgId),
        fetchLowStockAlerts(orgId),
        fetchS8AuditLedger(orgId),
        fetchPharmacyOrders(orgId),
      ]);
      setMedications(meds);
      setLowStock(alerts);
      setS8Ledger(ledger);
      setOrders(pharmacyOrders);
    } catch {
      // Silent fallback
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const s8Count = medications.filter((m) => m.is_s8_controlled).length;
  const prnCount = medications.filter((m) => m.is_prn).length;
  const websterCount = medications.filter((m) => m.pack_type === "webster_pak").length;
  const criticalCount = lowStock.filter((s) => s.is_critical).length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Pill size={14} /> },
    { id: "s8_ledger", label: "S8 DD Book", icon: <Lock size={14} /> },
    { id: "inventory", label: "Inventory", icon: <Package size={14} /> },
    { id: "pharmacy", label: "Pharmacy Orders", icon: <Truck size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-white">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 ring-1 ring-rose-500/20">
            <Pill size={20} className="text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Asclepius Pharmacology Engine</h1>
            <p className="text-[11px] text-zinc-500">
              S8 Controlled Drug Ledger · PRN Rules · Inventory Telemetry · Pharmacy Reorders
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Medications" value={medications.length} color="blue" />
        <StatCard label="Schedule 8 (Controlled)" value={s8Count} color="red" />
        <StatCard label="PRN Medications" value={prnCount} color="amber" />
        <StatCard
          label="Low Stock Alerts"
          value={lowStock.length}
          color={criticalCount > 0 ? "red" : lowStock.length > 0 ? "amber" : "green"}
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-medium transition ${
              tab === t.id
                ? "bg-zinc-800 text-white ring-1 ring-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <OverviewTab
          medications={medications}
          lowStock={lowStock}
          orgId={orgId || ""}
          onEdit={setEditingMed}
          onReload={load}
        />
      )}
      {tab === "s8_ledger" && <S8LedgerTab ledger={s8Ledger} />}
      {tab === "inventory" && (
        <InventoryTab
          medications={medications}
          lowStock={lowStock}
          orgId={orgId || ""}
          onReload={load}
        />
      )}
      {tab === "pharmacy" && <PharmacyTab orders={orders} onReload={load} />}

      {/* Medication Config Drawer */}
      {editingMed && (
        <MedConfigDrawer
          med={editingMed}
          orgId={orgId || ""}
          onClose={() => setEditingMed(null)}
          onSave={load}
        />
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/20 text-blue-400",
    red: "border-rose-500/20 text-rose-400",
    amber: "border-amber-500/20 text-amber-400",
    green: "border-emerald-500/20 text-emerald-400",
  };
  return (
    <div className={`rounded-xl border ${colors[color] || colors.blue} bg-zinc-900 p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────

function OverviewTab({
  medications,
  lowStock,
  orgId,
  onEdit,
  onReload,
}: {
  medications: MedicationProfile[];
  lowStock: any[];
  orgId: string;
  onEdit: (m: MedicationProfile) => void;
  onReload: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-400">
            <AlertTriangle size={14} />
            Low Stock Alerts ({lowStock.length})
          </h3>
          <div className="space-y-2">
            {lowStock.map((item: any) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${
                  item.is_critical
                    ? "border-rose-500/30 bg-rose-500/10"
                    : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{item.medication_name} {item.dosage}</p>
                    <p className="text-[11px] text-zinc-400">{item.participant_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${item.is_critical ? "text-rose-400" : "text-amber-400"}`}>
                      {item.remaining_days}d
                    </p>
                    <p className="text-[10px] text-zinc-500">remaining</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medication Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {medications.map((med) => (
          <div
            key={med.id}
            className={`rounded-xl border p-4 transition cursor-pointer hover:border-zinc-600 ${
              med.is_s8_controlled
                ? "border-rose-500/20 bg-rose-500/5"
                : "border-zinc-800 bg-zinc-900"
            }`}
            onClick={() => onEdit(med)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-100">{med.medication_name}</p>
                  {med.is_s8_controlled && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">S8</span>
                  )}
                  {med.is_prn && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">PRN</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  {med.dosage} · {med.form} · {med.route}
                </p>
                {med.participant_name && (
                  <p className="mt-1 text-[11px] text-zinc-500">{med.participant_name}</p>
                )}
              </div>
              <div className="flex items-center gap-1 text-zinc-600">
                {med.pack_type === "webster_pak" && <Archive size={12} className="text-blue-400" />}
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Inventory badge */}
            {med.inventory && (
              <div className={`mt-2 rounded-lg px-2 py-1 text-[10px] font-medium ${
                med.inventory.is_critical
                  ? "bg-rose-500/15 text-rose-400"
                  : med.inventory.is_low_stock
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/10 text-emerald-400"
              }`}>
                Stock: {med.inventory.current_stock_count} units · {med.inventory.remaining_days} days remaining
              </div>
            )}

            {/* PRN limits */}
            {med.is_prn && (med.prn_min_gap_hours || med.prn_max_doses_24h) && (
              <div className="mt-2 text-[10px] text-zinc-500">
                {med.prn_min_gap_hours && <span>Min gap: {med.prn_min_gap_hours}h · </span>}
                {med.prn_max_doses_24h && <span>Max 24h: {med.prn_max_doses_24h} doses</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── S8 DD Book Tab ───────────────────────────────────────────

function S8LedgerTab({ ledger }: { ledger: S8AuditEntry[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-400">
          <ShieldCheck size={14} />
          Schedule 8 Dangerous Drug (DD) Digital Ledger
        </h3>
        <p className="text-[11px] text-zinc-500">
          Immutable dual-signed administration records. Replaces the paper DD book.
        </p>
      </div>

      {ledger.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">
          No S8 administrations have been recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Date/Time</th>
                <th className="px-4 py-3">Medication</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Primary Worker</th>
                <th className="px-4 py-3">Witness</th>
                <th className="px-4 py-3 text-right">Before</th>
                <th className="px-4 py-3 text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 text-[11px] text-zinc-400">
                    {new Date(entry.administered_at).toLocaleString("en-AU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-100 font-medium">{entry.medication_name}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{entry.participant_name}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{entry.primary_worker}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={10} /> {entry.witness_worker}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{entry.stock_before}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-100">{entry.stock_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ────────────────────────────────────────────

function InventoryTab({
  medications,
  lowStock,
  orgId,
  onReload,
}: {
  medications: MedicationProfile[];
  lowStock: any[];
  orgId: string;
  onReload: () => void;
}) {
  const [restocking, setRestocking] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState("");

  const handleRestock = async (med: MedicationProfile) => {
    if (!stockInput || isNaN(Number(stockInput))) return;
    try {
      await upsertMedicationInventory({
        medication_id: med.id,
        organization_id: orgId,
        participant_id: med.participant_id,
        current_stock_count: Number(stockInput),
        daily_consumption_rate: med.inventory?.daily_consumption_rate || 1,
        reorder_threshold_days: med.inventory?.reorder_threshold_days || 3,
        linked_pharmacy_name: med.inventory?.linked_pharmacy_name || med.pharmacy || undefined,
      });
      setRestocking(null);
      setStockInput("");
      await onReload();
    } catch (e) {
      console.error("[asclepius] restock error:", e);
    }
  };

  return (
    <div className="space-y-3">
      {medications.map((med) => {
        const inv = med.inventory;
        return (
          <div key={med.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-100">{med.medication_name}</p>
                  <span className="text-[10px] text-zinc-500">{med.dosage}</span>
                  {med.pack_type === "webster_pak" && (
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-400">Webster</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">{med.participant_name}</p>
              </div>

              <div className="flex items-center gap-3">
                {inv ? (
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      inv.is_critical ? "text-rose-400" : inv.is_low_stock ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {inv.current_stock_count}
                    </p>
                    <p className="text-[10px] text-zinc-500">{inv.remaining_days}d remaining</p>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-600">No inventory</span>
                )}

                {restocking === med.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                      placeholder="Count"
                      className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                    />
                    <button
                      onClick={() => handleRestock(med)}
                      className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setRestocking(null); setStockInput(""); }}
                      className="rounded bg-zinc-700 px-2 py-1 text-[11px] text-zinc-300"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRestocking(med.id); setStockInput(String(inv?.current_stock_count || 0)); }}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                  >
                    Restock
                  </button>
                )}
              </div>
            </div>

            {/* Stock bar */}
            {inv && inv.reorder_threshold_days > 0 && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    inv.is_critical ? "bg-rose-500" : inv.is_low_stock ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (inv.remaining_days / (inv.reorder_threshold_days * 3)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pharmacy Orders Tab ──────────────────────────────────────

function PharmacyTab({
  orders,
  onReload,
}: {
  orders: PharmacyOrder[];
  onReload: () => void;
}) {
  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updatePharmacyOrderStatus(orderId, status);
      await onReload();
    } catch (e) {
      console.error("[asclepius] pharmacy order status error:", e);
    }
  };

  const statusColors: Record<string, string> = {
    transmitted: "bg-blue-500/15 text-blue-400",
    acknowledged: "bg-amber-500/15 text-amber-400",
    ready_for_pickup: "bg-teal-500/15 text-teal-400",
    received: "bg-emerald-500/15 text-emerald-400",
    cancelled: "bg-zinc-500/15 text-zinc-400",
  };

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Truck size={28} className="mx-auto mb-2 text-zinc-700" />
          <p className="text-sm text-zinc-500">No pharmacy orders have been generated.</p>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{order.pharmacy_name}</p>
                <p className="text-[11px] text-zinc-400">
                  {order.participant_name} · {order.medication_count} medication(s)
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                  <Clock size={10} />
                  {new Date(order.transmitted_at).toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusColors[order.status] || ""}`}>
                  {order.status.replace(/_/g, " ")}
                </span>
                {order.status === "transmitted" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "acknowledged")}
                    className="rounded bg-amber-600 px-2 py-1 text-[10px] text-white"
                  >
                    Ack
                  </button>
                )}
                {order.status === "acknowledged" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "ready_for_pickup")}
                    className="rounded bg-teal-600 px-2 py-1 text-[10px] text-white"
                  >
                    Ready
                  </button>
                )}
                {order.status === "ready_for_pickup" && (
                  <button
                    onClick={() => handleStatusChange(order.id, "received")}
                    className="rounded bg-emerald-600 px-2 py-1 text-[10px] text-white"
                  >
                    Received
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Medication Config Drawer ─────────────────────────────────

function MedConfigDrawer({
  med,
  orgId,
  onClose,
  onSave,
}: {
  med: MedicationProfile;
  orgId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [isS8, setIsS8] = useState(med.is_s8_controlled);
  const [packType, setPackType] = useState(med.pack_type);
  const [form, setForm] = useState(med.form);
  const [prnGap, setPrnGap] = useState(String(med.prn_min_gap_hours || ""));
  const [prnMax, setPrnMax] = useState(String(med.prn_max_doses_24h || ""));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMedicationConfig(med.id, {
        is_s8_controlled: isS8,
        pack_type: packType,
        form,
        prn_min_gap_hours: prnGap ? Number(prnGap) : null,
        prn_max_doses_24h: prnMax ? Number(prnMax) : null,
      });
      await onSave();
      onClose();
    } catch (e) {
      console.error("[asclepius] config save error:", e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md border-l border-zinc-800 bg-zinc-900 p-6 overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white">
          <XCircle size={18} />
        </button>

        <h2 className="mb-1 text-lg font-semibold">{med.medication_name}</h2>
        <p className="mb-5 text-sm text-zinc-400">
          {med.dosage} · {med.participant_name}
        </p>

        {/* S8 Toggle */}
        <label className="mb-4 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isS8}
            onChange={(e) => setIsS8(e.target.checked)}
            className="h-4 w-4 accent-rose-500"
          />
          <div>
            <p className="text-sm font-medium text-zinc-100">Schedule 8 (Controlled Drug)</p>
            <p className="text-[11px] text-zinc-500">Requires dual-signing and DD book tracking</p>
          </div>
        </label>

        {/* Pack Type */}
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Pack Type</p>
          <div className="grid grid-cols-3 gap-2">
            {["webster_pak", "loose_box", "bottle"].map((pt) => (
              <button
                key={pt}
                onClick={() => setPackType(pt)}
                className={`rounded-lg border px-3 py-2 text-[11px] font-medium transition ${
                  packType === pt
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {pt === "webster_pak" ? "Webster-pak" : pt === "loose_box" ? "Loose Box" : "Bottle"}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Form</p>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            {["tablet", "capsule", "liquid", "patch", "injection", "inhaler", "cream", "drops", "suppository", "other"].map((f) => (
              <option key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* PRN Rules */}
        {med.is_prn && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              PRN Safety Limits
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-zinc-400">Minimum Gap Between Doses (hours)</label>
                <input
                  type="number"
                  value={prnGap}
                  onChange={(e) => setPrnGap(e.target.value)}
                  placeholder="e.g. 4"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400">Maximum Doses in 24 Hours</label>
                <input
                  type="number"
                  value={prnMax}
                  onChange={(e) => setPrnMax(e.target.value)}
                  placeholder="e.g. 4"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
