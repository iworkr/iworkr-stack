"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CreditCard,
  Keyboard,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { LetterAvatar } from "@/components/ui/letter-avatar";
import { Shimmer } from "@/components/ui/shimmer";
import { useCommandStore } from "@/lib/stores/useCommandStore";

interface UserDropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function UserDropdown({ open, onToggle, onClose }: UserDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { toggleShortcutModal } = useCommandStore();
  const displayName = profile?.full_name || "";
  const displayEmail = profile?.email || "";
  const avatarUrl = profile?.avatar_url;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  const items = [
    { label: "Profile", icon: User, href: "/settings/profile" },
    { label: "Preferences", icon: Settings, href: "/settings/preferences" },
    { label: "Security", icon: Shield, href: "/settings/security" },
    { label: "Billing", icon: CreditCard, href: "/settings" },
    { label: "Keyboard Shortcuts", icon: Keyboard, action: "shortcuts" as const },
    { divider: true },
    { label: "Log out", icon: LogOut, action: "logout" as const },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="rounded-full transition-all duration-150 hover:ring-2 hover:ring-white/[0.2]"
      >
        {displayName ? (
          <LetterAvatar name={displayName} src={avatarUrl} size={24} ring />
        ) : (
          <Shimmer className="h-6 w-6 rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              {displayName && <LetterAvatar name={displayName} src={avatarUrl} size={28} ring />}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-zinc-200">
                  {displayName || <Shimmer className="h-3 w-24" />}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                  {displayEmail || <Shimmer className="h-2 w-32" />}
                </p>
              </div>
            </div>

            <div className="py-1">
              {items.map((item, i) => {
                if ("divider" in item) {
                  return <div key={`div-${i}`} className="my-1 h-px bg-white/[0.06]" />;
                }

                const Icon = item.icon;
                const isDanger = item.label === "Log out";

                return (
                  <button
                    key={item.label}
                    onClick={async () => {
                      onClose();
                      if ("action" in item && item.action === "shortcuts") {
                        toggleShortcutModal();
                        return;
                      }
                      if ("action" in item && item.action === "logout") {
                        await signOut();
                        router.push("/");
                        return;
                      }
                      if ("href" in item) {
                        router.push(item.href);
                      }
                    }}
                    className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                      isDanger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    <span>{item.label}</span>
                    {item.label === "Keyboard Shortcuts" && (
                      <span className="ml-auto font-mono text-[10px] text-zinc-600">Shift+?</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

