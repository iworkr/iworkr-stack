"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, Link2, Lock, Shield, Trash2 } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createAuditorPortalAction,
  listAuditorPortalsAction,
  listIroncladScopeOptionsAction,
  revokeAuditorPortalAction,
} from "@/app/actions/care";

type Option = { id: string; name: string };
type Portal = {
  id: string;
  title: string | null;
  auditor_email: string;
  auditor_phone: string | null;
  access_token: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
};

export default function ComplianceAuditsPage() {
  const { orgId } = useOrg();
  const [participants, setParticipants] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [auditorEmail, setAuditorEmail] = useState("");
  const [auditorPhone, setAuditorPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [title, setTitle] = useState("NDIS Sample Audit Data Room");
  const [busy, startBusy] = useTransition();
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    if (!orgId) return;
    const [opts, list] = await Promise.all([
      listIroncladScopeOptionsAction(orgId),
      listAuditorPortalsAction(orgId),
    ]);
    setParticipants(opts.participants);
    setStaff(opts.staff);
    setPortals(list as Portal[]);
    if (selectedParticipants.length === 0 && opts.participants.length > 0) {
      setSelectedParticipants([opts.participants[0].id]);
    }
    if (selectedStaff.length === 0 && opts.staff.length > 0) {
      setSelectedStaff([opts.staff[0].id]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const portalBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/vault`;
  }, []);

  return (
    <div className="relative p-6 lg:p-8">
      <div className="stealth-noise" />
      <div className="mb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          PROJECT IRONCLAD
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Secure Auditor Portals</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Provision time-bound, read-only data rooms with strict scope isolation and revocation controls.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <section className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-6 lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield size={14} className="text-[var(--brand)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              New Auditor Portal
            </span>
          </div>
          <div className="space-y-3">
            <LabeledInput label="Auditor Email" value={auditorEmail} onChange={setAuditorEmail} />
            <LabeledInput label="Auditor Mobile (E.164)" value={auditorPhone} onChange={setAuditorPhone} />
            <LabeledInput label="Passcode (shared out-of-band)" value={passcode} onChange={setPasscode} type="password" />
            <LabeledInput label="Title" value={title} onChange={setTitle} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="Scope Start" type="date" value={dateStart} onChange={setDateStart} />
              <LabeledInput label="Scope End" type="date" value={dateEnd} onChange={setDateEnd} />
            </div>
            <MultiSelect
              label="Participant Sample"
              options={participants}
              selected={selectedParticipants}
              onToggle={(id) =>
                setSelectedParticipants((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
              }
            />
            <MultiSelect
              label="Staff Sample"
              options={staff}
              selected={selectedStaff}
              onToggle={(id) => setSelectedStaff((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))}
            />
            <button
              className="stealth-btn-brand w-full justify-center"
              disabled={
                !orgId ||
                busy ||
                !auditorEmail ||
                !auditorPhone ||
                !passcode ||
                !dateStart ||
                !dateEnd ||
                selectedParticipants.length === 0 ||
                selectedStaff.length === 0
              }
              onClick={() =>
                startBusy(async () => {
                  if (!orgId) return;
                  await createAuditorPortalAction({
                    organization_id: orgId,
                    auditor_email: auditorEmail,
                    auditor_phone: auditorPhone,
                    passcode,
                    scope_date_start: dateStart,
                    scope_date_end: dateEnd,
                    allowed_participant_ids: selectedParticipants,
                    allowed_staff_ids: selectedStaff,
                    title,
                    expires_in_days: 14,
                  });
                  setMessage("Auditor portal created.");
                  setPasscode("");
                  setAuditorPhone("");
                  await load();
                })
              }
            >
              {busy ? "Provisioning..." : "New Auditor Portal"}
            </button>
            <button
              className="stealth-btn-secondary w-full justify-center"
              disabled={!orgId || !dateStart || !dateEnd || selectedParticipants.length === 0 || downloading}
              onClick={async () => {
                if (!orgId || selectedParticipants.length === 0) return;
                setDownloading(true);
                try {
                  const url = `/api/compliance/dossier?organization_id=${encodeURIComponent(orgId)}&participant_id=${encodeURIComponent(
                    selectedParticipants[0],
                  )}&date_start=${encodeURIComponent(dateStart)}&date_end=${encodeURIComponent(dateEnd)}`;
                  const res = await fetch(url);
                  if (!res.ok) {
                    const body = await res.json();
                    throw new Error(body.error || "Dossier generation failed");
                  }
                  const hash = res.headers.get("X-Document-Sha256");
                  const blob = await res.blob();
                  const objUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = objUrl;
                  a.download = `ironclad-dossier-${selectedParticipants[0].slice(0, 8)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(objUrl);
                  setMessage(hash ? `Dossier generated. SHA-256: ${hash}` : "Dossier generated.");
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : "Dossier generation failed.";
                  setMessage(message);
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? "Generating Dossier..." : "Generate Evidence Dossier"}
            </button>
            {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
            <p className="text-[11px] text-[var(--text-muted)]">Vault links require passcode + SMS OTP before data room access.</p>
          </div>
        </section>

        <section className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-0 lg:col-span-7">
          <div className="border-b border-[var(--border-base)] px-5 py-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Active + Historical Portals
            </span>
          </div>
          <div className="divide-y divide-[var(--border-base)]">
            {portals.length === 0 ? (
              <p className="px-5 py-10 text-sm text-[var(--text-muted)]">No auditor portals created yet.</p>
            ) : (
              portals.map((portal) => {
                const link = `${portalBase}/${portal.access_token}`;
                return (
                  <div key={portal.id} className="px-5 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{portal.title || "Auditor Portal"}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {portal.auditor_email} · {portal.auditor_phone || "no phone"} · expires {new Date(portal.expires_at).toLocaleString("en-AU")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          portal.is_revoked ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {portal.is_revoked ? "revoked" : "active"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-black/20 px-3 py-2">
                      <Lock size={12} className="text-[var(--text-muted)]" />
                      <span className="flex-1 truncate font-mono text-xs text-[var(--text-body)]">{link}</span>
                      <button
                        className="rounded p-1 hover:bg-white/5"
                        onClick={async () => {
                          await navigator.clipboard.writeText(link);
                          setMessage("Portal link copied.");
                        }}
                        title="Copy link"
                      >
                        <Copy size={12} />
                      </button>
                      {!portal.is_revoked ? (
                        <button
                          className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
                          title="Revoke access"
                          onClick={() =>
                            startBusy(async () => {
                              if (!orgId) return;
                              await revokeAuditorPortalAction({ portal_id: portal.id, organization_id: orgId });
                              await load();
                            })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                      <a className="rounded p-1 hover:bg-white/5" href={link} target="_blank" rel="noreferrer" title="Open portal">
                        <Link2 size={12} />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)]"
      />
    </label>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-base)] bg-black/20 p-2">
        {options.map((option) => (
          <button
            key={option.id}
            className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
              selected.includes(option.id) ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5 text-[var(--text-body)]"
            }`}
            onClick={() => onToggle(option.id)}
          >
            <span>{option.name}</span>
            {selected.includes(option.id) ? <span className="font-mono text-[10px]">SELECTED</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
