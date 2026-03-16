"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Lock, Shield } from "lucide-react";

type VaultPayload = {
  portal: {
    id: string;
    title: string;
    auditor_email: string;
    scope_date_start: string;
    scope_date_end: string;
  };
  watermark: string;
  standards: {
    participant_rights: { participants: Array<{ id: string; preferred_name?: string; clients?: { name?: string } }> };
    provision_of_supports: { shift_notes: Array<{ id: string; status: string; created_at: string; family_visible_data: Record<string, unknown> }> };
    high_intensity: { incidents: Array<{ id: string; title: string; description: string; severity: string; occurred_at: string }> };
  };
  staff: Array<{ id: string; full_name: string | null; email: string | null }>;
};

export default function AuditorVaultPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<VaultPayload | null>(null);
  const [tab, setTab] = useState<"rights" | "supports" | "high">("rights");

  const title = useMemo(() => data?.portal.title || "Ironclad Auditor Data Room", [data]);

  const requestOtp = async () => {
    setRequestingOtp(true);
    setError("");
    try {
      const res = await fetch("/api/compliance/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passcode, mode: "request_otp" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to send SMS code");
      setOtpRequested(true);
      setOtpHint(body.channel ? `Code sent to ${body.channel}` : "Code sent");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to send SMS code";
      setError(message);
    } finally {
      setRequestingOtp(false);
    }
  };

  const authenticate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compliance/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passcode, otp: otpCode, mode: "verify_otp" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to access data room");
      setData(body as VaultPayload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to access data room";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 text-zinc-200">
        <div className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-zinc-800 bg-white p-6 text-zinc-900">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={16} />
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">Obsidian Trust</p>
          </div>
          <h1 className="text-lg font-semibold">Auditor Data Room Access</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Enter your portal passcode to access the scoped, read-only compliance evidence set.
          </p>
          <label className="mt-4 block text-xs font-medium text-zinc-700">Passcode</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2">
            <Lock size={14} className="text-zinc-500" />
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              type="password"
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Enter passcode"
            />
          </div>
          <button
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
            disabled={!passcode || requestingOtp}
            onClick={requestOtp}
          >
            {requestingOtp ? "Sending SMS..." : otpRequested ? "Resend SMS Code" : "Send SMS Code"}
          </button>
          {otpRequested ? (
            <>
              <label className="mt-3 block text-xs font-medium text-zinc-700">SMS Code</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2">
                <Lock size={14} className="text-zinc-500" />
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  inputMode="numeric"
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="6-digit code"
                />
              </div>
              {otpHint ? <p className="mt-1 text-[11px] text-zinc-500">{otpHint}</p> : null}
            </>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          <button
            className="mt-4 w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!passcode || !otpCode || loading}
            onClick={authenticate}
          >
            {loading ? "Verifying..." : "Verify & Access Data Room"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-500">This portal enforces passcode + SMS OTP with a secure session cookie.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center opacity-[0.07]">
        <p className="rotate-[-18deg] text-center font-mono text-lg font-semibold tracking-widest">{data.watermark}</p>
      </div>
      <div className="relative z-10 border-b border-zinc-800 bg-black/70 px-6 py-4 backdrop-blur">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">Auditor Portal</p>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-zinc-500">
          Scope: {data.portal.scope_date_start} to {data.portal.scope_date_end}
        </p>
      </div>
      <div className="relative z-10 mx-auto max-w-6xl p-6">
        <div className="mb-4 flex gap-2">
          <TabButton active={tab === "rights"} onClick={() => setTab("rights")} label="Participant Rights & Responsibilities" />
          <TabButton active={tab === "supports"} onClick={() => setTab("supports")} label="Provision of Supports" />
          <TabButton active={tab === "high"} onClick={() => setTab("high")} label="High Intensity Activities" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          {tab === "rights" ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Participants in Scope</h2>
              {data.standards.participant_rights.participants.map((p) => (
                <div key={p.id} className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm">
                  {(p.preferred_name || p.clients?.name || "Participant")} · {p.id.slice(0, 8)}...
                </div>
              ))}
            </div>
          ) : null}

          {tab === "supports" ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Shift Notes (Family-safe projection)</h2>
              {data.standards.provision_of_supports.shift_notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm">
                  <p className="mb-1 font-mono text-xs text-zinc-500">
                    {new Date(note.created_at).toLocaleString("en-AU")} · {note.status}
                  </p>
                  <pre className="overflow-x-auto text-xs text-zinc-300">{JSON.stringify(note.family_visible_data, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "high" ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Incident Evidence (Redacted)</h2>
              {data.standards.high_intensity.incidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm">
                  <p className="mb-1 text-zinc-200">{incident.title}</p>
                  <p className="text-xs text-zinc-400">{incident.description}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs ${
        active
          ? "border-zinc-400 bg-zinc-100 text-black"
          : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {label}
    </button>
  );
}
