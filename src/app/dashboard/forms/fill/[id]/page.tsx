"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Send,
  MapPin,
  Camera,
  PenTool,
  CheckCircle,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useFormsStore } from "@/lib/forms-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getForm } from "@/app/actions/forms";
import type { FormBlock } from "@/lib/forms-data";

/* ── Signature Pad ──────────────────────────────────── */

function SignaturePad({ value, onChange }: { value: string; onChange: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#d4d4d8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  }, [drawing]);

  const stopDraw = useCallback(() => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      onChange(canvas.toDataURL("image/png"));
    }
  }, [hasSignature, onChange]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        className="w-full cursor-crosshair rounded-lg border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.01)]"
        style={{ touchAction: "none" }}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] text-zinc-700">Sign above with your mouse or finger</span>
        {hasSignature && (
          <button onClick={clearSignature} className="text-[9px] text-zinc-600 underline hover:text-zinc-400">Clear</button>
        )}
      </div>
    </div>
  );
}

/* ── Block Renderer ──────────────────────────────────── */

function BlockField({ block, value, onChange }: { block: FormBlock; value: any; onChange: (v: any) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="border-b border-[rgba(255,255,255,0.06)] pb-2 pt-4">
          <h3 className="text-[14px] font-semibold text-zinc-200">{block.label}</h3>
        </div>
      );

    case "short_text":
    case "text":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={block.placeholder || `Enter ${block.label.toLowerCase()}…`}
          className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-[rgba(255,255,255,0.2)]"
        />
      );

    case "long_text":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={block.placeholder || `Enter ${block.label.toLowerCase()}…`}
          rows={3}
          className="w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-[rgba(255,255,255,0.2)]"
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 text-[12px] text-zinc-300 outline-none focus:border-[rgba(255,255,255,0.2)]"
        />
      );

    case "dropdown":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 text-[12px] text-zinc-300 outline-none focus:border-[rgba(255,255,255,0.2)]"
        >
          <option value="" className="bg-zinc-900">Select…</option>
          {block.options?.map((opt) => (
            <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
          ))}
        </select>
      );

    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={value === true || value === "Yes"}
            onChange={(e) => onChange(e.target.checked ? "Yes" : "No")}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-emerald-500"
          />
          <span className="text-[12px] text-zinc-400">{block.label}</span>
        </label>
      );

    case "signature":
      return <SignaturePad value={value || ""} onChange={onChange} />;

    case "gps_stamp":
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
          <MapPin size={14} className="text-emerald-500" />
          <span className="text-[11px] text-zinc-400">
            {value ? `📍 ${value.lat?.toFixed(4)}, ${value.lng?.toFixed(4)}` : "GPS will be captured on submit"}
          </span>
        </div>
      );

    case "photo_evidence":
      return (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.01)] py-6">
          <div className="text-center">
            <Camera size={20} className="mx-auto mb-1.5 text-zinc-700" />
            <label className="cursor-pointer text-[11px] text-zinc-500 underline hover:text-zinc-300">
              Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(file.name);
              }} />
            </label>
          </div>
        </div>
      );

    case "risk_matrix":
      return (
        <div className="flex gap-2">
          {["Low", "Medium", "High", "Extreme"].map((level) => (
            <button
              key={level}
              onClick={() => onChange(level)}
              className={`flex-1 rounded-lg border py-2 text-center text-[11px] font-medium transition-colors ${
                value === level
                  ? level === "Low" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : level === "Medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : level === "High" ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-red-600/30 bg-red-600/10 text-red-300"
                  : "border-[rgba(255,255,255,0.08)] text-zinc-600 hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-400"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      );

    default:
      return <div className="text-[11px] text-zinc-700">Unsupported field type: {block.type}</div>;
  }
}

/* ── Main Page ──────────────────────────────────────── */

export default function FormFillPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const { createSubmission, signAndLock } = useFormsStore();

  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    getForm(params.id as string).then(({ data }) => {
      if (data) setTemplate(data);
      setLoading(false);
    });
  }, [params.id]);

  const blocks: FormBlock[] = template?.blocks || [];

  const setValue = (blockId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [blockId]: value }));
  };

  const captureGps = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleSubmit = async () => {
    if (!orgId || !template) return;
    setSubmitting(true);

    // Capture GPS for any gps_stamp blocks
    const gps = await captureGps();
    const dataWithGps = { ...formData };
    blocks.forEach((b) => {
      if (b.type === "gps_stamp" && gps) {
        dataWithGps[b.id] = gps;
      }
    });

    // Build readable data object keyed by label
    const readableData: Record<string, any> = {};
    blocks.forEach((b) => {
      if (b.type !== "heading") {
        readableData[b.label] = dataWithGps[b.id] || "—";
      }
    });

    const res = await createSubmission({
      form_id: template.id,
      organization_id: orgId,
      data: readableData,
    });

    if (res.data?.id) {
      // Find the signature data
      const sigBlock = blocks.find((b) => b.type === "signature");
      const sigData = sigBlock ? (formData[sigBlock.id] || "") : "";

      if (sigData) {
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(readableData))))
        ).map((b) => b.toString(16).padStart(2, "0")).join("");

        const ua = navigator.userAgent;
        await signAndLock(res.data.id, sigData, hash, {
          device: ua,
          gps: gps || undefined,
        });
      }
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 h-6 w-48 rounded skeleton-shimmer" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
          ))}
        </div>
        <div className="mt-8 h-10 w-32 rounded-lg skeleton-shimmer" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText size={32} strokeWidth={0.8} className="mx-auto mb-3 text-zinc-800" />
          <p className="text-[13px] text-zinc-500">Form template not found.</p>
          <button onClick={() => router.push("/dashboard/forms")} className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300">Back to Forms</button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-[18px] font-semibold text-zinc-200">Submission Complete</h2>
          <p className="mt-1 text-[12px] text-zinc-500">Your form has been submitted and signed successfully.</p>
          <button
            onClick={() => router.push("/dashboard/forms")}
            className="mt-6 rounded-lg bg-white/[0.06] px-4 py-2 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.1]"
          >
            Back to Forms
          </button>
        </motion.div>
      </div>
    );
  }

  // Count required fields
  const requiredBlocks = blocks.filter((b) => b.required && b.type !== "heading" && b.type !== "gps_stamp");
  const filledRequired = requiredBlocks.filter((b) => !!formData[b.id]).length;
  const allRequiredFilled = filledRequired === requiredBlocks.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/forms")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:text-zinc-300">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-[14px] font-medium text-zinc-200">{template.title}</h1>
            <p className="text-[10px] text-zinc-600">
              {filledRequired}/{requiredBlocks.length} required fields completed
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !allRequiredFilled}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[11px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Submit & Sign
        </button>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-6 py-8">
          {/* Document header */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C0C] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800">
                <FileText size={16} className="text-zinc-400" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-zinc-200">{template.title}</h2>
                {template.description && <p className="mt-0.5 text-[11px] text-zinc-600">{template.description}</p>}
                <p className="mt-0.5 text-[9px] text-zinc-700">Version {template.version || 1}</p>
              </div>
            </div>
          </motion.div>

          {/* Form fields */}
          <div className="space-y-5">
            {blocks.map((block, i) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                {block.type !== "heading" && block.type !== "checkbox" && (
                  <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">
                    {block.label}
                    {block.required && <span className="ml-1 text-red-400">*</span>}
                  </label>
                )}
                <BlockField
                  block={block}
                  value={formData[block.id]}
                  onChange={(v) => setValue(block.id, v)}
                />
              </motion.div>
            ))}
          </div>

          {/* GPS notice */}
          {blocks.some((b) => b.type === "gps_stamp") && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-4 py-2.5">
              <MapPin size={14} className="text-emerald-500" />
              <span className="text-[11px] text-zinc-400">Your GPS coordinates will be captured when you submit this form.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
