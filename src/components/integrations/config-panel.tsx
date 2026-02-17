"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  RefreshCw,
  AlertTriangle,
  Check,
  ChevronDown,
  Unplug,
  Clock,
  Zap,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useIntegrationsStore } from "@/lib/integrations-store";
import { useToastStore } from "@/components/app/action-toast";

export function ConfigPanel() {
  const {
    integrations,
    configPanelId,
    closeConfigPanel,
    syncNowServer,
    disconnectServer,
    connectServer,
    updateSyncSettingsServer,
    updateAccountMappingServer,
  } = useIntegrationsStore();

  const { addToast } = useToastStore();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const integration = configPanelId
    ? integrations.find((i) => i.id === configPanelId)
    : null;

  const isOpen = !!integration;
  const isConnected = integration?.status === "connected" || integration?.status === "syncing";
  const isSyncing = integration?.status === "syncing";

  const handleSyncNow = async () => {
    if (!integration || actionLoading) return;
    setActionLoading(true);
    addToast(`Syncing ${integration.name}...`);
    const { error } = await syncNowServer(integration.id);
    if (error) addToast(`Sync failed: ${error}`);
    else addToast(`${integration.name} synced successfully`);
    setActionLoading(false);
  };

  const handleDisconnect = async () => {
    if (!integration || actionLoading) return;
    setActionLoading(true);
    const { error } = await disconnectServer(integration.id);
    if (error) addToast(`Failed to disconnect: ${error}`);
    else addToast(`${integration.name} disconnected`);
    setConfirmDisconnect(false);
    setActionLoading(false);
  };

  const handleToggle = async (settingId: string) => {
    if (!integration) return;
    const { error } = await updateSyncSettingsServer(integration.id, settingId);
    if (error) addToast(`Failed to save: ${error}`);
    else addToast(`${integration.name} settings saved`);
  };

  return (
    <AnimatePresence>
      {isOpen && integration && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConfigPanel}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[560px] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${integration.iconBg}`}>
                  <span className="text-[12px] font-bold text-white">{integration.logoContent}</span>
                </div>
                <div>
                  <h2 className="text-[14px] font-medium text-zinc-200">{integration.name}</h2>
                  {integration.connectedAs && (
                    <p className="text-[10px] text-zinc-600">Connected as {integration.connectedAs}</p>
                  )}
                </div>
              </div>
              <button
                onClick={closeConfigPanel}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Status banner */}
              {integration.status === "error" && integration.error && (
                <div className="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <p className="text-[12px] font-medium text-red-400">Connection Error</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{integration.error}</p>
                    <button
                      onClick={async () => {
                        if (integration) {
                          const { error } = await connectServer(integration.id);
                          if (error) addToast(`Re-authentication failed: ${error}`);
                          else {
                            addToast(`${integration.name} re-authenticated`);
                            closeConfigPanel();
                          }
                        }
                      }}
                      className="mt-2 rounded-md bg-red-500/10 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      Re-authenticate
                    </button>
                  </div>
                </div>
              )}

              {/* Sync status */}
              {isConnected && (
                <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-[6px] w-[6px]">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                          <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-[11px] text-emerald-400">Connected</span>
                      </div>
                      <span className="text-[10px] text-zinc-700">·</span>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <Clock size={9} />
                        Last synced: {integration.lastSynced}
                      </span>
                    </div>
                    <button
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                      {isSyncing ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sync Settings (Toggles) */}
              {integration.syncSettings && integration.syncSettings.length > 0 && (
                <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Settings size={12} className="text-zinc-600" />
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Sync Settings</h3>
                  </div>
                  <div className="space-y-3">
                    {integration.syncSettings.map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)] px-4 py-3"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-zinc-300">{setting.label}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-600">{setting.description}</p>
                        </div>
                        <button
                          onClick={() => handleToggle(setting.id)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            setting.enabled ? "bg-emerald-500" : "bg-zinc-800"
                          }`}
                        >
                          <motion.div
                            animate={{ x: setting.enabled ? 16 : 2 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Mappings (Dropdowns) */}
              {integration.accountMappings && integration.accountMappings.length > 0 && (
                <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap size={12} className="text-zinc-600" />
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Account Mapping</h3>
                  </div>
                  <div className="space-y-3">
                    {integration.accountMappings.map((mapping) => (
                      <div key={mapping.id}>
                        <label className="mb-1 block text-[10px] text-zinc-600">{mapping.label}</label>
                        <div className="relative">
                          <select
                            value={mapping.value}
                            onChange={async (e) => {
                            const { error } = await updateAccountMappingServer(integration.id, mapping.id, e.target.value);
                            if (error) addToast(`Failed to save mapping: ${error}`);
                            else addToast(`Account mapping saved`);
                          }}
                            className="h-9 w-full appearance-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 pr-8 text-[12px] text-zinc-300 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
                          >
                            {mapping.options.map((opt) => (
                              <option key={opt} value={opt} className="bg-zinc-900">
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              {integration.features && (
                <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Shield size={12} className="text-zinc-600" />
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Capabilities</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {integration.features.map((f) => (
                      <span
                        key={f}
                        className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[10px] text-zinc-500"
                      >
                        <Check size={9} className="text-emerald-500" />
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              {(isConnected || integration.status === "error") && (
                <div className="px-6 py-4">
                  <div className="rounded-lg border border-red-500/10 bg-red-500/[0.02] p-4">
                    <h3 className="text-[11px] font-medium text-red-400">Danger Zone</h3>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Disconnecting will stop all syncing. This action can be reversed by reconnecting.
                    </p>
                    {!confirmDisconnect ? (
                      <button
                        onClick={() => setConfirmDisconnect(true)}
                        className="mt-3 flex items-center gap-1.5 rounded-md border border-red-500/20 bg-transparent px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Unplug size={11} />
                        Disconnect Integration
                      </button>
                    ) : (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={handleDisconnect}
                          className="rounded-md bg-red-500 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                        >
                          Yes, Disconnect
                        </button>
                        <button
                          onClick={() => setConfirmDisconnect(false)}
                          className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
