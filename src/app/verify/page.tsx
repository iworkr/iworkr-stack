/**
 * @page /verify
 * @status COMPLETE
 * @description Document authenticity verification page with SHA-256 hash checking
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import { CheckCircle2, Shield, Upload, XCircle } from "lucide-react";

type VerifyResponse = {
  authentic: boolean;
  sha256_hash: string;
  message: string;
  record: { created_at: string; document_type: string } | null;
};

export default function VerifyDocumentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");

  const onVerify = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/compliance/verify", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Verification failed");
      setResult(body as VerifyResponse);
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-zinc-100">
      <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield size={16} className="text-[var(--brand)]" />
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">Project Ironclad</p>
        </div>
        <h1 className="text-xl font-semibold">Document Integrity Verifier</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload a dossier PDF to verify its SHA-256 cryptographic seal against the immutable registry.
        </p>

        <label className="mt-5 block rounded-lg border border-zinc-700 bg-black/40 p-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Upload size={14} />
            {file ? file.name : "Choose PDF dossier"}
          </div>
          <input
            className="hidden"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          onClick={onVerify}
          disabled={!file || loading}
          className="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Authenticity"}
        </button>

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

        {result ? (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              result.authentic ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {result.authentic ? <CheckCircle2 size={16} className="text-emerald-300" /> : <XCircle size={16} className="text-rose-300" />}
              <p className={`text-sm font-semibold ${result.authentic ? "text-emerald-200" : "text-rose-200"}`}>{result.message}</p>
            </div>
            <p className="font-mono text-xs text-zinc-300">SHA-256: {result.sha256_hash}</p>
            {result.record ? (
              <p className="mt-1 text-xs text-zinc-300">
                Matched type: {result.record.document_type} · registered {new Date(result.record.created_at).toLocaleString("en-AU")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
