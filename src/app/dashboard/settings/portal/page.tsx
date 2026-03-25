/**
 * @page /dashboard/settings/portal
 * @status COMPLETE
 * @description Admin portal management — enable/configure client portal, manage access grants,
 *   view active portal users, and configure white-label branding.
 * @lastAudit 2026-03-24
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Globe, Users, Plus, Trash2, Copy, CheckCircle,
  ExternalLink, Loader2, X, Settings, Link2, Eye,
  Palette, Clock, MessageSquare,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getPortalGrants,
  createPortalGrant,
  revokePortalGrant,
  updatePortalSettings,
  type PortalGrantType,
} from "@/app/actions/portal-client";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const GRANT_TYPES: { value: PortalGrantType; label: string }[] = [
  { value: "TRADES_CUSTOMER", label: "Trades Customer" },
  { value: "FACILITY_MANAGER", label: "Facility Manager" },
  { value: "NDIS_PARTICIPANT", label: "NDIS Participant" },
  { value: "NDIS_GUARDIAN", label: "NDIS Guardian" },
  { value: "NDIS_PLAN_MANAGER", label: "NDIS Plan Manager" },
];

export default function PortalSettingsPage() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<Array<Record<string, unknown>>>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEntityId, setInviteEntityId] = useState("");
  const [inviteEntityType, setInviteEntityType] = useState("client");
  const [inviteGrantType, setInviteGrantType] = useState<PortalGrantType>("TRADES_CUSTOMER");
  const [inviting, setInviting] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"grants" | "settings">("grants");

  // Settings state
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalColor, setPortalColor] = useState("#10B981");
  const [portalName, setPortalName] = useState("");
  const [portalWelcome, setPortalWelcome] = useState("");
  const [portalTimeout, setPortalTimeout] = useState(15);

  const portalUrl = currentOrg?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/c/${currentOrg.slug}` : "";

  const loadGrants = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const result = await getPortalGrants(orgId);
    setGrants(result.grants as Array<Record<string, unknown>>);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  const handleInvite = async () => {
    if (!orgId || !inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    const result = await createPortalGrant(
      orgId, inviteEmail.trim(), inviteName.trim(),
      inviteEntityType, inviteEntityId || orgId,
      inviteGrantType, invitePhone || undefined
    );
    if (result.ok && "magic_token" in result && result.magic_token) {
      setMagicLink(`${window.location.origin}/portal/magic/${result.magic_token}`);
      loadGrants();
    }
    setInviting(false);
  };

  const handleRevoke = async (grantId: string) => {
    if (!confirm("Revoke this portal access?")) return;
    await revokePortalGrant(grantId);
    loadGrants();
  };

  const handleSaveSettings = async () => {
    if (!orgId) return;
    setSaving(true);
    await updatePortalSettings(orgId, {
      portal_enabled: portalEnabled,
      portal_primary_color: portalColor,
      portal_app_name: portalName || undefined,
      portal_welcome_text: portalWelcome || undefined,
      portal_idle_timeout: portalTimeout,
    });
    setSaving(false);
  };

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Client Portal</h1>
          <p className="text-[13px] text-zinc-500">
            Manage external client access to quotes, invoices, assets, and care services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[12px] text-zinc-500">Portal Active</span>
            <button
              onClick={() => setPortalEnabled(!portalEnabled)}
              className={`relative h-6 w-11 rounded-full transition ${
                portalEnabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                portalEnabled ? "left-[22px]" : "left-0.5"
              }`} />
            </button>
          </label>
        </div>
      </div>

      {/* Portal URL */}
      {portalEnabled && portalUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
          <Globe size={16} className="text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-500">Your portal URL</p>
            <p className="truncate text-[13px] text-emerald-300">{portalUrl}</p>
          </div>
          <button
            onClick={() => copyLink(portalUrl)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/10"
          >
            {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/[0.08] p-2 text-zinc-500 hover:text-zinc-300"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-900/50 p-1">
        <button
          onClick={() => setTab("grants")}
          className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            tab === "grants" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Users size={14} className="inline mr-2" />
          Access Grants ({grants.length})
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            tab === "settings" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Settings size={14} className="inline mr-2" />
          Portal Settings
        </button>
      </div>

      {/* Grants Tab */}
      {tab === "grants" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setShowInvite(true); setMagicLink(null); }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-[12px] font-medium text-black"
            >
              <Plus size={14} /> Invite Client
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-zinc-600" />
            </div>
          ) : grants.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
              <Shield size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-400">No portal access grants</p>
              <p className="mt-1 text-[12px] text-zinc-600">
                Invite clients to give them portal access to their quotes, invoices, and service history.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {grants.map((grant) => (
                <div key={grant.id as string} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800">
                      <Users size={14} className="text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-zinc-200">
                        {(grant.portal_users as { full_name?: string })?.full_name || "Unknown"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {(grant.portal_users as { email?: string })?.email} · {(grant.grant_type as string).replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        Granted {fmtDate(grant.granted_at as string)}
                        {!(grant.is_active as boolean) && " · REVOKED"}
                      </p>
                    </div>
                  </div>
                  {(grant.is_active as boolean) && (
                    <button
                      onClick={() => handleRevoke(grant.id as string)}
                      className="rounded-lg p-2 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 space-y-4">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-zinc-300">
              <Palette size={14} /> Branding
            </h3>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Portal Name</label>
              <input
                type="text"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder={currentOrg?.name || "Your Company"}
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 text-[13px] text-zinc-200 outline-none focus:border-emerald-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={portalColor}
                  onChange={(e) => setPortalColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={portalColor}
                  onChange={(e) => setPortalColor(e.target.value)}
                  className="h-9 w-28 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 font-mono text-[13px] text-zinc-200 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 space-y-4">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-zinc-300">
              <MessageSquare size={14} /> Welcome Message
            </h3>
            <textarea
              value={portalWelcome}
              onChange={(e) => setPortalWelcome(e.target.value)}
              placeholder="Welcome to our client portal..."
              rows={3}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-emerald-500/30"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 space-y-4">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-zinc-300">
              <Clock size={14} /> Security
            </h3>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Idle Timeout (minutes)</label>
              <input
                type="number"
                value={portalTimeout}
                onChange={(e) => setPortalTimeout(Number(e.target.value))}
                min={5}
                max={120}
                className="h-9 w-24 rounded-lg border border-white/[0.08] bg-zinc-950 px-3 text-[13px] text-zinc-200 outline-none"
              />
              <p className="mt-1 text-[11px] text-zinc-600">
                Portal sessions expire after this many minutes of inactivity.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-[13px] font-medium text-black disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Save Settings
          </button>
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setShowInvite(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-zinc-200">Invite Client to Portal</h3>
                <button onClick={() => setShowInvite(false)} className="text-zinc-600 hover:text-zinc-400">
                  <X size={16} />
                </button>
              </div>

              {magicLink ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <Link2 size={14} className="text-emerald-400 flex-shrink-0" />
                    <p className="text-[12px] text-emerald-300">Invite link generated</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-zinc-950 p-3">
                    <p className="break-all text-[11px] font-mono text-zinc-400">{magicLink}</p>
                  </div>
                  <button
                    onClick={() => copyLink(magicLink)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-[12px] font-medium text-black"
                  >
                    {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="client@example.com" type="email" />
                  <Input label="Full Name" value={inviteName} onChange={setInviteName} placeholder="Jane Smith" />
                  <Input label="Phone (optional)" value={invitePhone} onChange={setInvitePhone} placeholder="+61 4XX XXX XXX" />
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-500">Grant Type</label>
                    <select
                      value={inviteGrantType}
                      onChange={(e) => setInviteGrantType(e.target.value as PortalGrantType)}
                      className="h-9 w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 text-[12px] text-zinc-200 outline-none"
                    >
                      {GRANT_TYPES.map((gt) => (
                        <option key={gt.value} value={gt.value}>{gt.label}</option>
                      ))}
                    </select>
                  </div>
                  <Input label="Entity ID (Client/Participant UUID)" value={inviteEntityId} onChange={setInviteEntityId} placeholder="Optional" />
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-[12px] font-medium text-black disabled:opacity-50"
                  >
                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Generate Invite Link
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 text-[12px] text-zinc-200 outline-none focus:border-emerald-500/30"
      />
    </div>
  );
}
