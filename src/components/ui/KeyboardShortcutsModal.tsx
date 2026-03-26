"use client";

import { Keyboard } from "lucide-react";
import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useOperatingSystem } from "@/lib/hooks/useOperatingSystem";
import { useCommandStore } from "@/lib/stores/useCommandStore";
import { ObsidianModal, ObsidianModalHeader } from "@/components/ui/obsidian-modal";

type ShortcutRole =
  | "owner"
  | "admin"
  | "manager"
  | "office_admin"
  | "dispatcher"
  | "coordinator"
  | "senior_tech"
  | "technician"
  | "apprentice"
  | "subcontractor"
  | "support_worker"
  | "field_worker"
  | "all";

type ShortcutItem = {
  desc: string;
  keys: string[];
  allowedRoles?: ShortcutRole[];
};

type ShortcutSection = {
  title: string;
  items: ShortcutItem[];
};

function Key({ value }: { value: string }) {
  return (
    <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 font-mono text-xs text-gray-300">
      {value}
    </kbd>
  );
}

function getMetaKey(os: "mac" | "windows" | "linux" | "unknown"): string {
  return os === "mac" ? "⌘" : "Ctrl";
}

function getAltKey(os: "mac" | "windows" | "linux" | "unknown"): string {
  return os === "mac" ? "⌥" : "Alt";
}

function canSeeFinance(role: string, isCare: boolean): boolean {
  if (!isCare) return true;
  const r = role.toLowerCase();
  const blocked =
    r.includes("support_worker") ||
    r.includes("field_worker") ||
    r.includes("technician") ||
    r.includes("apprentice") ||
    r.includes("subcontractor");
  return !blocked;
}

function isRoleAllowed(role: string, allowedRoles?: ShortcutRole[]): boolean {
  if (!allowedRoles || allowedRoles.includes("all")) return true;
  return allowedRoles.includes(role.toLowerCase() as ShortcutRole);
}

export function KeyboardShortcutsModal() {
  const os = useOperatingSystem();
  const { isShortcutModalOpen, setShortcutModalOpen } = useCommandStore();
  const role = useAuthStore((s) => (s.currentMembership?.role || "technician").toLowerCase());
  const isCare =
    useAuthStore((s) => (s.currentOrg as Record<string, unknown> | null)?.industry_type) === "care";

  const meta = getMetaKey(os);
  const alt = getAltKey(os);

  const sections = useMemo<ShortcutSection[]>(() => {
    const base: ShortcutSection[] = [
      {
        title: "Global",
        items: [
          { desc: "Open command palette", keys: [meta, "K"] },
          { desc: "Show keyboard shortcuts", keys: ["Shift", "?"] },
          { desc: "Toggle sidebar", keys: [meta, "["] },
          { desc: "Open settings", keys: [meta, ","] },
        ],
      },
      {
        title: "Operations",
        items: [
          { desc: "Go to dispatch board", keys: ["G", "S"] },
          { desc: "Go to jobs", keys: ["G", "J"] },
          { desc: "Create new job", keys: ["C"] },
          { desc: "Create new client", keys: [meta, "Shift", "C"] },
        ],
      },
      {
        title: "Communications",
        items: [
          { desc: "Go to inbox", keys: ["G", "I"] },
          { desc: "New message", keys: [meta, "N"] },
          { desc: "Close modal/panel", keys: ["Esc"] },
        ],
      },
      {
        title: "Finance & Invoicing",
        items: [
          {
            desc: "Go to finance",
            keys: ["G", "F"],
            allowedRoles: ["owner", "admin", "manager", "office_admin", "dispatcher", "coordinator"],
          },
          {
            desc: "Create new invoice",
            keys: [meta, alt, "I"],
            allowedRoles: ["owner", "admin", "manager", "office_admin", "dispatcher", "coordinator"],
          },
        ],
      },
    ];

    if (!canSeeFinance(role, isCare)) {
      return base.filter((section) => section.title !== "Finance & Invoicing");
    }

    return base;
  }, [alt, isCare, meta, role]);

  return (
    <ObsidianModal
      open={isShortcutModalOpen}
      onClose={() => setShortcutModalOpen(false)}
      maxWidth="2xl"
      padding="none"
    >
      <div className="border-b border-white/[0.06] px-6 py-4">
        <ObsidianModalHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                <Keyboard size={13} className="text-zinc-400" />
              </span>
              Keyboard Shortcuts
            </span>
          }
          subtitle="Global velocity keys for your current role and workspace."
          onClose={() => setShortcutModalOpen(false)}
        />
      </div>

      <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
              <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items
                  .filter((item) => isRoleAllowed(role, item.allowedRoles))
                  .map((item) => (
                    <div key={item.desc} className="flex items-center justify-between gap-3">
                      <span className="text-[12px] text-zinc-300">{item.desc}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k, idx) => (
                          <Key key={`${item.desc}-${idx}-${k}`} value={k} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ObsidianModal>
  );
}

