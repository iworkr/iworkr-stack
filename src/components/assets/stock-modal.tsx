"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Minus,
  Plus,
  ScanBarcode,
  Camera,
  CheckCircle2,
  Loader2,
  Package,
  MapPin,
  Hash,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useAssetsStore } from "@/lib/assets-store";

interface StockModalProps {
  open: boolean;
  onClose: () => void;
  onScanRequest?: () => void;
  prefillBarcode?: string;
  prefillName?: string;
}

export function StockModal({ open, onClose, onScanRequest, prefillBarcode, prefillName }: StockModalProps) {
  const { currentOrg } = useAuthStore();
  const { createInventoryItemServer } = useAssetsStore();
  const orgId = currentOrg?.id;

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(prefillName || "");
  const [sku, setSku] = useState(prefillBarcode || "");
  const [barcode, setBarcode] = useState(prefillBarcode || "");
  const [quantity, setQuantity] = useState(1);
  const [minQuantity, setMinQuantity] = useState(5);
  const [unitCost, setUnitCost] = useState("");
  const [category, setCategory] = useState("");
  const [binLocation, setBinLocation] = useState("");
  const [supplier, setSupplier] = useState("");

  const skuRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && skuRef.current) {
      setTimeout(() => skuRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    setName(prefillName || "");
    setSku(prefillBarcode || "");
    setBarcode(prefillBarcode || "");
  }, [prefillBarcode, prefillName]);

  const reset = useCallback(() => {
    setName("");
    setSku("");
    setBarcode("");
    setQuantity(1);
    setMinQuantity(5);
    setUnitCost("");
    setCategory("");
    setBinLocation("");
    setSupplier("");
    setSaving(false);
    setSuccess(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!orgId || !name.trim()) return;
    setSaving(true);

    const cost = parseFloat(unitCost.replace(/[^0-9.]/g, ""));

    const result = await createInventoryItemServer({
      organization_id: orgId,
      name: name.trim(),
      sku: sku || null,
      barcode: barcode || null,
      category: category || null,
      quantity,
      min_quantity: minQuantity,
      unit_cost: isNaN(cost) ? null : cost,
      bin_location: binLocation || null,
      supplier: supplier || null,
      ingestion_method: prefillBarcode ? "scan" : "manual",
    });

    setSaving(false);
    if (!result.error) {
      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#050505] shadow-[0_0_60px_-20px_rgba(0,230,118,0.15)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10">
                  <Package size={18} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-[14px] font-medium text-zinc-200">Add Stock Item</h2>
                  <p className="text-[11px] text-zinc-600">Speed entry for consumables</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00E676]/10"
                    >
                      <CheckCircle2 size={32} className="text-[#00E676]" />
                    </motion.div>
                    <p className="mt-3 text-[14px] font-medium text-zinc-200">Stock Added!</p>
                    <p className="mt-1 text-[11px] text-zinc-600">{name} — Qty: {quantity}</p>
                  </motion.div>
                ) : (
                  <motion.div key="form" className="space-y-4">
                    {/* SKU / Barcode row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          SKU / Barcode
                        </label>
                        <div className="relative">
                          <ScanBarcode size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                          <input
                            ref={skuRef}
                            type="text"
                            value={sku}
                            onChange={(e) => { setSku(e.target.value); if (!barcode) setBarcode(e.target.value); }}
                            placeholder="Scan or type"
                            className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-9 pr-9 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.3)]"
                          />
                          {onScanRequest && (
                            <button
                              onClick={onScanRequest}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#00E676] hover:bg-[#00E676]/10"
                            >
                              <Camera size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          Name <span className="text-[#00E676]">*</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Item name"
                          className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.3)]"
                        />
                      </div>
                    </div>

                    {/* Quantity stepper */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                        Quantity
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity(Math.max(0, quantity - 10))}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-400"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-12 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] text-center font-mono text-[20px] font-medium text-zinc-200 outline-none transition-all focus:border-[#00E676]/40 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.3)]"
                          />
                        </div>
                        <button
                          onClick={() => setQuantity(quantity + 10)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Threshold */}
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={13} className="text-amber-500" />
                      <span className="text-[11px] text-zinc-500">Alert when stock hits</span>
                      <input
                        type="number"
                        value={minQuantity}
                        onChange={(e) => setMinQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-8 w-16 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center font-mono text-[12px] text-zinc-300 outline-none transition-all focus:border-amber-500/40"
                      />
                    </div>

                    {/* Detail row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          Unit Cost
                        </label>
                        <div className="relative">
                          <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                          <input
                            type="text"
                            value={unitCost}
                            onChange={(e) => setUnitCost(e.target.value)}
                            placeholder="0.00"
                            className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-7 pr-2 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          Bin Location
                        </label>
                        <div className="relative">
                          <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                          <input
                            type="text"
                            value={binLocation}
                            onChange={(e) => setBinLocation(e.target.value)}
                            placeholder="A1-S2"
                            className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-7 pr-2 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          Category
                        </label>
                        <input
                          type="text"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          placeholder="Pipe, Fitting..."
                          className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40"
                        />
                      </div>
                    </div>

                    {/* Supplier */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                        Supplier
                      </label>
                      <input
                        type="text"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        placeholder="e.g. Reece Plumbing"
                        className="h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-[#00E676]/40 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.3)]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {!success && (
              <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4">
                <button
                  onClick={handleClose}
                  className="rounded-lg px-3 py-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#00E676] to-[#00C853] px-5 py-2 text-[12px] font-medium text-black shadow-[0_0_20px_-6px_rgba(0,230,118,0.4)] transition-all hover:shadow-[0_0_30px_-6px_rgba(0,230,118,0.6)] disabled:opacity-30 disabled:shadow-none"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Package size={14} />
                      Add Stock
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
