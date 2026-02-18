"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Code2,
  ExternalLink,
  Shield,
  Clock,
  Loader2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getApiKeys,
  generateApiKey,
  revokeApiKey,
  type ApiKey,
} from "@/app/actions/api-keys";

export default function DevelopersPage() {
  const { currentOrg } = useAuthStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Production Key");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!currentOrg?.id) return;
    const res = await getApiKeys(currentOrg.id);
    setKeys(res.data || []);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  async function handleCreate() {
    if (!currentOrg?.id || !newKeyName.trim()) return;
    setCreating(true);
    const res = await generateApiKey({
      organization_id: currentOrg.id,
      name: newKeyName,
    });
    if (res.key) {
      setRevealedKey(res.key);
    }
    setCreating(false);
    setCreateModalOpen(false);
    loadKeys();
  }

  async function handleRevoke(id: string) {
    await revokeApiKey(id);
    setConfirmRevokeId(null);
    loadKeys();
  }

  function copyKey(text: string, id: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const activeKeys = keys.filter((k) => k.status === "active");
  const revokedKeys = keys.filter((k) => k.status === "revoked");

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold text-zinc-100">Developer API</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Manage API keys to integrate the platform with your custom systems.
        </p>
      </div>

      {/* Docs Banner */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10">
            <Code2 size={16} className="text-sky-400" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-zinc-300">API Documentation</p>
            <p className="text-[10px] text-zinc-600">Explore endpoints, authentication, and examples.</p>
          </div>
        </div>
        <a
          href="https://docs.iworkr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.2)] hover:text-zinc-200"
        >
          View Docs
          <ExternalLink size={10} />
        </a>
      </div>

      {/* Create Key */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-zinc-300">API Keys</h2>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { setNewKeyName("Production Key"); setCreateModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#00E676] to-[#00C853] px-3 py-1.5 text-[12px] font-semibold text-black transition-all hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)]"
        >
          <Plus size={12} />
          Generate Key
        </motion.button>
      </div>

      {/* Revealed Key Banner */}
      <AnimatePresence>
        {revealedKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-[#00E676]/20 bg-[#00E676]/5 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-[#00E676]" />
                  <p className="text-[12px] font-medium text-[#00E676]">New API Key Created</p>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Copy this key now — it will not be shown again.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-md border border-[#00E676]/20 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-zinc-300">
                    {revealedKey}
                  </code>
                  <button
                    onClick={() => copyKey(revealedKey, "new")}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#00E676]/20 text-zinc-400 hover:text-[#00E676]"
                  >
                    {copiedId === "new" ? <Check size={12} className="text-[#00E676]" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <button onClick={() => setRevealedKey(null)} className="text-zinc-600 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Keys */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] py-16">
          <Key size={24} className="mb-2 text-zinc-800" />
          <p className="text-[12px] text-zinc-600">No API keys yet</p>
          <button onClick={() => setCreateModalOpen(true)} className="mt-3 text-[12px] text-[#00E676] hover:underline">
            Generate your first key
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeKeys.map((key, i) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 transition-colors hover:border-[rgba(255,255,255,0.12)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00E676]/10">
                  <Key size={14} className="text-[#00E676]" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-zinc-300">{key.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                    <code className="font-mono">{key.key_prefix}...••••</code>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      Created {new Date(key.created_at).toLocaleDateString("en-AU")}
                    </span>
                    {key.last_used_at && (
                      <>
                        <span>·</span>
                        <span>Last used {new Date(key.last_used_at).toLocaleDateString("en-AU")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => copyKey(key.key_prefix, key.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                >
                  {copiedId === key.id ? <Check size={12} className="text-[#00E676]" /> : <Copy size={12} />}
                </button>
                {confirmRevokeId === key.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleRevoke(key.id)} className="rounded-md bg-red-500/15 px-2 py-1 text-[10px] text-red-400">Revoke</button>
                    <button onClick={() => setConfirmRevokeId(null)} className="rounded-md px-2 py-1 text-[10px] text-zinc-500">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRevokeId(key.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {/* Revoked Keys */}
          {revokedKeys.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Revoked</h3>
              {revokedKeys.map((key) => (
                <div key={key.id} className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)] p-3 opacity-50">
                  <Key size={12} className="text-zinc-700" />
                  <div>
                    <p className="text-[11px] text-zinc-500 line-through">{key.name}</p>
                    <p className="text-[9px] text-zinc-700">Revoked {key.revoked_at ? new Date(key.revoked_at).toLocaleDateString("en-AU") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !creating && setCreateModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                <h2 className="text-[14px] font-medium text-zinc-200">Generate API Key</h2>
                <button onClick={() => setCreateModalOpen(false)} className="text-zinc-600 hover:text-zinc-300">
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5">
                <label className="mb-1 block text-[10px] text-zinc-600">Key Name</label>
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production, Staging, Webhook"
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 outline-none focus:border-[#00E676]/30"
                />
                <p className="mt-2 text-[10px] text-zinc-600">
                  This key will have full read/write access to your organization&apos;s data via the API.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-6 py-3">
                <button onClick={() => setCreateModalOpen(false)} className="rounded-md px-3 py-1.5 text-[12px] text-zinc-500">Cancel</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || creating}
                  className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#00E676] to-[#00C853] px-4 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
                >
                  {creating && <Loader2 size={12} className="animate-spin" />}
                  Generate
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
