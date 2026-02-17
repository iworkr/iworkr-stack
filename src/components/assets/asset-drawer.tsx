"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Truck,
  Wrench,
  Cog,
  Camera,
  Upload,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Calendar,
  Hash,
  MapPin,
  ScanBarcode,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useAssetsStore } from "@/lib/assets-store";

type Category = "vehicle" | "tool" | "equipment";

interface AssetDrawerProps {
  open: boolean;
  onClose: () => void;
  onScanRequest?: () => void;
  prefillSerial?: string;
}

const steps = ["Category", "Identification", "Details", "Confirm"];

const categories: { id: Category; label: string; icon: typeof Truck; desc: string; badge: string }[] = [
  { id: "vehicle", label: "Vehicle", icon: Truck, desc: "Trucks, vans, trailers", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "tool", label: "Tool", icon: Wrench, desc: "Drills, presses, kits", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "equipment", label: "Equipment", icon: Cog, desc: "Cameras, jetters, freezers", badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
];

export function AssetDrawer({ open, onClose, onScanRequest, prefillSerial }: AssetDrawerProps) {
  const { currentOrg } = useAuthStore();
  const { createAssetServer } = useAssetsStore();
  const orgId = currentOrg?.id;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState(prefillSerial || "");
  const [barcode, setBarcode] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [serviceInterval, setServiceInterval] = useState("6");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(0);
    setCategory(null);
    setName("");
    setSerialNumber("");
    setBarcode("");
    setMake("");
    setModel("");
    setYear("");
    setPhotoPreview(null);
    setPurchaseCost("");
    setPurchaseDate("");
    setWarrantyExpiry("");
    setServiceInterval("6");
    setLocation("");
    setNotes("");
    setSaving(false);
    setSuccess(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const canNext = (): boolean => {
    if (step === 0) return !!category;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return true;
    return true;
  };

  const handleSave = async () => {
    if (!orgId || !category || !name.trim()) return;
    setSaving(true);

    const cost = parseFloat(purchaseCost.replace(/[^0-9.]/g, ""));
    const intervalDays = parseInt(serviceInterval) * 30;

    const result = await createAssetServer({
      organization_id: orgId,
      name: name.trim(),
      category,
      serial_number: serialNumber || null,
      barcode: barcode || null,
      make: make || null,
      model: model || null,
      year: year ? parseInt(year) : null,
      purchase_cost: isNaN(cost) ? null : cost,
      purchase_date: purchaseDate || null,
      warranty_expiry: warrantyExpiry || null,
      location: location || null,
      notes: notes || null,
      metadata: { service_interval_days: intervalDays },
      ingestion_method: prefillSerial ? "scan" : "manual",
    });

    setSaving(false);
    if (!result.error) {
      setSuccess(true);
      setTimeout(() => handleClose(), 1800);
    }
  };

  const formatCurrency = (val: string) => {
    const num = parseFloat(val.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) return val;
    return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[480px] flex-col border-l border-white/10 bg-[#050505]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <h2 className="text-[15px] font-medium text-zinc-200">New Asset</h2>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Step {step + 1} of {steps.length} — {steps[step]}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-[2px] bg-zinc-900">
              <motion.div
                className="h-full bg-emerald-500"
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                {/* Step 0: Category */}
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <p className="text-[13px] font-medium text-zinc-300">What are you adding?</p>
                    <div className="space-y-3">
                      {categories.map((cat) => {
                        const Icon = cat.icon;
                        const selected = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                              selected
                                ? "border-emerald-500/30 bg-emerald-500/[0.04] shadow-[0_0_20px_-8px_rgba(16,185,129,0.2)]"
                                : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]"
                            }`}
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${cat.badge}`}>
                              <Icon size={22} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                              <p className={`text-[13px] font-medium ${selected ? "text-emerald-400" : "text-zinc-200"}`}>
                                {cat.label}
                              </p>
                              <p className="text-[11px] text-zinc-600">{cat.desc}</p>
                            </div>
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500"
                              >
                                <CheckCircle2 size={14} className="text-black" />
                              </motion.div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Identification */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <GhostInput
                      label="Asset Name"
                      placeholder="e.g. Hilti Hammer Drill"
                      value={name}
                      onChange={setName}
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <GhostInput
                        label="Make"
                        placeholder="e.g. Hilti"
                        value={make}
                        onChange={setMake}
                      />
                      <GhostInput
                        label="Model"
                        placeholder="e.g. TE 30-A36"
                        value={model}
                        onChange={setModel}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <GhostInput
                          label="Serial Number"
                          placeholder="Enter or scan"
                          value={serialNumber}
                          onChange={setSerialNumber}
                          icon={<Hash size={13} />}
                        />
                      </div>
                      <div>
                        <GhostInput
                          label="Barcode / QR"
                          placeholder="Scan value"
                          value={barcode}
                          onChange={setBarcode}
                          icon={<ScanBarcode size={13} />}
                          trailing={
                            onScanRequest ? (
                              <button
                                onClick={onScanRequest}
                                className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                              >
                                <Camera size={14} />
                              </button>
                            ) : undefined
                          }
                        />
                      </div>
                    </div>

                    <GhostInput
                      label="Year"
                      placeholder="2024"
                      value={year}
                      onChange={setYear}
                      type="number"
                    />

                    {/* Photo upload */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Photo
                      </label>
                      {photoPreview ? (
                        <div className="relative h-32 overflow-hidden rounded-lg border border-white/[0.06]">
                          <img src={photoPreview} alt="Asset" className="h-full w-full object-cover" />
                          <button
                            onClick={() => setPhotoPreview(null)}
                            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-zinc-400 backdrop-blur-sm hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/[0.02]"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="rounded-full bg-white/[0.04] p-2">
                              <Upload size={16} className="text-zinc-600" />
                            </div>
                            <span className="text-[11px] text-zinc-600">Drop or click to upload</span>
                          </div>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhoto}
                        className="hidden"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <GhostInput
                        label="Purchase Price"
                        placeholder="0.00"
                        value={purchaseCost}
                        onChange={(v) => setPurchaseCost(v)}
                        onBlur={() => setPurchaseCost(formatCurrency(purchaseCost))}
                        icon={<DollarSign size={13} />}
                      />
                      <GhostInput
                        label="Purchase Date"
                        value={purchaseDate}
                        onChange={setPurchaseDate}
                        type="date"
                        icon={<Calendar size={13} />}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <GhostInput
                        label="Warranty Expiry"
                        value={warrantyExpiry}
                        onChange={setWarrantyExpiry}
                        type="date"
                        icon={<Calendar size={13} />}
                      />
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                          Service Interval
                        </label>
                        <select
                          value={serviceInterval}
                          onChange={(e) => setServiceInterval(e.target.value)}
                          className="h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] text-zinc-300 outline-none transition-all focus:border-emerald-500/30 focus:shadow-[0_0_12px_-4px_rgba(16,185,129,0.2)]"
                        >
                          <option value="1">Every 1 month</option>
                          <option value="3">Every 3 months</option>
                          <option value="6">Every 6 months</option>
                          <option value="12">Every 12 months</option>
                          <option value="24">Every 24 months</option>
                        </select>
                      </div>
                    </div>

                    <GhostInput
                      label="Location"
                      placeholder="e.g. HQ Warehouse"
                      value={location}
                      onChange={setLocation}
                      icon={<MapPin size={13} />}
                    />

                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional notes..."
                        rows={3}
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-emerald-500/30 focus:shadow-[0_0_12px_-4px_rgba(16,185,129,0.2)]"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && !success && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <p className="text-[13px] font-medium text-zinc-300">Review & Confirm</p>

                    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                      <ConfirmRow label="Category" value={category || ""} />
                      <ConfirmRow label="Name" value={name} />
                      {serialNumber && <ConfirmRow label="Serial #" value={serialNumber} />}
                      {barcode && <ConfirmRow label="Barcode" value={barcode} />}
                      {make && <ConfirmRow label="Make" value={make} />}
                      {model && <ConfirmRow label="Model" value={model} />}
                      {year && <ConfirmRow label="Year" value={year} />}
                      {purchaseCost && <ConfirmRow label="Cost" value={`$${purchaseCost}`} />}
                      {purchaseDate && <ConfirmRow label="Purchased" value={purchaseDate} />}
                      {warrantyExpiry && <ConfirmRow label="Warranty" value={warrantyExpiry} />}
                      <ConfirmRow label="Service" value={`Every ${serviceInterval} months`} />
                      {location && <ConfirmRow label="Location" value={location} />}
                    </div>

                    {photoPreview && (
                      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                        <img src={photoPreview} alt="Asset preview" className="h-24 w-full object-cover" />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Success state */}
                {success && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.3 }}
                      >
                        <CheckCircle2 size={40} className="text-emerald-400" />
                      </motion.div>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 text-[15px] font-medium text-zinc-200"
                    >
                      Asset Added!
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-1 text-[12px] text-zinc-600"
                    >
                      {name} has been added to your fleet.
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {!success && (
              <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4">
                <button
                  onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  <ChevronLeft size={14} />
                  {step > 0 ? "Back" : "Cancel"}
                </button>

                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={!canNext()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500 px-5 py-2 text-[12px] font-medium text-black shadow-[0_0_20px_-6px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.4)] disabled:opacity-30 disabled:shadow-none"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-[12px] font-medium text-black shadow-[0_0_20px_-6px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.4)] disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Add to Fleet"
                    )}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Ghost Input ─────────────────────────────────────── */

function GhostInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  icon,
  trailing,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
        {required && <span className="text-emerald-400">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] ${
            icon ? "pl-9" : "pl-3"
          } ${trailing ? "pr-10" : "pr-3"} text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-emerald-500/30 focus:shadow-[0_0_12px_-4px_rgba(16,185,129,0.2)]`}
        />
        {trailing && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Confirm Row ─────────────────────────────────────── */

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <span className="text-[12px] font-medium capitalize text-zinc-300">{value}</span>
    </div>
  );
}
