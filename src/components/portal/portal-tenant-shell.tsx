/**
 * @component PortalTenantShell
 * @status COMPLETE
 * @description White-labeled portal shell with branding, navigation, entity switcher,
 *   and 15-minute idle timeout enforcement.
 * @lastAudit 2026-03-24
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useCallback, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Package,
  CalendarDays,
  PieChart,
  FolderOpen,
  ClipboardCheck,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { usePortalStore, type PortalTenant } from "@/lib/stores/portal-store";
import { getPortalDashboardData } from "@/app/actions/portal-client";
import type { PortalWorkspaceConfig } from "@/app/actions/portal-client";
import { createClient } from "@/lib/supabase/client";

interface Props {
  config: PortalWorkspaceConfig;
  slug: string;
  children: React.ReactNode;
}

const TRADES_TABS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/assets", label: "Assets", icon: Package },
];

const CARE_TABS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/care/roster", label: "Roster", icon: CalendarDays },
  { href: "/care/budget", label: "Budget", icon: PieChart },
  { href: "/care/shifts", label: "Sign-Off", icon: ClipboardCheck },
  { href: "/care/documents", label: "Documents", icon: FolderOpen },
];

export function PortalTenantShell({ config, slug, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const setTenant = usePortalStore((s) => s.setTenant);
  const setGrantedEntities = usePortalStore((s) => s.setGrantedEntities);
  const setPortalUser = usePortalStore((s) => s.setPortalUser);
  const setActiveEntityId = usePortalStore((s) => s.setActiveEntityId);
  const touchActivity = usePortalStore((s) => s.touchActivity);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const grantedEntities = usePortalStore((s) => s.grantedEntities);
  const portalUser = usePortalStore((s) => s.portalUser);
  const [entityOpen, setEntityOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const basePrefix = `/portal/c/${slug}`;
  const isCare = config.trade === "care" || config.trade === "ndis" || config.trade === "disability";
  const tabs = isCare ? CARE_TABS : TRADES_TABS;

  useEffect(() => {
    const tenant: PortalTenant = {
      workspace_id: config.workspace_id,
      name: config.name,
      slug: config.slug,
      trade: config.trade,
      logo_url: config.logo_url,
      brand_color: config.brand_color,
      text_on_brand: config.text_on_brand,
      logo_light: config.logo_light,
      logo_dark: config.logo_dark,
      app_name: config.app_name,
      welcome_text: config.welcome_text,
      idle_timeout: config.idle_timeout,
    };
    setTenant(tenant);

    getPortalDashboardData(config.workspace_id).then((result) => {
      if ("error" in result && result.error) return;
      const data = result as {
        ok: boolean;
        user: { id: string; email: string; full_name: string; phone: string | null };
        grants: Array<{
          id: string;
          entity_type: string;
          entity_id: string;
          grant_type: string;
          entity_name: string;
        }>;
      };
      if (data.ok) {
        setPortalUser(data.user);
        setGrantedEntities(data.grants);
      }
      setLoaded(true);
    });
  }, [config, setTenant, setGrantedEntities, setPortalUser, setLoaded]);

  // Idle timeout enforcement
  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => touchActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    const idleCheck = setInterval(async () => {
      const timeoutMs = (config.idle_timeout || 15) * 60 * 1000;
      const store = usePortalStore.getState();
      if (Date.now() - store.lastActivity > timeoutMs) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace(`/portal/login?slug=${slug}&expired=true`);
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearInterval(idleCheck);
    };
  }, [config.idle_timeout, slug, router, touchActivity]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    usePortalStore.getState().reset();
    router.replace(`/portal/login?slug=${slug}`);
  }, [router, slug]);

  const activeEntity = grantedEntities.find((e) => e.entity_id === activeEntityId);
  const brandColor = config.brand_color || "#10B981";

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50">
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-xl"
        style={{ backgroundColor: `${brandColor}08` }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {config.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logo_url}
                alt={config.app_name}
                className="h-7 w-7 rounded object-contain"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-zinc-50">
                {config.app_name}
              </p>
              {portalUser && (
                <p className="truncate text-[11px] text-zinc-500">
                  {portalUser.full_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Entity Switcher */}
            {grantedEntities.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setEntityOpen(!entityOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06]"
                >
                  {activeEntity?.entity_name || "Select"}
                  <ChevronDown size={12} />
                </button>
                {entityOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-white/10 bg-[#0a0a0a] p-1 shadow-2xl">
                    {grantedEntities.map((e) => (
                      <button
                        key={e.entity_id}
                        onClick={() => {
                          setActiveEntityId(e.entity_id);
                          setEntityOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] transition ${
                          e.entity_id === activeEntityId
                            ? "bg-white/[0.08] text-zinc-100"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                        }`}
                      >
                        <span className="truncate">{e.entity_name}</span>
                        <span className="ml-auto text-[10px] text-zinc-600">
                          {e.grant_type.replace("_", " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        {loaded && (
          <div className="mx-auto grid max-w-5xl gap-1 px-4 pb-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const href = `${basePrefix}${tab.href}`;
              const isActive =
                tab.href === ""
                  ? pathname === basePrefix || pathname === `${basePrefix}/`
                  : pathname.startsWith(href);
              return (
                <Link
                  key={tab.href}
                  href={href}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-medium transition ${
                    isActive
                      ? "text-white"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                  style={isActive ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
                >
                  <Icon size={14} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-6 text-center">
        <p className="text-[10px] text-zinc-700">
          Powered by iWorkr · Secure Client Portal
        </p>
      </footer>
    </div>
  );
}
