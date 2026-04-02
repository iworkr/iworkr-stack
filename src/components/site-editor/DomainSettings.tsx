/**
 * @component components/site-editor/DomainSettings.tsx
 * @status STABLE
 * @description Loom site builder — DomainSettings
 * @lastReview 2026-03-28
 */
"use client";

import { useState, useCallback } from "react";
import { Globe, CheckCircle2, AlertCircle, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { addCustomDomain, checkDomainStatus, removeCustomDomain } from "@/app/actions/site-domains";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export function DomainSettings() {
  const store = useSiteEditorStore();
  const [domain, setDomain] = useState("");
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  const siteId = store.siteId;
  const currentDomain = store.siteSettings.customDomain;
  const verified = store.siteSettings.domainVerified;
  const subdomain = store.siteSettings.subdomain;

  const handleCheck = useCallback(async () => {
    if (!siteId) return;
    setChecking(true);
    try {
      const result = await checkDomainStatus(siteId);
      if (result.verified) {
        store.setSiteSettings({ domainVerified: true });
      }
    } catch {
      // silent
    } finally {
      setChecking(false);
    }
  }, [siteId, store]);

  async function handleAdd() {
    if (!siteId || !domain.trim()) return;
    setAdding(true);
    setError("");
    try {
      const result = await addCustomDomain(siteId, domain);
      store.setSiteSettings({ customDomain: result.domain, domainVerified: false });
      setDnsRecords(result.dnsRecords);
      setDomain("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove() {
    if (!siteId) return;
    setRemoving(true);
    try {
      await removeCustomDomain(siteId);
      store.setSiteSettings({ customDomain: null, domainVerified: false });
      setDnsRecords([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove domain");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
        <Globe size={12} />
        Domain Settings
      </h3>

      {/* Subdomain */}
      <div>
        <label className="text-[11px] text-zinc-500 block mb-1">Subdomain (always active)</label>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] px-3 py-2">
          <span className="text-[11px] text-zinc-300 font-medium">{subdomain || "your-site"}</span>
          <span className="text-[11px] text-zinc-600">.iworkrsites.com</span>
          <CheckCircle2 size={12} className="ml-auto text-emerald-500" />
        </div>
      </div>

      {/* Custom domain */}
      {currentDomain ? (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 block mb-1">Custom Domain</label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] px-3 py-2">
              <span className="text-[11px] text-zinc-300 font-medium flex-1">{currentDomain}</span>
              {verified ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 size={10} />
                  Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertCircle size={10} />
                  Pending
                </span>
              )}
            </div>
          </div>

          {!verified && dnsRecords.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[10px] font-semibold text-amber-400 mb-2">Add these DNS records:</p>
              {dnsRecords.map((r, i) => (
                <div key={i} className="flex gap-3 text-[10px] font-mono text-zinc-400 bg-black/20 rounded px-2 py-1.5 mb-1">
                  <span className="text-amber-400">{r.type}</span>
                  <span>{r.name}</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-zinc-300">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {!verified && (
              <button onClick={handleCheck} disabled={checking} className="flex items-center gap-1 rounded-md border border-[var(--border-base)] px-3 py-1.5 text-[10px] text-zinc-400 hover:bg-white/[0.04]">
                {checking ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Check DNS
              </button>
            )}
            <button onClick={handleRemove} disabled={removing} className="flex items-center gap-1 rounded-md border border-red-500/20 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/5">
              {removing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[11px] text-zinc-500 block">Add Custom Domain</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="www.acmeplumbing.com"
              className="stealth-input flex-1"
            />
            <button onClick={handleAdd} disabled={adding || !domain.trim()} className="stealth-button-primary text-[10px]">
              {adding ? <Loader2 size={10} className="animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
